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
#

module PlatformTokens
  module Token
    module Concerns
      module Serialization
        def to_jwt
          raise InvalidTokenError, errors.full_messages.join(", ") unless valid?

          signing_key = PlatformTokens.configuration.signing_key
          jwk = signing_key.is_a?(Hash) ? JSON::JWK.new(signing_key) : signing_key
          JSON::JWT.new(to_h).sign(jwk, :RS256).to_s
        rescue PlatformTokens::Error
          raise
        rescue => e
          raise PlatformTokens::Error, "#{e.class}: #{e.message}"
        end
        alias_method :to_s, :to_jwt

        private

        def to_h
          {
            aud:,
            azp:,
            env:,
            exp: exp.to_i,
            iat: iat.to_i,
            iss:,
            jti:,
            nbf: nbf.to_i,
            org:,
            region:,
            scope: scope.join(" "),
            sub:
          }.compact
        end
      end
    end
  end
end
