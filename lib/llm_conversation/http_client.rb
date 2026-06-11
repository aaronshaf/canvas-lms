# frozen_string_literal: true

#
# Copyright (C) 2025 - present Instructure, Inc.
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

require "net/http"
require "json"
require "uri"

module LlmConversation
  class HttpClient
    def initialize(account: nil, use_initial_token: false)
      @root_account = account
      @base_url = Rails.application.credentials.dig(:llm_conversation_service, :base_url)

      @bearer_token = if use_initial_token
                        Rails.application.credentials.dig(:llm_conversation_service, :initial_token)
                      else
                        LlmConversation::TokenCache.get_api_token(@root_account)
                      end
    end

    def get(path)
      request(:get, path)
    end

    def post(path, payload: nil)
      request(:post, path, payload:)
    end

    def patch(path, payload: nil)
      request(:patch, path, payload:)
    end

    def delete(path)
      request(:delete, path)
    end

    private

    def refresh_token
      # This is a temporary "beta" check condition while we investigate a proper solution
      #
      # Right now we store api / refresh credentials in Account Settings, but when beta refresh
      # occurs those tokens are truncated with values from production. Since Production and Beta
      # are provisioned independently, this causes an issue with invalid API and Refresh tokens
      # and causes the account to be locked out.
      #
      # To band-aid this for now, we will regenerate a token pair if attempting to a refresh API token
      # in beta environments. Once a proper solution is found this condition below will be removed
      #
      # https://instructure.atlassian.net/browse/LLMA-394
      result = if ApplicationController.test_cluster?
                 regenerate_token_pair
               else
                 fetch_refreshed_token_pair
               end

      new_api_token = result["api_token"]
      new_refresh_token = result["refresh_token"]

      api_enc, api_salt = Canvas::Security.encrypt_password(new_api_token, LlmConversation::TokenCache::ENCRYPTION_KEY)
      refresh_enc, refresh_salt = Canvas::Security.encrypt_password(new_refresh_token, LlmConversation::TokenCache::ENCRYPTION_KEY)

      @root_account.settings[:llm_conversation_service] = {
        encrypted_api_jwt_token: api_enc,
        encrypted_api_jwt_token_salt: api_salt,
        encrypted_refresh_jwt_token: refresh_enc,
        encrypted_refresh_jwt_token_salt: refresh_salt
      }
      @root_account.save!

      LlmConversation::TokenCache.set_api_token(@root_account, new_api_token)
      @bearer_token = new_api_token
    end

    def regenerate_token_pair
      initial_token = Rails.application.credentials.dig(:llm_conversation_service, :initial_token)

      uri = URI("#{@base_url}/token/generate")
      http = Net::HTTP.new(uri.host, uri.port)
      if uri.scheme.casecmp?("https")
        http.use_ssl = true
        http.verify_mode = OpenSSL::SSL::VERIFY_PEER
      end

      req = Net::HTTP::Post.new(uri.request_uri,
                                "Content-Type" => "application/json",
                                "Authorization" => "Bearer #{initial_token}")
      req.body = { root_account_id: @root_account.uuid, audience: "canvas" }.to_json

      response = http.request(req)
      raise LlmConversation::Errors::ConversationError, "Token regeneration failed" unless response.is_a?(Net::HTTPSuccess)

      JSON.parse(response.body)
    end

    def fetch_refreshed_token_pair
      enc = @root_account.settings.dig(:llm_conversation_service, :encrypted_refresh_jwt_token)
      salt = @root_account.settings.dig(:llm_conversation_service, :encrypted_refresh_jwt_token_salt)
      raise LlmConversation::Errors::ConversationError, "No refresh token available for account" unless enc && salt

      refresh_token = Canvas::Security.decrypt_password(enc, salt, LlmConversation::TokenCache::ENCRYPTION_KEY)
      initial_token = Rails.application.credentials.dig(:llm_conversation_service, :initial_token)

      uri = URI("#{@base_url}/token/refresh")
      http = Net::HTTP.new(uri.host, uri.port)
      if uri.scheme.casecmp?("https")
        http.use_ssl = true
        http.verify_mode = OpenSSL::SSL::VERIFY_PEER
      end

      req = Net::HTTP::Post.new(uri.request_uri,
                                "Content-Type" => "application/json",
                                "Authorization" => "Bearer #{initial_token}")
      req.body = { refresh_token: }.to_json

      response = http.request(req)
      raise LlmConversation::Errors::ConversationError, "Token refresh failed" unless response.is_a?(Net::HTTPSuccess)

      JSON.parse(response.body)
    end

    def request(method, path, payload: nil, retried: false)
      raise LlmConversation::Errors::ConversationError, "Bearer token not configured for LLM Conversation Service" if @bearer_token.nil?

      uri = URI("#{@base_url}#{path}")
      http = Net::HTTP.new(uri.host, uri.port)

      if uri.scheme.casecmp?("https")
        http.use_ssl = true
        http.verify_mode = OpenSSL::SSL::VERIFY_PEER
      end

      headers = {
        "Content-Type" => "application/json",
        "Authorization" => "Bearer #{@bearer_token}"
      }

      req = case method
            when :get
              Net::HTTP::Get.new(uri.request_uri, headers)
            when :post
              r = Net::HTTP::Post.new(uri.request_uri, headers)
              r.body = payload.to_json if payload
              r
            when :patch
              r = Net::HTTP::Patch.new(uri.request_uri, headers)
              r.body = payload.to_json if payload
              r
            when :delete
              Net::HTTP::Delete.new(uri.request_uri, headers)
            end

      response = http.request(req)

      unless response.is_a?(Net::HTTPSuccess)
        if response.is_a?(Net::HTTPUnauthorized) && !retried
          refresh_token
          return request(method, path, payload:, retried: true)
        end

        llma_code = nil
        begin
          error_json = JSON.parse(response.body)
          if error_json.is_a?(Hash)
            error_detail = error_json["message"] || error_json["error"] || response.body
            llma_code = error_json["code"]
          else
            error_detail = response.body
          end
        rescue JSON::ParserError
          error_detail = response.body
        end

        Rails.logger.warn(
          "[llm_conversation] HTTP #{response.code} from llma #{method.to_s.upcase} #{path}: #{response.body.to_s[0, 1000]}"
        )

        raise LlmConversation::Errors::ConflictError, error_detail if response.is_a?(Net::HTTPConflict)

        raise LlmConversation::Errors::ConversationError.new(
          error_detail,
          user_message: LlmConversation::Errors::ConversationError::SAFE_USER_MESSAGES[llma_code]
        )
      end

      response.body.present? ? JSON.parse(response.body) : nil
    rescue LlmConversation::Errors::ConversationError
      raise
    rescue Timeout::Error,
           SocketError,
           SystemCallError,
           OpenSSL::SSL::SSLError,
           JSON::ParserError,
           EOFError,
           Net::HTTPBadResponse,
           Net::ProtocolError => e
      raise LlmConversation::Errors::ConversationError, e.message
    end
  end
end
