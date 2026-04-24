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

describe NotebookController do
  before :once do
    course_with_teacher(active_all: true)
    student_in_course(active_all: true)
    @course.root_account.enable_feature!(:notebook)
  end

  describe "GET #index" do
    context "as a student with feature enabled" do
      let(:journey_url) { "https://journey.example.com" }

      before do
        user_session(@student)
        config = instance_double(CanvasCareer::Config)
        allow(CanvasCareer::Config).to receive(:new).and_return(config)
        allow(config).to receive(:public_app_config).and_return({ "hosts" => { "journey" => journey_url } })
      end

      it "renders successfully" do
        get :index, params: { course_id: @course.id }
        expect(response).to be_successful
      end

      it "sets js_env with expected values" do
        get :index, params: { course_id: @course.id }
        expect(assigns[:js_env][:COURSE_ID]).to eq(@course.id)
        expect(assigns[:js_env][:JOURNEY_URL]).to eq(journey_url)
        expect(assigns[:js_env][:FEATURES][:notebook]).to be true
      end
    end

    context "when feature flag is disabled" do
      before do
        @course.root_account.disable_feature!(:notebook)
        user_session(@student)
      end

      it "returns not found" do
        get :index, params: { course_id: @course.id }
        expect(response).to be_not_found
      end
    end

    context "as a teacher" do
      before { user_session(@teacher) }

      it "returns unauthorized" do
        get :index, params: { course_id: @course.id }
        expect(response).to be_unauthorized
      end
    end

    context "as an admin" do
      before do
        account_admin_user(account: @course.root_account)
        user_session(@admin)
      end

      it "returns unauthorized" do
        get :index, params: { course_id: @course.id }
        expect(response).to be_unauthorized
      end
    end
  end
end
