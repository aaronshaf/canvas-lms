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
    # JWT assertion provider for non-LTI API keys (client_credentials_audience == "external").
    class AsymmetricProvider < Provider
      def initialize(jwt, host, scopes: nil, protocol: "http://", root_account: nil)
        @assertion = Canvas::OAuth::ClientAssertion.new(jwt, **assertion_options(host, protocol))
        super(@assertion.client_id, host, scopes:, protocol:, key: @assertion.key, root_account:)
      end

      delegate :valid?, :error_message, to: :@assertion

      def assertion_method_permitted?
        key&.client_credentials_audience == "external"
      end

      protected

      def assertion_options(host, protocol)
        {
          expected_aud: token_url(host, protocol),
          skip_jti_check: false,
          require_iss: true
        }
      end
    end
  end
end
