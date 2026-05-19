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

module Canvas::OAuth
  module ClientCredentials
    module ServiceUser
      # JWT assertion provider for site-admin service keys. Validates the JWT
      # assertion and checks that the key is a usable site_admin_service_auth
      # key with an active service_user, then issues an InstAccess token.
      class AsymmetricProvider < Canvas::OAuth::ClientCredentials::ServiceUser::Provider
        def initialize(jwt, host, scopes: nil, protocol: "http://", root_account: nil)
          @assertion = Canvas::OAuth::ClientAssertion.new(
            jwt,
            expected_aud: token_url(host, protocol),
            skip_jti_check: false,
            require_iss: true
          )
          super(@assertion.client_id, host, scopes:, protocol:, key: @assertion.key, root_account:)
        end

        def valid?
          return false unless @assertion.valid?
          return false unless key&.usable?
          return false unless key.site_admin_service_auth?
          return false if key.service_user.nil? || key.service_user.deleted? || key.service_user.suspended?

          true
        end

        def error_message
          return "Unknown client_id" if key.nil? || !key.usable?
          return "No active service user" if key.service_user.blank? || key.service_user.deleted? || key.service_user.suspended?
          return "Service authentication not enabled for this key" unless key.site_admin_service_auth?

          @assertion.error_message
        end
      end
    end
  end
end
