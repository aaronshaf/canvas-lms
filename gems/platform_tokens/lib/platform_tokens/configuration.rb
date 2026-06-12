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

require "logger"

module PlatformTokens
  class Configuration
    include ActiveModel::Validations

    VALUE_ATTRIBUTES = %i[access_token_ttl_seconds env iss region].freeze
    KEY_PROVIDERS = %i[signing_key verification_jwks].freeze

    # Dynamic readers that support lazy evaluation via proc
    #
    # @!method access_token_ttl_seconds
    #   @return [Integer] lifetime, in seconds, applied to issued access tokens
    # @!method env
    #   @return [String] environment claim stamped onto issued tokens
    # @!method iss
    #   @return [String] issuer claim stamped onto issued tokens
    # @!method region
    #   @return [String] region claim stamped onto issued tokens
    # @!method signing_key
    #   @return [Hash, JSON::JWK] key material used to sign issued tokens
    # @!method verification_jwks
    #   @return [Hash, JSON::JWK] JWK set used to verify inbound tokens
    (VALUE_ATTRIBUTES + KEY_PROVIDERS).each do |attr|
      define_method(attr) do
        val = instance_variable_get(:"@#{attr}")
        val.respond_to?(:call) ? val.call : val
      end
    end

    attr_reader :logger
    private attr_writer(*VALUE_ATTRIBUTES, *KEY_PROVIDERS, :logger)

    validates :access_token_ttl_seconds,
              numericality: { greater_than: 0, less_than_or_equal_to: ->(_) { Token::Base::MAX_TTL.to_i } }
    validate :value_attributes_assigned

    def initialize(env:, iss:, region:, signing_key:, access_token_ttl_seconds: nil, verification_jwks: nil, logger: nil)
      self.access_token_ttl_seconds = access_token_ttl_seconds || Token::Base::DEFAULT_TTL
      self.env = env
      self.iss = iss
      self.region = region
      self.signing_key = signing_key
      self.verification_jwks = verification_jwks
      self.logger = logger || Logger.new($stdout)
    end

    private

    def value_attributes_assigned
      VALUE_ATTRIBUTES.each do |attr|
        errors.add(attr, :blank) if instance_variable_get(:"@#{attr}").nil?
      end
    end
  end
end
