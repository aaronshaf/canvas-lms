# frozen_string_literal: true

#
# Copyright (C) 2024 - present Instructure, Inc.
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
  class PKCE
    KEY_PREFIX = "oauth2/pkce:"
    KEY_TTL = 10.minutes.to_i
    REQUIRED_PARAMS = %i[code_challenge code_challenge_method].freeze
    SUPPORTED_METHODS = %w[S256].freeze

    class << self
      # Determines whether PKCE (Proof Key for Code Exchange) should be used in the authorization request.
      #
      # @param options [Hash] The options hash that may contain the PKCE params.
      #
      # @return [Boolean] Returns true if PKCE params present and supported, false otherwise.
      def use_pkce_in_authorization?(options)
        return false if options.blank?

        params_present = options.keys & REQUIRED_PARAMS == REQUIRED_PARAMS
        params_present && valid_code_verifier_method?(options[:code_challenge_method])
      end

      # Determines whether PKCE (Proof Key for Code Exchange) should be used in the token request.
      #
      # @param options [Hash] The options hash that may contain the :code_verifier key.
      #
      # @return [Boolean] Returns true if PKCE should be used, false otherwise.
      def use_pkce_in_token?(options)
        return false if options.blank?

        options.include? :code_verifier
      end

      # Whether a code_challenge is currently stored for this authorization
      # code (i.e. the code was created with PKCE). See store_code_challenge
      # for how we store the challenge code.
      #
      # @param code [String] the authorization code
      # @return [Boolean] True if the code has a challenge stored with it;
      #         false otherwise.
      def code_has_challenge?(code)
        return false if code.blank?

        Canvas.redis.exists?("#{KEY_PREFIX}#{code}")
      end

      # Stores a code challenge in Redis with a specified time-to-live (TTL).
      # The key includes the authorization code so that the authorization code
      # may be validated against the code challenge during the token exchange.
      #
      # @param challenge [String] The code challenge to be stored.
      # @param code [String] The code associated with the challenge.
      #
      # @return [String] "OK" if the operation was successful.
      def store_code_challenge(challenge, code)
        Canvas.redis.setex("#{KEY_PREFIX}#{code}", KEY_TTL, challenge)
      end

      # Checks if the provided code verifier is valid by comparing it with
      # the stored code challenge. This method will delete the stored challenge
      # when it is called, so only call this method when we are going to accept
      # or reject the request.
      #
      # See https://datatracker.ietf.org/doc/html/rfc7636#appendix-B
      #
      # @param code [String] the code associated with the code challenge
      # @param code_verifier [String] the code verifier to be validated
      #
      # @return [Boolean] true if the code verifier is valid, false otherwise
      def valid_code_verifier?(code:, code_verifier:)
        return false if code_verifier.blank?

        code_challenge = fetch_code_challenge_for(code)

        return false if code_challenge.blank?

        sha256_hash = Digest::SHA256.digest(code_verifier)
        Base64.urlsafe_encode64(sha256_hash, padding: false) == code_challenge
      end

      private

      def valid_code_verifier_method?(method)
        SUPPORTED_METHODS.include? method.to_s
      end

      def fetch_code_challenge_for(code)
        challenge = Canvas.redis.get("#{KEY_PREFIX}#{code}")
        Canvas.redis.del("#{KEY_PREFIX}#{code}")

        challenge
      end
    end
  end
end
