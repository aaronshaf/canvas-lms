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

require_relative "concerns/validation"
require_relative "concerns/serialization"

module PlatformTokens
  module Token
    class Base
      include ActiveModel::Validations
      include Concerns::Validation
      include Concerns::Serialization

      CLAIMS = %i[aud azp env exp iat iss jti nbf org region scope sub].freeze
      CLOCK_SKEW_BUFFER = 30.seconds

      MAX_TTL = 1.hour
      DEFAULT_TTL = 1.hour

      attr_reader(*CLAIMS)
      private attr_writer(*CLAIMS)

      validates(*CLAIMS, presence: true)
      validate :exp_not_elapsed
      validate :nbf_not_future
      validate :timestamp_order
      validate :env_matches_configuration

      def initialize(aud:, sub:, org:, azp:, scope:)
        self.aud   = Array(aud)
        self.sub   = sub
        self.org   = org
        self.azp   = azp
        self.scope = scope.is_a?(Array) ? scope : scope.split

        set_jti_claim
        set_static_claims
        set_timestamp_claims
      end

      private

      def set_jti_claim
        self.jti = SecureRandom.uuid
      end

      def set_static_claims
        self.env = PlatformTokens.configuration.env
        self.iss = PlatformTokens.configuration.iss
        self.region = PlatformTokens.configuration.region
      end

      def set_timestamp_claims
        self.iat = Time.now.utc
        self.nbf = iat - CLOCK_SKEW_BUFFER
        self.exp = iat + ttl
      end

      def ttl
        raise NotImplementedError, "#{self.class} must implement #ttl"
      end
    end
  end
end
