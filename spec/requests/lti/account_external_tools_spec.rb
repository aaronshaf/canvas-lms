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

describe Lti::AccountExternalToolsController do
  include WebMock::API

  include_context "advantage services context"
  include_context "advantage access token context"

  before do
    root_account.lti_context_id = SecureRandom.uuid
    root_account.save
  end

  def action_url_for(action, params_overrides)
    account_id = params_overrides[:account_id]
    external_tool_id = params_overrides[:external_tool_id]

    case action.to_sym
    when :show, :destroy, :update
      "/api/lti/accounts/#{account_id}/external_tools/#{external_tool_id}"
    when :index, :create
      "/api/lti/accounts/#{account_id}/external_tools"
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
      body_params = (body_overrides || {}).merge(params_overrides.except(:account_id, :external_tool_id, :id))
      send(request_method,
           url,
           params: body_params,
           headers:)
    end
  end

  def send_request
    send_http
  end

  describe "#show" do
    let(:action) { :show }
    let(:request_method) { :get }

    it_behaves_like "lti services" do
      let(:expected_mime_type) { described_class::MIME_TYPE }
      let(:scope_to_remove) { "https://canvas.instructure.com/lti/account_external_tools/scope/show" }
      let(:params_overrides) do
        { account_id: root_account.lti_context_id, external_tool_id: tool.id }
      end
      let(:body_overrides) { {} }
    end
  end

  describe "#index" do
    let(:action) { :index }
    let(:request_method) { :get }

    it_behaves_like "lti services" do
      let(:expected_mime_type) { described_class::MIME_TYPE }
      let(:scope_to_remove) { "https://canvas.instructure.com/lti/account_external_tools/scope/list" }
      let(:params_overrides) do
        { account_id: root_account.lti_context_id }
      end
      let(:body_overrides) { {} }
    end

    context "when given just an account id" do
      let(:params_overrides) do
        { account_id: root_account.lti_context_id }
      end

      it "returns id, domain, and other fields on account" do
        send_request
        body = response.parsed_body.first
        expect(body).to include(
          "id" => tool.id,
          "domain" => tool.domain,
          "url" => tool.url,
          "consumer_key" => tool.consumer_key,
          "name" => tool.name,
          "description" => tool.description
        )
        expect(body["id"]).to be_a(Integer)
        expect(body["name"]).to be_a(String)
      end
    end

    context "when an invalid account ID is given" do
      let(:params_overrides) do
        { account_id: 991_234 }
      end

      it "returns a 401" do
        send_request
        expect(response).to have_http_status :unauthorized
      end
    end
  end

  describe "#destroy" do
    let(:action) { :destroy }
    let(:request_method) { :delete }

    it_behaves_like "lti services" do
      let(:expected_mime_type) { described_class::MIME_TYPE }
      let(:scope_to_remove) { "https://canvas.instructure.com/lti/account_external_tools/scope/destroy" }
      let(:params_overrides) do
        { account_id: root_account.lti_context_id, external_tool_id: tool.id }
      end
      let(:body_overrides) { {} }
    end
  end

  describe "#create" do
    let(:action) { :create }
    let(:request_method) { :post }
    let(:params_overrides) do
      { account_id: root_account.lti_context_id, client_id: tool_configuration.developer_key.id }
    end
    let(:body_overrides) { {} }

    it_behaves_like "lti services" do
      let(:expected_mime_type) { described_class::MIME_TYPE }
      let(:scope_to_remove) { "https://canvas.instructure.com/lti/account_external_tools/scope/create" }
    end

    it "sets the correct workflow_state" do
      send_request
      expect(ContextExternalTool.last.workflow_state).to eq(tool_configuration.privacy_level)
    end

    context "error handling" do
      context "with invalid client id" do
        let(:params_overrides) do
          { account_id: root_account.lti_context_id, client_id: "bad client id" }
        end

        it "return 404" do
          send_request
          expect(response).to have_http_status :not_found
        end
      end

      context "with inactive developer key" do
        let(:developer_key) do
          dev_key = super()
          dev_key.deactivate!
          dev_key
        end

        it "return 401" do
          send_request
          expect(response).to have_http_status :unauthorized
        end
      end

      context "with no account binding" do
        let(:developer_key2) do
          dk = DeveloperKey.create!(name: "test_key_#{SecureRandom.hex(4)}", account: root_account)
          dk.developer_key_account_bindings.destroy_all
          dk
        end

        let(:params_overrides) do
          { account_id: root_account.lti_context_id, client_id: developer_key2.id }
        end

        it "return 401" do
          send_request
          expect(response).to have_http_status :unauthorized
        end
      end

      context "with duplicate tool" do
        let(:params_overrides) do
          { account_id: root_account.lti_context_id, client_id: tool_configuration.developer_key.id, verify_uniqueness: true }
        end

        it "return 400" do
          send_request
          expect(response).to have_http_status :ok
          send_request
          expect(response).to have_http_status :bad_request
          error_message = response.parsed_body.dig("errors", "tool_currently_installed").first["message"]
          expect(error_message).to eq "The tool is already installed in this context."
        end
      end

      context "with a locked registration" do
        before do
          tool_configuration.developer_key.lti_registration.update!(lock_deploying: true)
        end

        it "returns 403 if the appropriate flag is enabled" do
          root_account.enable_feature!(:lock_lti_registrations)
          send_request
          expect(response).to have_http_status :forbidden
        end

        it "ignores the locked status if the appropriate flag is not enabled" do
          root_account.disable_feature!(:lock_lti_registrations)
          send_request
          expect(response).to have_http_status :ok
        end
      end
    end
  end
end
