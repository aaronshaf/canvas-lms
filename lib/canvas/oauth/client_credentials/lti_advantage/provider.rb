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
  module ClientCredentials
    module LtiAdvantage
      # LTI Advantage JWT assertion provider. Accepts both the token URL and
      # the LTI OIDC auth domain as valid audiences.
      class Provider < Canvas::OAuth::ClientCredentials::Provider
        def initialize(jwt, host, scopes: nil, protocol: "http://")
          issued_aud = [token_url(host, protocol), Lti::Oidc.auth_domain(host)].compact
          @assertion = Canvas::OAuth::ClientAssertion.new(
            jwt,
            expected_aud: issued_aud,
            skip_jti_check: true,
            require_iss: true
          )
          super(@assertion.client_id, host, scopes:, protocol:, key: @assertion.key)
        end

        delegate :valid?, :error_message, to: :@assertion

        def assertion_method_permitted?
          true
        end
      end
    end
  end
end
