# frozen_string_literal: true

#
# Copyright (C) 2018 - present Instructure, Inc.
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

module Canvas::OAuth
  module GrantTypes
    # ClientCredentials does NOT call super. BaseType#initialize creates a plain
    # Canvas::OAuth::Provider and immediately verifies any JWT assertion — both
    # incompatible with the CC flow, which needs an unverified key first (to
    # dispatch to the correct provider subclass) and a CC-specific provider object.
    # Shared validation logic is inherited from BaseType; token issuance is
    # delegated to the selected provider.
    class ClientCredentials < BaseType
      def initialize(opts, root_account, host:, protocol:) # rubocop:disable Lint/MissingSuper
        @opts = opts
        @provider = client_credential_provider_for(opts, host, root_account, protocol:)
        @secret = opts[:client_secret]
      end

      def supported_type?
        true
      end

      private

      def validate_client_authentication
        # For JWT assertion flows, no shared-secret check is needed
        if jwt_bearer_assertion?
          raise Canvas::OAuth::RequestError, :invalid_client_id unless @provider.has_valid_key?

          return
        end
        super
      end

      def client_credential_provider_for(opts, host, root_account, protocol: nil)
        if jwt_bearer_assertion?
          raw_jwt = opts[:client_assertion]
          asymmetric_key = Canvas::OAuth::ClientAssertion.unverified_key_for(raw_jwt)

          if asymmetric_key&.site_admin_service_auth?
            return Canvas::OAuth::ClientCredentials::ServiceUser::AsymmetricProvider.new(
              raw_jwt,
              host,
              scopes: scopes_from_opts(opts),
              protocol:,
              root_account:
            )
          end

          if asymmetric_key&.is_lti_key?
            return Canvas::OAuth::ClientCredentials::LtiAdvantage::Provider.new(
              raw_jwt,
              host,
              scopes: scopes_from_opts(opts),
              protocol:
            )
          end

          return Canvas::OAuth::ClientCredentials::AsymmetricProvider.new(
            raw_jwt,
            host,
            scopes: scopes_from_opts(opts),
            protocol:
          )
        end

        client_id = opts[:client_id]
        key = key_for(client_id)

        if key&.site_admin_service_auth?
          return Canvas::OAuth::ClientCredentials::ServiceUser::SymmetricProvider.new(
            client_id,
            host,
            scopes: scopes_from_opts(opts),
            protocol:,
            key:,
            root_account:
          )
        end

        Canvas::OAuth::ClientCredentials::SymmetricProvider.new(client_id, host, scopes: scopes_from_opts(opts), protocol:)
      end

      def key_for(client_id)
        DeveloperKey.find_cached(client_id)
      rescue ::ActiveRecord::RecordNotFound
        nil
      end

      def validate_type
        unless @provider.assertion_method_permitted?
          raise Canvas::OAuth::InvalidRequestError, "assertion method not supported for this grant_type"
        end

        raise Canvas::OAuth::InvalidRequestError, @provider.error_message unless @provider.valid?
        raise Canvas::OAuth::InvalidScopeError, @provider.missing_scopes unless @provider.valid_scopes?
      end

      def generate_token
        @provider.generate_token
      end

      def scopes_from_opts(opts)
        (opts[:scope] || opts[:scopes] || "").split
      end
    end
  end
end
