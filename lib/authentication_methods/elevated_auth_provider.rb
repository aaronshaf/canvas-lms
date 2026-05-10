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

module AuthenticationMethods
  module ElevatedAuthProvider
    DYNAMIC_SETTINGS_KEY = "elevated_auth_provider.yml"

    def self.setting_enabled?(name)
      yaml = DynamicSettings.find(tree: :private)[DYNAMIC_SETTINGS_KEY, failsafe_cache: Rails.root.join("config")]
      settings = YAML.safe_load(yaml || "{}") || {}
      ActiveModel::Type::Boolean.new.cast(settings[name])
    rescue Psych::Exception => e
      Rails.logger.warn("[ElevatedAuthProvider] Failed to parse #{DYNAMIC_SETTINGS_KEY}: #{e.message}")
      false
    end

    def require_elevated_auth_provider
      pseudonym_account = @current_pseudonym&.account

      unless elevated_auth_provider_required?(pseudonym_account)
        log_message("Not required")
        return true
      end

      if using_elevated_auth_provider?(pseudonym_account)
        log_message("Elevated auth provider requirement was satisfied")
        return true
      end

      handle_no_elevated_auth_provider(pseudonym_account)
    end

    private

    def log_message(message, level: :info)
      Rails.logger.public_send(level, "[ElevatedAuthProvider]: #{message}")
    end

    def operation_permitted_by_client?
      permitted = AuthenticationMethods::AccessTokenAttributes.current_developer_key&.elevated_operation_permitted?(request:)
      if AuthenticationMethods::ElevatedAuthProvider.setting_enabled?("require_client_credentials")
        permitted &&= AuthenticationMethods::AccessTokenAttributes.current_token.is_a?(InstAccess::Token)
      end

      permitted
    end

    def elevated_auth_provider_required?(pseudonym_account)
      if pseudonym_account.nil?
        warn_no_pseudonym_account(@current_pseudonym)

        # During rollout we lean on the cautious side: If there was no current pseudonym
        # in loaded from the session we allow the action and emit a warning.
        #
        # After rollout we should track down all warnings, evaluate each scenario, then
        # determine if allowing the action is the correct path forward
        return false
      end

      # Some OAuth2 clients are permitted to either perform all elevated
      # operations or a subset of them based on their scope and grant type.
      #
      # Check if the DeveloperKey has the needed scopes and grant types
      # to permit the operation without a session required. Additionally
      # check to see if the token was issued for a client credentials grant
      # (detected by the token's type)
      return false if operation_permitted_by_client?

      pseudonym_account.elevated_auth_provider_global_id.present?
    end

    def warn_no_pseudonym_account(pseudonym)
      InstStatsd::Statsd.distributed_increment("elevated_auth_provider.no_pseudonym_account", tags: metric_tags)

      log_message("No pseudonym account found for pseudonym '#{pseudonym&.id}'", level: :warn)
    end

    def using_elevated_auth_provider?(pseudonym_account)
      # session["login_aac"] is not guaranteed to be a global id (yet), so we have to
      # load the AuthenticationProvider to get a known-global value before
      # comparing against the account's stored global id, which is global.
      AuthenticationMethods::PseudonymAttributes.load_auth_provider&.global_id.to_s == pseudonym_account.elevated_auth_provider_global_id.to_s
    end

    # low-cardinality only
    # safe for metrics where tag-value cardinality drives Datadog billing
    def metric_tags
      Utils::InstStatsdUtils::Tags.tags_for(Shard.current)
    end

    # enriched with per-user/per-account ids; only safe on events, where
    # cardinality affects explorer faceting rather than metric cost
    # required for the auto-deactivation monitor's `group by @user_global_id` query
    def event_tags
      metric_tags.merge(
        user_global_id: @current_user&.global_id,
        pseudonym_account_global_id: @current_pseudonym&.account&.global_id
      ).compact
    end

    def handle_no_elevated_auth_provider(pseudonym_account)
      if AuthenticationMethods::ElevatedAuthProvider.setting_enabled?("log_violations")
        # Intentionally not using request.url to avoid logging sensistive params
        message = "A #{request.method} request to #{request.base_url + request.path} (request_id: #{Canvas::ExecutionContext[:request_id]}) by user '#{@current_user&.global_id}' required elevated auth provider '#{pseudonym_account.elevated_auth_provider_global_id}', but '#{AuthenticationMethods::PseudonymAttributes.auth_provider&.global_id}' was used."

        InstStatsd::Statsd.event(
          "Elevated Auth Provider Violation",
          message,
          type: :elevated_auth_provider_violation,
          alert_type: :error,
          tags: event_tags
        )

        log_message(message, level: :warn)
      end

      if AuthenticationMethods::ElevatedAuthProvider.setting_enabled?("enforce_violations")
        respond_to do |format|
          format.html do
            if @current_user
              flash[:error] = {
                html: I18n.t("errors.elevated_auth_provider_required",
                             "This action requires using an elevated authentication provider. Please contact your account administrator."),
                timeout: 60_000
              }
              redirect_to root_url
            else
              redirect_to_login
            end
          end
          format.json { render_json_unauthorized }
          format.any { render_json_unauthorized }
        end
        false
      end
    end
  end
end
