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

describe CanvasCareer::LearnerDashboardController do
  before :once do
    @root_account = Account.default
    @root_account.enable_feature!(:horizon_configurable_learner_dashboard)
    @sub_account = @root_account.sub_accounts.create!(name: "Sub")
    @layout = LearnerDashboardLayout.create!(name: "Dashboard", account: @sub_account)
    @activation = LearnerDashboardActivation.create!(account: @sub_account, learner_dashboard_layout: @layout)
    @course = Course.create!(account: @sub_account, name: "Horizon Course", workflow_state: "available")
    @course.update!(horizon_course: true)
    @user = user_factory(active_all: true)
    @course.enroll_student(@user, enrollment_state: "active")
  end

  describe "GET #show" do
    it "returns the resolved layout with block_editor_data" do
      user_session(@user)
      allow_any_instance_of(LearnerDashboardLayout).to receive(:get_block_editor_data).and_return({ "blocks" => [] })

      get :show, format: :json

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body["id"]).to eq(@layout.id)
      expect(body["name"]).to eq("Dashboard")
      expect(body["block_editor_data"]).to eq({ "blocks" => [] })
    end

    it "returns a verifier that lets a learner download an account file they cannot read directly" do
      attachment = attachment_model(context: @sub_account)
      # sanity: the enrolled student cannot read the account file on their own
      expect(attachment.grants_right?(@user, :download)).to be false

      block_data = {
        "templateData" => [
          { "ImageBlock|i1" => { "asset_id" => attachment.id.to_s } }
        ]
      }
      allow_any_instance_of(LearnerDashboardLayout).to receive(:get_block_editor_data).and_return(block_data)
      user_session(@user)

      get :show, format: :json

      expect(response).to have_http_status(:ok)
      verifier = response.parsed_body.dig("file_access_verifiers", attachment.id.to_s)
      expect(verifier).to be_present

      checker = Attachments::Verification.new(attachment)
      expect(checker.valid_verifier_for_permission?(verifier, :download, @root_account, {})).to be true
    end

    it "returns 404 when no layout is resolved" do
      user_without_enrollment = user_factory(active_all: true)
      user_session(user_without_enrollment)

      get :show, format: :json

      expect(response).to have_http_status(:not_found)
    end

    it "returns 404 when feature flag is disabled" do
      @root_account.disable_feature!(:horizon_configurable_learner_dashboard)
      user_session(@user)

      get :show, format: :json

      expect(response).to have_http_status(:not_found)
    end

    it "redirects unauthenticated users" do
      get :show, format: :json

      expect(response).to have_http_status(:unauthorized)
    end

    it "returns 503 on Content Service error" do
      user_session(@user)
      error = InstructureMiscPlugin::Extensions::ContentServiceClient::ClientError.new(
        "service down", service_errors: []
      )
      allow_any_instance_of(CanvasCareer::LearnerDashboardResolver).to receive(:resolve).and_return(@layout)
      allow_any_instance_of(LearnerDashboardLayout).to receive(:get_block_editor_data).and_raise(error)

      get :show, format: :json

      expect(response).to have_http_status(:service_unavailable)
      expect(response.parsed_body["error"]).to eq("service down")
    end
  end
end
