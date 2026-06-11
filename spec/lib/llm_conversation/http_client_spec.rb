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

require "webmock/rspec"

describe LlmConversation::HttpClient do
  let_once(:account) { account_model }
  let(:enc_key) { LlmConversation::TokenCache::ENCRYPTION_KEY }

  before do
    allow(Rails.application.credentials).to receive(:dig)
      .with(:llm_conversation_service, :base_url)
      .and_return("https://llm.test")
    allow(Rails.application.credentials).to receive(:dig)
      .with(:llm_conversation_service, :initial_token)
      .and_return("initial-token")

    api_enc, api_salt = Canvas::Security.encrypt_password("api-token", enc_key)
    refresh_enc, refresh_salt = Canvas::Security.encrypt_password("refresh-token", enc_key)
    account.settings[:llm_conversation_service] = {
      encrypted_api_jwt_token: api_enc,
      encrypted_api_jwt_token_salt: api_salt,
      encrypted_refresh_jwt_token: refresh_enc,
      encrypted_refresh_jwt_token_salt: refresh_salt
    }
    account.save!
    allow(LlmConversation::TokenCache).to receive(:get_api_token).with(account).and_return("api-token")
    allow(LlmConversation::TokenCache).to receive(:set_api_token)
  end

  describe "V2 auth 401 token refresh" do
    let(:client) { described_class.new(account:) }

    context "when the request returns 401 and refresh succeeds" do
      let(:refresh_response) do
        { "api_token" => "new-api-token", "refresh_token" => "new-refresh-token" }.to_json
      end

      before do
        stub_request(:get, "https://llm.test/conversations")
          .to_return(
            { status: 401, body: "Unauthorized" },
            { status: 200, body: { "data" => [] }.to_json, headers: { "Content-Type" => "application/json" } }
          )
        stub_request(:post, "https://llm.test/token/refresh")
          .with(
            headers: { "Authorization" => "Bearer initial-token" },
            body: { refresh_token: "refresh-token" }.to_json
          )
          .to_return(status: 200, body: refresh_response, headers: { "Content-Type" => "application/json" })
      end

      it "retries the original request and returns the result" do
        result = client.get("/conversations")
        expect(result).to eql({ "data" => [] })
      end

      it "persists the new tokens to account settings encrypted" do
        client.get("/conversations")
        account.reload

        new_api_enc = account.settings.dig(:llm_conversation_service, :encrypted_api_jwt_token)
        new_api_salt = account.settings.dig(:llm_conversation_service, :encrypted_api_jwt_token_salt)
        expect(Canvas::Security.decrypt_password(new_api_enc, new_api_salt, enc_key)).to eql("new-api-token")

        new_refresh_enc = account.settings.dig(:llm_conversation_service, :encrypted_refresh_jwt_token)
        new_refresh_salt = account.settings.dig(:llm_conversation_service, :encrypted_refresh_jwt_token_salt)
        expect(Canvas::Security.decrypt_password(new_refresh_enc, new_refresh_salt, enc_key)).to eql("new-refresh-token")
      end

      it "writes the new api token to the cache" do
        client.get("/conversations")
        expect(LlmConversation::TokenCache).to have_received(:set_api_token).with(account, "new-api-token")
      end
    end

    context "when in a beta environment" do
      before do
        allow(ApplicationController).to receive_messages(test_cluster?: true, test_cluster_name: "beta")
      end

      context "when the request returns 401 and regeneration succeeds" do
        let(:regenerate_response) do
          { "api_token" => "new-api-token", "refresh_token" => "new-refresh-token" }.to_json
        end

        before do
          stub_request(:get, "https://llm.test/conversations")
            .to_return(
              { status: 401, body: "Unauthorized" },
              { status: 200, body: { "data" => [] }.to_json, headers: { "Content-Type" => "application/json" } }
            )
          stub_request(:post, "https://llm.test/token/generate")
            .with(
              headers: { "Authorization" => "Bearer initial-token" },
              body: { root_account_id: account.uuid, audience: "canvas" }.to_json
            )
            .to_return(status: 200, body: regenerate_response, headers: { "Content-Type" => "application/json" })
        end

        it "calls /token/generate instead of /token/refresh" do
          client.get("/conversations")
          expect(WebMock).to have_requested(:post, "https://llm.test/token/generate").once
          expect(WebMock).not_to have_requested(:post, "https://llm.test/token/refresh")
        end

        it "retries the original request and returns the result" do
          result = client.get("/conversations")
          expect(result).to eql({ "data" => [] })
        end

        it "persists the new tokens to account settings encrypted" do
          client.get("/conversations")
          account.reload

          new_api_enc = account.settings.dig(:llm_conversation_service, :encrypted_api_jwt_token)
          new_api_salt = account.settings.dig(:llm_conversation_service, :encrypted_api_jwt_token_salt)
          expect(Canvas::Security.decrypt_password(new_api_enc, new_api_salt, enc_key)).to eql("new-api-token")

          new_refresh_enc = account.settings.dig(:llm_conversation_service, :encrypted_refresh_jwt_token)
          new_refresh_salt = account.settings.dig(:llm_conversation_service, :encrypted_refresh_jwt_token_salt)
          expect(Canvas::Security.decrypt_password(new_refresh_enc, new_refresh_salt, enc_key)).to eql("new-refresh-token")
        end

        it "writes the new api token to the cache" do
          client.get("/conversations")
          expect(LlmConversation::TokenCache).to have_received(:set_api_token).with(account, "new-api-token")
        end
      end

      context "when the regenerate endpoint itself fails" do
        before do
          stub_request(:get, "https://llm.test/conversations").to_return(status: 401, body: "Unauthorized")
          stub_request(:post, "https://llm.test/token/generate").to_return(status: 500, body: "Error")
        end

        it "raises a ConversationError" do
          expect { client.get("/conversations") }
            .to raise_error(LlmConversation::Errors::ConversationError, /Token regeneration failed/)
        end
      end
    end

    context "when the refresh token is missing from account settings" do
      before do
        account.settings[:llm_conversation_service] = {}
        account.save!
        stub_request(:get, "https://llm.test/conversations").to_return(status: 401, body: "Unauthorized")
      end

      it "raises a ConversationError" do
        expect { client.get("/conversations") }
          .to raise_error(LlmConversation::Errors::ConversationError, /No refresh token available/)
      end
    end

    context "when the refresh endpoint itself fails" do
      before do
        stub_request(:get, "https://llm.test/conversations").to_return(status: 401, body: "Unauthorized")
        stub_request(:post, "https://llm.test/token/refresh").to_return(status: 500, body: "Error")
      end

      it "raises a ConversationError" do
        expect { client.get("/conversations") }
          .to raise_error(LlmConversation::Errors::ConversationError, /Token refresh failed/)
      end
    end

    context "when the retried request also returns 401" do
      let(:refresh_response) do
        { "api_token" => "new-api-token", "refresh_token" => "new-refresh-token" }.to_json
      end

      before do
        stub_request(:get, "https://llm.test/conversations")
          .to_return(
            { status: 401, body: "Unauthorized" },
            { status: 401, body: "Still unauthorized" }
          )
        stub_request(:post, "https://llm.test/token/refresh")
          .to_return(status: 200, body: refresh_response, headers: { "Content-Type" => "application/json" })
      end

      it "raises ConversationError without recursing into a second refresh" do
        expect { client.get("/conversations") }
          .to raise_error(LlmConversation::Errors::ConversationError)
        expect(WebMock).to have_requested(:post, "https://llm.test/token/refresh").once
        expect(WebMock).to have_requested(:get, "https://llm.test/conversations").twice
      end
    end
  end

  describe "llma error sanitization" do
    let(:client) { described_class.new(account:) }

    context "when llma returns 5xx with internal diagnostics in the body" do
      let(:leaky_body) do
        {
          "message" => "audience mismatch for account uuid abc-123 at /usr/src/app/lib/auth.rb:42",
          "stack" => "Traceback (most recent call last)..."
        }.to_json
      end

      before do
        stub_request(:get, "https://llm.test/conversations")
          .to_return(status: 500, body: leaky_body, headers: { "Content-Type" => "application/json" })
        allow(Rails.logger).to receive(:warn)
      end

      it "raises ConversationError with a generic user_message (never the llma body)" do
        client.get("/conversations")
      rescue LlmConversation::Errors::ConversationError => e
        expect(e.user_message).to eq(LlmConversation::Errors::ConversationError::DEFAULT_USER_MESSAGE)
        expect(e.user_message).not_to include("audience mismatch")
        expect(e.user_message).not_to include("/usr/src/app")
        expect(e.user_message).not_to include("Traceback")
      else
        raise "expected ConversationError to be raised"
      end

      it "preserves the internal detail on #message for logs/Sentry" do
        client.get("/conversations")
      rescue LlmConversation::Errors::ConversationError => e
        expect(e.message).to include("audience mismatch")
      end

      it "logs the verbatim llma body at warn level" do
        expect { client.get("/conversations") }
          .to raise_error(LlmConversation::Errors::ConversationError)
        expect(Rails.logger).to have_received(:warn).with(a_string_including("audience mismatch"))
      end
    end

    context "when llma returns a whitelisted error code" do
      before do
        stub_request(:get, "https://llm.test/conversations")
          .to_return(
            status: 429,
            body: { "code" => "rate_limited", "message" => "internal rate-limit counter overflow" }.to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end

      it "renders the friendly user_message for the whitelisted code" do
        client.get("/conversations")
      rescue LlmConversation::Errors::ConversationError => e
        expect(e.user_message)
          .to eq(LlmConversation::Errors::ConversationError::SAFE_USER_MESSAGES["rate_limited"])
        expect(e.user_message).not_to include("internal rate-limit counter overflow")
      end
    end

    context "when llma returns an unknown error code" do
      before do
        stub_request(:get, "https://llm.test/conversations")
          .to_return(
            status: 400,
            body: { "code" => "some_new_code_we_dont_recognize", "message" => "boom" }.to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end

      it "falls back to the generic user_message rather than echoing the unknown code's message" do
        client.get("/conversations")
      rescue LlmConversation::Errors::ConversationError => e
        expect(e.user_message).to eq(LlmConversation::Errors::ConversationError::DEFAULT_USER_MESSAGE)
        expect(e.user_message).not_to include("boom")
      end
    end
  end

  describe "base_url from credentials" do
    it "uses the base_url from Rails credentials" do
      stub_request(:get, "https://llm.test/ping").to_return(status: 200, body: "null")
      client = described_class.new(account:)
      client.get("/ping")
      expect(WebMock).to have_requested(:get, "https://llm.test/ping")
    end

    it "raises when the credential is not set" do
      allow(Rails.application.credentials).to receive(:dig)
        .with(:llm_conversation_service, :base_url)
        .and_return(nil)
      expect { described_class.new(account:).get("/ping") }
        .to raise_error(StandardError)
    end
  end
end
