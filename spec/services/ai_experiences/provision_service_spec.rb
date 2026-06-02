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

describe AiExperiences::ProvisionService do
  let_once(:account) { account_model }
  let(:http_client) { instance_double(LlmConversation::HttpClient) }
  let(:service) { described_class.new }
  let(:enc_key) { LlmConversation::TokenCache::ENCRYPTION_KEY }
  let(:provision_response) do
    { "api_token" => "test-api-token", "refresh_token" => "test-refresh-token" }
  end
  let(:status_complete_response) { { "provision_status" => "COMPLETE" } }

  before do
    allow(LlmConversation::HttpClient).to receive(:new)
      .with(account:, use_initial_token: true)
      .and_return(http_client)
  end

  describe "#initiate_provisioning" do
    before do
      allow(http_client).to receive(:post)
        .with("/provision", payload: { root_account_id: account.root_account.uuid, audience: "canvas" })
        .and_return(provision_response)
    end

    it "uses the initial token http client" do
      service.initiate_provisioning(account)

      expect(LlmConversation::HttpClient).to have_received(:new).with(account:, use_initial_token: true)
    end

    it "raises ConversationError on API failure" do
      allow(http_client).to receive(:post)
        .and_raise(LlmConversation::Errors::ConversationError, "Service unavailable")

      expect { service.initiate_provisioning(account) }
        .to raise_error(LlmConversation::Errors::ConversationError, "Service unavailable")
    end
  end

  describe "#fetch_provision_status" do
    before do
      allow(http_client).to receive(:get)
        .with("/provision/status?root_account_id=#{account.uuid}")
        .and_return(status_complete_response)
    end

    it "returns the provision_status string from the response" do
      expect(service.fetch_provision_status(account)).to eq("COMPLETE")
    end

    it "raises ConversationError on API failure" do
      allow(http_client).to receive(:get)
        .and_raise(LlmConversation::Errors::ConversationError, "Service unavailable")

      expect { service.fetch_provision_status(account) }
        .to raise_error(LlmConversation::Errors::ConversationError, "Service unavailable")
    end
  end
end
