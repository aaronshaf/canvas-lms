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
  class ClientAssertion
    include ActiveModel::Validations

    attr_reader :client_id, :key, :decoded

    def self.unverified_key_for(jws)
      return nil if jws.blank?

      sub = JSON::JWT.decode(jws, :skip_verification)[:sub]
      DeveloperKey.find_cached(sub)
    rescue JSON::JWT::Exception, JSON::ParserError, ActiveRecord::RecordNotFound
      nil
    end

    def initialize(jws, expected_aud:, skip_jti_check: false, require_iss: true, expected_client_id: nil)
      @jws                = jws
      @expected_aud       = expected_aud
      @skip_jti_check     = skip_jti_check
      @require_iss        = require_iss
      @expected_client_id = expected_client_id
      @decoded            = nil
      @client_id          = unverified_sub
      @key                = find_developer_key
    end

    def valid?(context = nil)
      return @valid if defined?(@valid)

      @valid = super && decoded.present?
    end

    def error_message
      return nil if valid?

      errors.full_messages.first || "JWS signature invalid."
    end

    private

    attr_reader :jws, :expected_aud, :skip_jti_check, :require_iss, :expected_client_id

    validate :perform_validation

    def perform_validation
      @decoded = nil

      if expected_client_id.present? && client_id.to_s != expected_client_id.to_s
        errors.add(:base, "client_id does not match assertion subject")
        return
      end

      return if key.nil? || (key.public_jwk.nil? && key.public_jwk_url.nil?)

      @decoded = decode_and_verify(key)
      validate_claims! if decoded
    rescue JSON::JWT::Exception,
           JSON::JWS::VerificationFailed,
           JSON::JWS::UnexpectedAlgorithm,
           JSON::ParserError,
           *CanvasHttp::ALL_HTTP_ERRORS,
           EOFError => e
      add_jws_error(e)
      @decoded = nil
    end

    def add_jws_error(err)
      Rails.logger.warn("ClientAssertion verification failed for key #{client_id}: #{err.class}: #{err.message}")
      message = case err
                when JSON::ParserError
                  "JWK Error: Invalid JSON"
                when *CanvasHttp::ALL_HTTP_ERRORS, EOFError
                  "JWK Error: Failed to fetch public key"
                else
                  err.message
                end
      errors.add(:base, message)
    end

    def validate_claims!
      validator = Canvas::Security::JwtValidator.new(
        jwt: decoded,
        expected_aud:,
        full_errors: true,
        require_iss:,
        skip_jti_check:
      )
      unless validator.valid?
        errors.add(:base, validator.error_message)
        @decoded = nil
      end
    end

    def unverified_sub
      return nil if jws.blank?

      JSON::JWT.decode(jws, :skip_verification)[:sub]
    rescue JSON::JWT::Exception, JSON::ParserError
      nil
    end

    def find_developer_key
      return nil unless client_id

      DeveloperKey.find_cached(client_id)
    rescue ActiveRecord::RecordNotFound
      nil
    end

    def decode_and_verify(key)
      if key.public_jwk_url.present?
        # Not caching the JWKs (for now)
        InstrumentTLSCiphers.without_tls_metrics do
          pub_jwk = CanvasHttp.get(key.public_jwk_url)
          JSON::JWT.decode(jws, JSON::JWK::Set.new(JSON.parse(pub_jwk.body)), :RS256)
        end
      else
        # .to_key bypasses kid lookup — Canvas stores one JWK per developer key
        JSON::JWT.decode(jws, JSON::JWK.new(key.public_jwk).to_key, :RS256)
      end
    end
  end
end
