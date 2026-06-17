# frozen_string_literal: true

#
# Copyright (C) 2019 - present Instructure, Inc.
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

require_relative "../../controllers/lti/ims/concerns/advantage_services_shared_context"
require_relative "../../controllers/lti/ims/concerns/lti_services_shared_examples"

# rubocop:disable Rails/ResponseParsedBody
describe Lti::DataServicesController do
  include WebMock::API

  include_context "advantage services context"
  include_context "advantage access token context"

  let(:subscription) do
    {
      ContextId: root_account.uuid,
      ContextType: "root_account",
      EventTypes: ["discussion_topic_created"],
      Format: "live-event",
      TransportMetadata: { Url: "sqs.example" },
      TransportType: "sqs"
    }
  end

  def make_request(http_method, path, body = nil)
    send(http_method,
         path,
         params: body || {},
         as: :json,
         headers: {
           "Authorization" => "Bearer #{access_token_jwt}",
           "Host" => "test.host"
         })
  end

  def action_url_for(action, params_overrides)
    account_id = params_overrides[:account_id]
    id = params_overrides[:id]

    case action.to_sym
    when :show, :update, :destroy
      "/api/lti/accounts/#{account_id}/data_services/#{id}"
    when :create, :index
      "/api/lti/accounts/#{account_id}/data_services"
    end
  end

  def send_http
    url = action_url_for(action, params_overrides)
    headers = { "Host" => "test.host" }
    headers["Authorization"] = "Bearer #{access_token_jwt}" if access_token_jwt
    case request_method
    when :get, :delete
      send(request_method, url, headers:)
    when :post, :put
      body_params = (body_overrides || {}).merge(params_overrides.except(:account_id, :id))
      send(request_method,
           url,
           params: body_params,
           as: :json,
           headers:)
    end
  end

  def send_request
    send_http
  end

  before do
    # Configure the live-event-service host via fallback data
    @original_fallback = DynamicSettings.fallback_data
    DynamicSettings.fallback_data = {
      "config" => {
        "canvas" => {
          "live-events-subscription-service" => {
            "app-host" => "http://live-event-service"
          }
        }
      }
    }

    # Stub outbound HTTP calls via WebMock at the boundary
    stub_request(:post, "http://live-event-service/api/subscriptions").to_return do |request|
      body = JSON.parse(request.body)
      {
        status: 200,
        body: body.merge(Id: "testid").to_json,
        headers: { "Content-Type" => "application/json" }
      }
    end
    stub_request(:get, %r{http://live-event-service/api/subscriptions}).to_return do
      {
        status: 200,
        body: subscription.merge(Id: "testid").to_json,
        headers: { "Content-Type" => "application/json" }
      }
    end
    stub_request(:get, %r{http://live-event-service/api/root_account_subscriptions})
      .to_return(status: 200, body: [subscription.merge(Id: "testid")].to_json, headers: { "Content-Type" => "application/json" })
    stub_request(:put, %r{http://live-event-service/api/subscriptions}).to_return do |request|
      body = JSON.parse(request.body)
      {
        status: 200,
        body: body.merge(Id: body["Id"]).to_json,
        headers: { "Content-Type" => "application/json" }
      }
    end
    stub_request(:delete, %r{http://live-event-service/api/subscriptions})
      .to_return(status: 200, body: subscription.merge(Id: "testid").to_json, headers: { "Content-Type" => "application/json" })

    root_account.lti_context_id = SecureRandom.uuid
    root_account.save
  end

  after do
    DynamicSettings.fallback_data = @original_fallback
  end

  describe "#create" do
    let(:action) { :create }
    let(:request_method) { :post }

    it_behaves_like "lti services" do
      let(:expected_mime_type) { described_class::MIME_TYPE }
      let(:scope_to_remove) { "https://canvas.instructure.com/lti/data_services/scope/create" }
      let(:params_overrides) do
        { subscription:, account_id: root_account.lti_context_id }
      end
      let(:body_overrides) do
        { subscription: }
      end
    end

    context "with an installed tool" do
      it "adds OwnerId and OwnerType if passed in for a tool" do
        make_request(:post, "/api/lti/accounts/#{root_account.lti_context_id}/data_services", subscription:)
        expect(response).to have_http_status(:ok)
        expect(JSON.parse(response.body)["OwnerId"]).to eq(tool.global_id.to_s)
        expect(JSON.parse(response.body)["OwnerType"]).to eq("external_tool")
        expect(WebMock).to have_requested(:post, %r{http://live-event-service/api/subscriptions}).once
        expect(WebMock).not_to have_requested(:get, %r{http://live-event-service/api/subscriptions})
        expect(WebMock).not_to have_requested(:get, %r{http://live-event-service/api/root_account_subscriptions})
        expect(WebMock).not_to have_requested(:put, %r{http://live-event-service/api/subscriptions})
        expect(WebMock).not_to have_requested(:delete, %r{http://live-event-service/api/subscriptions})
      end

      context "without an installed tool" do
        before do
          tool.destroy
        end

        it "uses developer key for OwnerId" do
          make_request(:post, "/api/lti/accounts/#{root_account.lti_context_id}/data_services", subscription:)
          expect(response).to have_http_status(:ok)
          expect(JSON.parse(response.body)["OwnerId"]).to eq(developer_key.global_id.to_s)
          expect(JSON.parse(response.body)["OwnerType"]).to eq("internal_service")
          expect(WebMock).to have_requested(:post, %r{http://live-event-service/api/subscriptions}).once
          expect(WebMock).not_to have_requested(:get, %r{http://live-event-service/api/subscriptions})
          expect(WebMock).not_to have_requested(:get, %r{http://live-event-service/api/root_account_subscriptions})
          expect(WebMock).not_to have_requested(:put, %r{http://live-event-service/api/subscriptions})
          expect(WebMock).not_to have_requested(:delete, %r{http://live-event-service/api/subscriptions})
        end
      end
    end

    context "with a user owner" do
      let(:user) { account_admin_user(account: root_account) }

      it "adds OwnerId and OwnerType if passed in for a person" do
        make_request(:post,
                     "/api/lti/accounts/#{root_account.lti_context_id}/data_services",
                     subscription: subscription.merge(OwnerId: user.global_id.to_s))
        expect(response).to have_http_status(:ok)
        expect(JSON.parse(response.body)["OwnerId"]).to eq(user.global_id.to_s)
        expect(JSON.parse(response.body)["OwnerType"]).to eq("person")
        expect(WebMock).to have_requested(:post, %r{http://live-event-service/api/subscriptions}).once
        expect(WebMock).not_to have_requested(:get, %r{http://live-event-service/api/subscriptions})
        expect(WebMock).not_to have_requested(:get, %r{http://live-event-service/api/root_account_subscriptions})
        expect(WebMock).not_to have_requested(:put, %r{http://live-event-service/api/subscriptions})
        expect(WebMock).not_to have_requested(:delete, %r{http://live-event-service/api/subscriptions})
      end

      context "with non admin user" do
        let(:user) { user_model }

        it "raises an unprocessable_entity" do
          make_request(:post,
                       "/api/lti/accounts/#{root_account.lti_context_id}/data_services",
                       subscription: subscription.merge(OwnerId: user.global_id))
          expect(response).to have_http_status(:unprocessable_content)
          expect(WebMock).not_to have_requested(:post, %r{http://live-event-service/api/subscriptions})
        end
      end

      context "with not found user" do
        it "raises a 404" do
          make_request(:post,
                       "/api/lti/accounts/#{root_account.lti_context_id}/data_services",
                       subscription: subscription.merge(OwnerId: "notfound"))
          expect(response).to have_http_status(:not_found)
          expect(WebMock).not_to have_requested(:post, %r{http://live-event-service/api/subscriptions})
        end
      end
    end
  end

  describe "#show" do
    let(:action) { :show }
    let(:request_method) { :get }

    it_behaves_like "lti services" do
      let(:expected_mime_type) { described_class::MIME_TYPE }
      let(:scope_to_remove) { "https://canvas.instructure.com/lti/data_services/scope/show" }
      let(:params_overrides) do
        { account_id: root_account.lti_context_id, id: "testid" }
      end
      let(:body_overrides) { {} }
    end

    it "returns the subscription" do
      make_request(:get, "/api/lti/accounts/#{root_account.lti_context_id}/data_services/testid")
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["Id"]).to eq("testid")
      expect(body["ContextId"]).to eq(root_account.uuid)
      expect(WebMock).to have_requested(:get, %r{http://live-event-service/api/subscriptions/testid}).once
    end
  end

  describe "#update" do
    let(:action) { :update }
    let(:request_method) { :put }
    let(:sub_id) { "myid" }

    it_behaves_like "lti services" do
      let(:expected_mime_type) { described_class::MIME_TYPE }
      let(:scope_to_remove) { "https://canvas.instructure.com/lti/data_services/scope/update" }
      let(:params_overrides) do
        { subscription:, account_id: root_account.lti_context_id, id: "testid" }
      end
      let(:body_overrides) do
        { subscription: }
      end
    end

    context "with an installed tool" do
      it "adds UpdatedBy and UpdatedByType if passed in for a tool" do
        make_request(:put, "/api/lti/accounts/#{root_account.lti_context_id}/data_services/#{sub_id}", subscription:)
        expect(response).to have_http_status(:ok)
        expect(JSON.parse(response.body)["UpdatedBy"]).to eq(tool.global_id.to_s)
        expect(JSON.parse(response.body)["UpdatedByType"]).to eq("external_tool")
        expect(WebMock).to have_requested(:put, %r{http://live-event-service/api/subscriptions}).once
      end

      context "without an installed tool" do
        before do
          tool.destroy
        end

        it "uses developer key for UpdatedBy" do
          make_request(:put, "/api/lti/accounts/#{root_account.lti_context_id}/data_services/#{sub_id}", subscription:)
          expect(response).to have_http_status(:ok)
          expect(JSON.parse(response.body)["UpdatedBy"]).to eq(developer_key.global_id.to_s)
          expect(JSON.parse(response.body)["UpdatedByType"]).to eq("internal_service")
          expect(WebMock).to have_requested(:put, %r{http://live-event-service/api/subscriptions}).once
        end
      end
    end

    context "with a user owner" do
      let(:user) { account_admin_user(account: root_account) }

      it "adds UpdatedBy and UpdatedByType if passed in for a person" do
        make_request(:put,
                     "/api/lti/accounts/#{root_account.lti_context_id}/data_services/#{sub_id}",
                     subscription: subscription.merge(UpdatedBy: user.global_id.to_s))
        expect(response).to have_http_status(:ok)
        expect(JSON.parse(response.body)["UpdatedBy"]).to eq(user.global_id.to_s)
        expect(JSON.parse(response.body)["UpdatedByType"]).to eq("person")
        expect(WebMock).to have_requested(:put, %r{http://live-event-service/api/subscriptions}).once
      end

      context "with non admin user" do
        let(:user) { user_model }

        it "raises an unprocessable_entity" do
          make_request(:put,
                       "/api/lti/accounts/#{root_account.lti_context_id}/data_services/#{sub_id}",
                       subscription: subscription.merge(UpdatedBy: user.global_id))
          expect(response).to have_http_status(:unprocessable_content)
          expect(WebMock).not_to have_requested(:put, %r{http://live-event-service/api/subscriptions})
        end
      end

      context "with not found user" do
        it "raises a 404" do
          make_request(:put,
                       "/api/lti/accounts/#{root_account.lti_context_id}/data_services/#{sub_id}",
                       subscription: subscription.merge(UpdatedBy: "notfound"))
          expect(response).to have_http_status(:not_found)
          body = JSON.parse(response.body)
          expect(body["errors"]).to eq([{ "message" => "The specified resource does not exist." }])
          expect(WebMock).not_to have_requested(:post, %r{http://live-event-service/api/subscriptions})
          expect(WebMock).not_to have_requested(:get, %r{http://live-event-service/api/subscriptions})
          expect(WebMock).not_to have_requested(:get, %r{http://live-event-service/api/root_account_subscriptions})
          expect(WebMock).not_to have_requested(:delete, %r{http://live-event-service/api/subscriptions})
          expect(WebMock).not_to have_requested(:put, %r{http://live-event-service/api/subscriptions})
        end
      end
    end
  end

  describe "#index" do
    let(:action) { :index }
    let(:request_method) { :get }

    it_behaves_like "lti services" do
      let(:expected_mime_type) { described_class::MIME_TYPE }
      let(:scope_to_remove) { "https://canvas.instructure.com/lti/data_services/scope/list" }
      let(:params_overrides) do
        { account_id: root_account.lti_context_id }
      end
      let(:body_overrides) { {} }
    end

    it "returns a list of subscriptions" do
      make_request(:get, "/api/lti/accounts/#{root_account.lti_context_id}/data_services")
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body).to be_an(Array)
      expect(body.length).to eq(1)
      expect(body.first["Id"]).to eq("testid")
      expect(WebMock).to have_requested(:get, %r{http://live-event-service/api/root_account_subscriptions}).once
    end
  end

  describe "#destroy" do
    let(:action) { :destroy }
    let(:request_method) { :delete }

    it_behaves_like "lti services" do
      let(:expected_mime_type) { described_class::MIME_TYPE }
      let(:scope_to_remove) { "https://canvas.instructure.com/lti/data_services/scope/destroy" }
      let(:params_overrides) do
        { account_id: root_account.lti_context_id, id: "testid" }
      end
      let(:body_overrides) { {} }
    end

    it "destroys the subscription" do
      make_request(:delete, "/api/lti/accounts/#{root_account.lti_context_id}/data_services/testid")
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["Id"]).to eq("testid")
      expect(WebMock).to have_requested(:delete, %r{http://live-event-service/api/subscriptions/testid}).once
    end
  end
end
# rubocop:enable Rails/ResponseParsedBody
