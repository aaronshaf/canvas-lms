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
      @base_url = resolve_base_url
      @root_account = account
      @v2_auth = account&.feature_enabled?(:ai_experiences_v2_auth)

      if use_initial_token && @root_account.present? && !@v2_auth
        raise LlmConversation::Errors::ConversationError,
              "Cannot use initial token: account does not have ai_experiences_v2_auth enabled"
      end

      @bearer_token = if use_initial_token
                        Rails.application.credentials.dig(:llm_conversation_service, :initial_token)
                      elsif @v2_auth
                        LlmConversation::TokenCache.get_api_token(@root_account)
                      else
                        Rails.application.credentials.llm_conversation_bearer_token
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

    def refresh_v2_token!
      enc = @root_account.settings.dig(:llm_conversation_service, :encrypted_refresh_jwt_token)
      salt = @root_account.settings.dig(:llm_conversation_service, :encrypted_refresh_jwt_token_salt)
      raise LlmConversation::Errors::ConversationError, "No refresh token available for account" unless enc && salt

      refresh_token = Canvas::Security.decrypt_password(enc, salt, LlmConversation::TokenCache::ENCRYPTION_KEY)

      uri = URI("#{@base_url}/token/refresh")
      http = Net::HTTP.new(uri.host, uri.port)
      if uri.scheme.casecmp?("https")
        http.use_ssl = true
        http.verify_mode = OpenSSL::SSL::VERIFY_PEER
      end

      req = Net::HTTP::Post.new(uri.request_uri,
                                "Content-Type" => "application/json",
                                "Authorization" => "Bearer #{refresh_token}")

      response = http.request(req)
      raise LlmConversation::Errors::ConversationError, "Token refresh failed" unless response.is_a?(Net::HTTPSuccess)

      result = JSON.parse(response.body)
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

    def resolve_base_url
      region = ApplicationController.region
      test_cluster = ApplicationController.test_cluster_name

      url = if test_cluster.present? && region.present?
              Setting.get("llm_conversation_base_url_beta_#{region}", nil)
            elsif region.present?
              Setting.get("llm_conversation_base_url_#{region}", nil)
            else
              Setting.get("llm_conversation_base_url", nil)
            end

      raise LlmConversation::Errors::ConversationError, base_url_error_message(region, test_cluster) if url.nil?

      url
    end

    def base_url_error_message(region, test_cluster)
      if test_cluster.present? && region.present?
        "None of llm_conversation_base_url_beta_#{region}, llm_conversation_base_url_#{region}, or llm_conversation_base_url setting is configured"
      elsif region.present?
        "Neither llm_conversation_base_url_#{region} nor llm_conversation_base_url setting is configured"
      else
        "llm_conversation_base_url setting is not configured"
      end
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
        if response.is_a?(Net::HTTPUnauthorized) && @v2_auth && !retried
          refresh_v2_token!
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
