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

module AiExperiences
  class ProvisionService
    def initiate_provisioning(root_account)
      @client = LlmConversation::HttpClient.new(account: root_account, use_initial_token: true)
      api_refresh_tokens = call_provision_api(root_account)

      save_to_account_settings(root_account, api_refresh_tokens)
    end

    def fetch_provision_status(root_account)
      @client ||= LlmConversation::HttpClient.new(account: root_account, use_initial_token: true)
      response = @client.get("/provision/status?root_account_id=#{root_account.uuid}")
      response["provision_status"]
    end

    private

    def call_provision_api(root_account)
      payload = {
        root_account_id: root_account.uuid,
        audience: "canvas"
      }
      @client.post("/provision", payload:)
    end

    def save_to_account_settings(root_account, api_refresh_tokens)
      api_enc, api_salt = Canvas::Security.encrypt_password(api_refresh_tokens["api_token"], LlmConversation::TokenCache::ENCRYPTION_KEY)
      refresh_enc, refresh_salt = Canvas::Security.encrypt_password(api_refresh_tokens["refresh_token"], LlmConversation::TokenCache::ENCRYPTION_KEY)

      root_account.settings[:llm_conversation_service] = {
        encrypted_api_jwt_token: api_enc,
        encrypted_api_jwt_token_salt: api_salt,
        encrypted_refresh_jwt_token: refresh_enc,
        encrypted_refresh_jwt_token_salt: refresh_salt,
        provision_complete: false
      }
      root_account.save!

      LlmConversation::TokenCache.set_api_token(root_account, api_refresh_tokens["api_token"])
    end
  end
end
