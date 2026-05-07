# frozen_string_literal: true

#
# Copyright (C) 2026 - present Instructure, Inc.
#
# This file is part of Canvas.
#
# Canvas is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.

# Shared MFA session logic for checking IP/UA binding and determining
# whether Canvas MFA is actively required for a given user.
module MfaSessionConcern
  # Returns true if Canvas MFA should be enforced for the given user in the
  # current session.
  def canvas_mfa_required?(user, pseudonym: @current_pseudonym)
    return false unless user
    return false if session[:login_aac_skip_canvas_mfa]

    mfa_settings = user.mfa_settings(pseudonym_hint: pseudonym)
    mfa_settings == :required ||
      (mfa_settings == :optional && (user.canvas_mfa? || pseudonym&.authentication_provider&.mfa_required))
  end

  # Checks the current IP and user agent against the verified lists in the session,
  # and redirects to the MFA login page if they do not match and the appropriate settings
  # for this user are enabled.
  #
  # Can be configured using DynamicSettings to enable/disable for different types of users
  # and a FeatureFlag to disable for root accounts that appear to be having issues.
  def check_mfa_ips_and_user_agents
    return unless canvas_mfa_required?(logged_in_user) && in_app?

    verified_ips = session[:mfa_verified_ips]
    ip_match = verified_ips&.include?(request.remote_ip)

    ua_md5 = Digest::MD5.hexdigest(request.user_agent.to_s)
    verified_uas = session[:mfa_verified_uas]
    ua_match = verified_uas&.include?(ua_md5)

    is_site_admin = Account.site_admin.grants_right?(logged_in_user, :read)
    is_account_admin = !is_site_admin && @domain_root_account.cached_all_account_users_for(logged_in_user).any?

    user_type = if is_site_admin then "site_admin"
                elsif is_account_admin then "account_admin"
                else "regular"
                end

    if Account.site_admin.feature_enabled?(:mfa_event_collection)
      event_tags = {
        user_type:,
        account_domain: request.host,
        account_global_id: @domain_root_account&.global_id&.to_s,
        user_global_id: logged_in_user&.global_id&.to_s
      }.merge(
        Canvas::ExecutionContext.to_h
      )

      InstStatsd::Statsd.event("MFA Request", "canvas.mfa_request", type: :mfa_request, alert_type: :info, tags: event_tags)

      unless ip_match
        InstStatsd::Statsd.event("MFA IP Mismatch", "canvas.mfa_ip_mismatch", type: :mfa_ip_mismatch, alert_type: :warning, tags: event_tags)
      end

      unless ua_match
        InstStatsd::Statsd.event("MFA UA Mismatch", "canvas.mfa_ua_mismatch", type: :mfa_ua_mismatch, alert_type: :warning, tags: event_tags)
      end
    end

    return if ip_match && ua_match

    enforce = if @domain_root_account.feature_enabled?(:enforce_session_fingerprinting)
                settings = DynamicSettings.find(tree: :private)
                ip_enforce = unless ip_match
                               (is_site_admin && settings["mfa_ip_enforce_site_admins"]) ||
                                 (is_account_admin && settings["mfa_ip_enforce_account_admins"]) ||
                                 settings["mfa_ip_enforce_all_mfa_users"]
                             end
                ua_enforce = unless ua_match
                               (is_site_admin && settings["mfa_ua_enforce_site_admins"]) ||
                                 (is_account_admin && settings["mfa_ua_enforce_account_admins"]) ||
                                 settings["mfa_ua_enforce_all_mfa_users"]
                             end
                ip_enforce || ua_enforce
              end

    unless enforce
      # If we aren't enforcing, update the session so that we avoid logging on every request after failure
      add_mfa_verified_ip_and_user_agent
      return
    end

    prompt_for_otp
  end

  def prompt_for_otp
    store_location
    session[:pending_otp] = true
    redirect_to otp_login_url
  end

  # Adds the current IP and user agent to the verified lists in the session.
  # Currently limited to tracking the 5 most recently seen IPs and user agents.
  def add_mfa_verified_ip_and_user_agent
    ips = Array(session[:mfa_verified_ips]).reject { |ip| ip == request.remote_ip }
    ips.shift if ips.size >= 5
    session[:mfa_verified_ips] = ips + [request.remote_ip]

    ua_md5 = Digest::MD5.hexdigest(request.user_agent.to_s)
    uas = Array(session[:mfa_verified_uas]).reject { |ua| ua == ua_md5 }
    uas.shift if uas.size >= 5
    session[:mfa_verified_uas] = uas + [ua_md5]
  end
end
