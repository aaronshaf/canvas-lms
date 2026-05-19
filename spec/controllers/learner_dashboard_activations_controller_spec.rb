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

describe LearnerDashboardActivationsController do
  before :once do
    @root_account = Account.default
    @root_account.enable_feature!(:horizon_course_setting)
    @root_account.enable_feature!(:horizon_configurable_learner_dashboard)
    @root_account.update!(horizon_account: true)
    @sub_account = @root_account.sub_accounts.create!(name: "Sub")
    @admin = account_admin_user(account: @root_account)
    @layout = LearnerDashboardLayout.create!(name: "Layout", account: @root_account)
  end

  before { user_session(@admin) }

  describe "GET #show" do
    it "returns the activation with layout summary" do
      activation = LearnerDashboardActivation.create!(
        account: @root_account, learner_dashboard_layout: @layout
      )
      get :show, params: { account_id: @root_account.id }, format: :json
      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body["id"]).to eq(activation.id)
      expect(body["learner_dashboard_layout"]["id"]).to eq(@layout.id)
    end

    it "returns 404 when no activation exists" do
      get :show, params: { account_id: @root_account.id }, format: :json
      expect(response).to have_http_status(:not_found)
    end

    it "returns 401 without permission" do
      user_session(user_factory(active_all: true))
      get :show, params: { account_id: @root_account.id }, format: :json
      expect(response).to have_http_status(:forbidden)
    end

    it "returns 404 when feature flag disabled" do
      @root_account.disable_feature!(:horizon_configurable_learner_dashboard)
      get :show, params: { account_id: @root_account.id }, format: :json
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "PUT #update" do
    it "creates an activation" do
      expect do
        put(
          :update,
          params: { account_id: @root_account.id, learner_dashboard_layout_id: @layout.id },
          format: :json
        )
      end.to change { LearnerDashboardActivation.count }.by(1)
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["learner_dashboard_layout"]["id"]).to eq(@layout.id)
    end

    it "upserts existing activation" do
      LearnerDashboardActivation.create!(
        account: @root_account, learner_dashboard_layout: @layout
      )
      new_layout = LearnerDashboardLayout.create!(name: "Other", account: @root_account)

      expect do
        put(
          :update,
          params: { account_id: @root_account.id, learner_dashboard_layout_id: new_layout.id },
          format: :json
        )
      end.not_to change { LearnerDashboardActivation.count }
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["learner_dashboard_layout"]["id"]).to eq(new_layout.id)
    end

    it "allows activating a layout from a sub-account" do
      sub_layout = LearnerDashboardLayout.create!(name: "Sub Layout", account: @sub_account)
      put(
        :update,
        params: { account_id: @root_account.id, learner_dashboard_layout_id: sub_layout.id },
        format: :json
      )
      expect(response).to have_http_status(:ok)
    end

    it "rejects layout not visible to account" do
      other_root = Account.create!(name: "Other Root")
      other_layout = LearnerDashboardLayout.create!(name: "Foreign", account: other_root)
      put(
        :update,
        params: { account_id: @root_account.id, learner_dashboard_layout_id: other_layout.id },
        format: :json
      )
      expect(response).to have_http_status(:not_found)
    end

    it "returns 401 without permission" do
      user_session(user_factory(active_all: true))
      put(
        :update,
        params: { account_id: @root_account.id, learner_dashboard_layout_id: @layout.id },
        format: :json
      )
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "DELETE #destroy" do
    it "hard-deletes the activation" do
      LearnerDashboardActivation.create!(
        account: @root_account, learner_dashboard_layout: @layout
      )
      expect do
        delete :destroy, params: { account_id: @root_account.id }, format: :json
      end.to change { LearnerDashboardActivation.count }.by(-1)
      expect(response).to have_http_status(:no_content)
    end

    it "returns 404 when no activation exists" do
      delete :destroy, params: { account_id: @root_account.id }, format: :json
      expect(response).to have_http_status(:not_found)
    end

    it "returns 401 without permission" do
      user_session(user_factory(active_all: true))
      delete :destroy, params: { account_id: @root_account.id }, format: :json
      expect(response).to have_http_status(:forbidden)
    end
  end
end
