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
      # Abstract base for site-admin service-user providers (both symmetric and
      # asymmetric). Subclasses implement valid? and error_message; this class
      # provides token issuance and scope handling common to both variants.
      class Provider < Canvas::OAuth::ClientCredentials::Provider
        def assertion_method_permitted?
          true
        end

        def generate_token
          {
            access_token: token.to_unencrypted_token_string,
            token_type: "Bearer",
            expires_in: token.jwt_payload[:exp] - token.jwt_payload[:iat],
          }
        end

        def valid_scopes?
          # Service-user access is granted by user permissions, not by OAuth scopes
          return true if @scopes.blank?

          super
        end

        private

        def token
          @token ||= InstAccess::Token.for_user(
            user_uuid: key.service_user.uuid,
            account_uuid: root_account.uuid,
            canvas_domain: host,
            user_global_id: key.service_user.global_id,
            region: ApplicationController.region,
            client_id: key.global_id,
            instructure_service: key.internal_service?
          )
        end
      end
    end
  end
end
