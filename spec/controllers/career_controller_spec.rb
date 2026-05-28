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

describe CareerController, type: :request do
  before :once do
    course_with_teacher(active_all: true)
    @account = @course.account
    @course.update!(horizon_course: true)
  end

  before do
    config = instance_double(CanvasCareer::Config,
                             learning_provider_app_launch_url: "https://example.com/lp",
                             learner_app_launch_url: "https://example.com/learner",
                             public_app_config: { some: "config" })
    @resolver = instance_double(CanvasCareer::ExperienceResolver)
    allow(CanvasCareer::ExperienceResolver).to receive(:new).and_return(@resolver)
    allow(CanvasCareer::Config).to receive(:new).with(@course.root_account, anything).and_return(config)
  end

  describe "GET show" do
    context "without authentication" do
      it "returns unauthorized for bare /career route" do
        get "/career"
        assert_unauthorized
      end

      it "returns unauthorized for non-public course" do
        get "/career/courses/#{@course.id}"
        assert_unauthorized
      end

      it "returns unauthorized for public academic (non-horizon) course" do
        academic_course = course_factory(active_all: true, is_public: true)
        get "/career/courses/#{academic_course.id}"
        assert_unauthorized
      end

      it "redirects to login for public but unpublished horizon course" do
        unpublished_course = course_factory(account: @account)
        unpublished_course.update!(horizon_course: true, is_public: true, workflow_state: "claimed")
        @account.enable_feature!(:horizon_course_setting)
        get "/career/courses/#{unpublished_course.id}"
        assert_unauthorized
      end

      context "with a public horizon course" do
        before do
          @account.enable_feature!(:horizon_course_setting)
          @course.update!(is_public: true)
        end

        it "renders the SPA without requiring login" do
          get "/career/courses/#{@course.id}"
          expect(response).to have_http_status(:ok)
          expect(response).to render_template("layouts/bare")
        end

        it "loads the learner app for anonymous users" do
          get "/career/courses/#{@course.id}"
          expect(remotes_from_response(response)).to include("canvas_career_learner" => "https://example.com/learner")
        end

        it "does not invoke ExperienceResolver" do
          expect(CanvasCareer::ExperienceResolver).not_to receive(:new)
          get "/career/courses/#{@course.id}"
        end
      end
    end

    context "with authenticated user" do
      before do
        user_session(@teacher)
      end

      context "when ExperienceResolver returns ACADEMIC" do
        before do
          allow(@resolver).to receive(:resolve).and_return(CanvasCareer::Constants::App::ACADEMIC)
        end

        it "redirects to root path with career theme params" do
          get "/career/courses/#{@course.id}"
          expected_params = CanvasCareer::Constants::QueryParams::ACADEMIC_CONTENT_ONLY_CAREER_THEME
          expect(response).to redirect_to("/?#{expected_params.to_query}")
        end
      end

      context "when ExperienceResolver returns CAREER_LEARNING_PROVIDER" do
        before do
          allow(@resolver).to receive(:resolve).and_return(CanvasCareer::Constants::App::CAREER_LEARNING_PROVIDER)
        end

        it "sets up the JS environment with features" do
          get "/career/courses/#{@course.id}"
          js_env = js_env_from_response(response)
          expect(js_env["CANVAS_CAREER"]["FEATURES"]).to include(
            "horizon_hris_integrations" => false,
            "horizon_user_profile_page" => false,
            "horizon_manual_dashboard_builder" => false,
            "horizon_learning_library" => false,
            "horizon_learning_library_ms2" => false,
            "horizon_learning_library_ms3" => false,
            "horizon_study_tools" => false,
            "horizon_chart_view" => false,
            "horizon_native_permissions_page" => false,
            "horizon_block_content_editor" => false,
            "horizon_native_inbox" => false,
            "horizon_autopilot" => false,
            "horizon_configurable_learner_dashboard" => false,
            "horizon_global_announcements" => false
          )
        end

        it "sets up the JS environment with MAX_GROUP_CONVERSATION_SIZE" do
          Setting.set("max_group_conversation_size", 2)
          get "/career/courses/#{@course.id}"
          expect(js_env_from_response(response)["MAX_GROUP_CONVERSATION_SIZE"]).to eq(2)
        end

        it "sets learning provider URL in remote env" do
          get "/career/courses/#{@course.id}"
          expect(remotes_from_response(response)).to include("canvas_career_learning_provider" => "https://example.com/lp")
        end

        it "calls deferred_js_bundle with :canvas_career" do
          expect_any_instance_of(CareerController).to receive(:deferred_js_bundle).with(:canvas_career)
          get "/career/courses/#{@course.id}"
        end

        it "renders with bare layout" do
          get "/career/courses/#{@course.id}"
          expect(response).to render_template("layouts/bare")
        end

        it "includes masquerade layout" do
          get "/career/courses/#{@course.id}"
          expect(response.body).to include('id="fixed_bottom"')
        end
      end

      context "when ExperienceResolver returns CAREER_LEARNER" do
        before do
          allow(@resolver).to receive(:resolve).and_return(CanvasCareer::Constants::App::CAREER_LEARNER)
        end

        it "sets learner URL in remote env" do
          get "/career/courses/#{@course.id}"
          expect(remotes_from_response(response)).to include("canvas_career_learner" => "https://example.com/learner")
        end

        it "calls deferred_js_bundle with :canvas_career" do
          expect_any_instance_of(CareerController).to receive(:deferred_js_bundle).with(:canvas_career)
          get "/career/courses/#{@course.id}"
        end
      end

      it "injects canvas_career_config" do
        allow(@resolver).to receive(:resolve).and_return(CanvasCareer::Constants::App::CAREER_LEARNER)
        get "/career/courses/#{@course.id}"
        expect(remotes_from_response(response)).to include("canvas_career_config" => { "some" => "config" })
      end
    end
  end
end
