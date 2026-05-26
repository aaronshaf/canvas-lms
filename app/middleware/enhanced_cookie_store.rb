# frozen_string_literal: true

#
# Copyright (C) 2020 - present Instructure, Inc.
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

class EnhancedCookieStore < ActionDispatch::Session::EncryptedCookieStore
  ROOT_ACCOUNT_KEY = "_root_account_id"

  def load_session(req)
    sid, session = super
    return [sid, session] if session.blank?

    issued_for = session[ROOT_ACCOUNT_KEY]
    current = current_root_account_global_id(req)

    # Fail open when either side is missing:
    #   issued_for blank => backwards compatible for already issued sessions
    #   current blank    => request did not resolve a root account (healthchecks, etc.)
    # TODO: remove issued_for.present? check
    if issued_for.present? && current.present? && issued_for != current
      if Account.site_admin.feature_enabled?(:block_cross_domain_session_cookies)
        Rails.logger.warn(
          "[AUTH] session rejected: root_account mismatch " \
          "(issued=#{issued_for} current=#{current} host=#{req.host})"
        )
        Canvas::Errors.capture_exception(:cookie_store, "session root_account mismatch", :warn)
        req.env["enhanced_cookie_store.drop_session"] = true
        return [sid, {}]
      else
        Rails.logger.warn(
          "[AUTH] session would be rejected due to root_account mismatch " \
          "(issued=#{issued_for} current=#{current} host=#{req.host})"
        )
        Canvas::Errors.capture_exception(:cookie_store, "session would be rejected due to root_account mismatch", :warn)
      end
    end

    [sid, session]
  end

  def write_session(req, sid, session_data, options)
    if session_data.present?
      current = current_root_account_global_id(req)
      session_data[ROOT_ACCOUNT_KEY] ||= current if current.present?
    end
    super
  end

  def commit_session(req, res)
    if req.env.delete("enhanced_cookie_store.drop_session")
      delete_opts = {}
      delete_opts[:domain] = @default_options[:domain] if @default_options[:domain]
      delete_opts[:path]   = @default_options[:path]   if @default_options[:path]
      req.cookie_jar.delete(key, delete_opts)
      return
    end
    super
  end

  def unmarshal(data, options = {})
    unmarshalled_data = nil
    begin
      unmarshalled_data = super
    rescue ArgumentError => e
      # if the data being provided is not formatted in such a way that
      # we can extract appropriately sized segments from it,
      # then this is an auth problem (bad cookie), not a real
      # exception.  We'll return nil as though the cookie
      # was unauthorized (and it is), and log the failure, but not explode because
      # handling this as some 4xx is more accurate than a 500.
      Canvas::Errors.capture_exception(:cookie_store, e, :info)
      return nil
    end
    if unmarshalled_data.nil? && data.present?
      Rails.logger.warn("[AUTH] Cookie data (present) failed to unmarshal. Inactivity timeout or invalid digest.")
    end
    unmarshalled_data
  end

  private

  def current_root_account_global_id(req)
    # canvas.domain_root_account can be reassigned by URL context
    # (e.g. /accounts/site_admin) and would falsely trip the cross-domain check
    #
    # domain_root_account is for non-mra setups
    # or domain is determined via domain.yml
    account = req.env["canvas.account_domain"]&.account
    account ||= req.env["canvas.domain_root_account"]
    account&.global_id
  end
end
