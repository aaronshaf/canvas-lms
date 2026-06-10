# frozen_string_literal: true

module Canvas::OAuth
  module GrantTypes
    class BaseType
      include Canvas::OAuth::ResourceIndicators

      attr_reader :opts, :provider

      # TODO: INTEROP-10672 — accept both vanity and canonical aud
      def initialize(client_id, secret, opts, host: nil, protocol: "http://")
        @secret = secret
        @opts = opts

        if host && jwt_bearer_assertion?
          expected_aud = Rails.application.routes.url_helpers.oauth2_token_url(host:, protocol:)
          @jwt_assertion = Canvas::OAuth::ClientAssertion.new(
            opts[:client_assertion],
            expected_aud:,
            expected_client_id: client_id.presence
          )
          client_id = @jwt_assertion.client_id
        end

        @provider = Canvas::OAuth::Provider.new(client_id, key: @jwt_assertion&.key)
      end

      def token
        validate_client_authentication
        validate_type
        generate_token
      end

      # Unless otherwise specified by a sub-class, don't
      # allow public clients as defined in RFC 6749.
      def allow_public_client?
        false
      end

      def supported_type?
        false
      end

      private

      def validate_client_authentication
        raise Canvas::OAuth::RequestError, :invalid_client_id unless @provider.has_valid_key?

        if @jwt_assertion
          raise Canvas::OAuth::RequestError, :invalid_jwt_assertion unless @jwt_assertion.valid?

          return
        end

        return if allow_public_client? && @provider.key&.public_client? && @secret.blank?
        raise Canvas::OAuth::RequestError, :invalid_client_secret unless @provider.is_authorized_by?(@secret)
      end

      def jwt_bearer_assertion?
        @opts[:client_assertion_type] == "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
      end

      def validate_type
        raise "Abstract Method"
      end

      def generate_token
        raise "Abstract Method"
      end

      def validate_resource
        resources = normalize_resource(@opts[:resource])
        return if resources.empty?

        raise Canvas::OAuth::RequestError, :invalid_target if provider.key.nil?

        resources.each do |resource|
          raise Canvas::OAuth::RequestError, :invalid_target unless valid_resource_uri?(resource)
          raise Canvas::OAuth::RequestError, :invalid_target unless valid_audience?(resource, provider.key)
        end
      end
    end
  end
end
