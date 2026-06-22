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

describe LearnerDashboardLayoutsController, type: :request do
  before :once do
    @root_account = Account.default
    @root_account.enable_feature!(:horizon_course_setting)
    @root_account.enable_feature!(:horizon_configurable_learner_dashboard)
    @root_account.update!(horizon_account: true)
    @sub_account = @root_account.sub_accounts.create!(name: "Sub")
    @admin = account_admin_user(account: @root_account)
    @layout = LearnerDashboardLayout.create!(name: "Root Layout", account: @root_account)
    @sub_layout = LearnerDashboardLayout.create!(name: "Sub Layout", account: @sub_account)
  end

  before { user_session(@admin) }

  describe "GET #index" do
    it "lists layouts visible to the account" do
      get "/api/v1/accounts/#{@root_account.id}/learner_dashboard_layouts"
      expect(response).to have_http_status(:ok)
      ids = response.parsed_body.pluck("id")
      expect(ids).to include(@layout.id, @sub_layout.id)
    end

    it "scopes to sub-account subtree" do
      get "/api/v1/accounts/#{@sub_account.id}/learner_dashboard_layouts"
      expect(response).to have_http_status(:ok)
      ids = response.parsed_body.pluck("id")
      expect(ids).to include(@sub_layout.id)
      expect(ids).not_to include(@layout.id)
    end

    it "returns 401 without permission" do
      user_session(user_factory(active_all: true))
      get "/api/v1/accounts/#{@root_account.id}/learner_dashboard_layouts"
      expect(response).to have_http_status(:forbidden)
    end

    it "returns 404 when feature flag disabled" do
      @root_account.disable_feature!(:horizon_configurable_learner_dashboard)
      get "/api/v1/accounts/#{@root_account.id}/learner_dashboard_layouts"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "GET #show" do
    it "returns layout with block_editor_data" do
      allow_any_instance_of(LearnerDashboardLayout).to receive(:get_block_editor_data).and_return({ "blocks" => [] })
      get "/api/v1/accounts/#{@root_account.id}/learner_dashboard_layouts/#{@layout.id}"
      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body["id"]).to eq(@layout.id)
      expect(body["block_editor_data"]).to eq({ "blocks" => [] })
    end

    it "returns 404 for layout outside subtree" do
      get "/api/v1/accounts/#{@sub_account.id}/learner_dashboard_layouts/#{@layout.id}"
      expect(response).to have_http_status(:not_found)
    end

    it "returns 503 on Content Service error" do
      error = InstructureMiscPlugin::Extensions::ContentServiceClient::ClientError.new(
        "service down", service_errors: []
      )
      allow_any_instance_of(LearnerDashboardLayout).to receive(:get_block_editor_data).and_raise(error)
      get "/api/v1/accounts/#{@root_account.id}/learner_dashboard_layouts/#{@layout.id}"
      expect(response).to have_http_status(:service_unavailable)
    end
  end

  describe "POST #create" do
    it "creates a layout" do
      expect do
        post "/api/v1/accounts/#{@root_account.id}/learner_dashboard_layouts",
             params: { name: "New" }
      end.to change { LearnerDashboardLayout.count }.by(1)
      expect(response).to have_http_status(:created)
      expect(response.parsed_body["name"]).to eq("New")
    end

    it "creates with block_editor_data" do
      allow_any_instance_of(LearnerDashboardLayout).to receive(:create_block_editor_data)
      post "/api/v1/accounts/#{@root_account.id}/learner_dashboard_layouts",
           params: { name: "With Data", block_editor_data: { blocks: [] } }
      expect(response).to have_http_status(:created)
    end

    it "passes properly extracted block_editor_data to the model" do
      block_data = {
        templateLayout: [{ component: "Header", id: "header-1" }],
        templateData: [{ "Header|header-1" => { title: "Test" } }]
      }
      expect_any_instance_of(LearnerDashboardLayout).to receive(:create_block_editor_data) do |_layout, args|
        expect(args[:data]).to be_a(Hash)
        expect(args[:data]).not_to be_a(ActionController::Parameters)
        expect(args[:data]["templateLayout"]).to be_present
      end
      post "/api/v1/accounts/#{@root_account.id}/learner_dashboard_layouts",
           params: { name: "Extracted", block_editor_data: block_data }
      expect(response).to have_http_status(:created)
    end

    it "returns 422 with invalid params" do
      post "/api/v1/accounts/#{@root_account.id}/learner_dashboard_layouts",
           params: { name: "" }
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "returns 401 without add permission" do
      user_session(user_factory(active_all: true))
      post "/api/v1/accounts/#{@root_account.id}/learner_dashboard_layouts",
           params: { name: "X" }
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "PUT #update" do
    it "updates layout name" do
      put "/api/v1/accounts/#{@root_account.id}/learner_dashboard_layouts/#{@layout.id}",
          params: { name: "Renamed" }
      expect(response).to have_http_status(:ok)
      expect(@layout.reload.name).to eq("Renamed")
    end

    it "updates block_editor_data" do
      allow_any_instance_of(LearnerDashboardLayout).to receive(:update_block_editor_data)
      put "/api/v1/accounts/#{@root_account.id}/learner_dashboard_layouts/#{@layout.id}",
          params: { name: @layout.name, block_editor_data: { blocks: [1] } }
      expect(response).to have_http_status(:ok)
    end

    it "passes properly extracted block_editor_data to the model" do
      block_data = {
        templateLayout: [{ component: "Text", id: "text-1" }],
        templateData: [{ "Text|text-1" => { content: "<p>Hello</p>" } }]
      }
      expect_any_instance_of(LearnerDashboardLayout).to receive(:update_block_editor_data) do |_layout, args|
        expect(args[:data]).to be_a(Hash)
        expect(args[:data]).not_to be_a(ActionController::Parameters)
        expect(args[:data]["templateLayout"]).to be_present
      end
      put "/api/v1/accounts/#{@root_account.id}/learner_dashboard_layouts/#{@layout.id}",
          params: { name: @layout.name, block_editor_data: block_data }
      expect(response).to have_http_status(:ok)
    end

    it "returns 404 for missing layout" do
      put "/api/v1/accounts/#{@root_account.id}/learner_dashboard_layouts/0",
          params: { name: "X" }
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE #destroy" do
    it "soft-deletes the layout" do
      layout = LearnerDashboardLayout.create!(name: "Delete Me", account: @root_account)
      expect do
        delete "/api/v1/accounts/#{@root_account.id}/learner_dashboard_layouts/#{layout.id}"
      end.to change { LearnerDashboardLayout.active.count }.by(-1)
      expect(response).to have_http_status(:no_content)
    end

    it "returns 404 for already deleted layout" do
      layout = LearnerDashboardLayout.create!(name: "Gone", account: @root_account)
      layout.destroy
      delete "/api/v1/accounts/#{@root_account.id}/learner_dashboard_layouts/#{layout.id}"
      expect(response).to have_http_status(:not_found)
    end

    it "returns 401 without delete permission" do
      user_session(user_factory(active_all: true))
      delete "/api/v1/accounts/#{@root_account.id}/learner_dashboard_layouts/#{@layout.id}"
      expect(response).to have_http_status(:forbidden)
    end

    it "deletes the layout's uploaded files" do
      layout = LearnerDashboardLayout.create!(name: "With Files", account: @root_account)
      folder = Folder.assert_path("learner-dashboards/#{layout.id}", @root_account)
      attachment = folder.file_attachments.create!(
        filename: "img.png", display_name: "img.png", content_type: "image/png", context: @root_account
      )
      attachment.update_columns(file_state: "available")

      delete "/api/v1/accounts/#{@root_account.id}/learner_dashboard_layouts/#{layout.id}"
      expect(response).to have_http_status(:no_content)

      expect(folder.reload.workflow_state).to eq("deleted")
      expect(attachment.reload.file_state).to eq("deleted")
    end

    it "deletes the layout's content service entry" do
      layout = LearnerDashboardLayout.create!(name: "With Content", account: @root_account)
      layout.create_external_content_reference!(content_id: "ext-1", root_account: @root_account)

      expect_any_instance_of(LearnerDashboardLayout)
        .to receive(:delete_block_editor_data).with(user_uuid: @admin.uuid)

      delete "/api/v1/accounts/#{@root_account.id}/learner_dashboard_layouts/#{layout.id}"
      expect(response).to have_http_status(:no_content)
    end
  end

  describe "file access verifiers" do
    let(:attachment) { attachment_model(context: @root_account) }

    def block_data_with(*attachment_ids)
      {
        "templateData" => attachment_ids.map.with_index do |aid, i|
          { "ImageBlock|image-#{i}" => { "asset_id" => aid.to_s, "alt" => "img" } }
        end
      }
    end

    it "returns a signed verifier for each attachment referenced in the blocks" do
      allow_any_instance_of(LearnerDashboardLayout)
        .to receive(:get_block_editor_data).and_return(block_data_with(attachment.id))

      get "/api/v1/accounts/#{@root_account.id}/learner_dashboard_layouts/#{@layout.id}"
      expect(response).to have_http_status(:ok)

      verifiers = response.parsed_body["file_access_verifiers"]
      expect(verifiers.keys).to eq([attachment.id.to_s])

      # the verifier must authorize reading that specific attachment
      checker = Attachments::Verification.new(attachment)
      expect(checker.valid_verifier_for_permission?(verifiers[attachment.id.to_s], :download, @root_account, {})).to be true
    end

    it "deduplicates repeated asset references" do
      allow_any_instance_of(LearnerDashboardLayout)
        .to receive(:get_block_editor_data).and_return(block_data_with(attachment.id, attachment.id))

      get "/api/v1/accounts/#{@root_account.id}/learner_dashboard_layouts/#{@layout.id}"
      expect(response.parsed_body["file_access_verifiers"].keys).to eq([attachment.id.to_s])
    end

    it "returns an empty map when no files are referenced" do
      allow_any_instance_of(LearnerDashboardLayout)
        .to receive(:get_block_editor_data).and_return({ "templateData" => [] })

      get "/api/v1/accounts/#{@root_account.id}/learner_dashboard_layouts/#{@layout.id}"
      expect(response.parsed_body["file_access_verifiers"]).to eq({})
    end
  end
end
