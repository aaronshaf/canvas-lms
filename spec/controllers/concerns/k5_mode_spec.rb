# frozen_string_literal: true

#
# Copyright (C) 2021 - present Instructure, Inc.
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

require_relative "../../helpers/k5_common"

class K5ModeTestController < AssignmentsController
  include K5Mode

  def index
    set_k5_mode
    render json: {
      k5_details_view: @k5_details_view,
      show_left_side: @show_left_side,
      css_bundles: @css_bundles,
      js_bundles: @js_bundles
    }
  end

  def root_path
    "/"
  end

  def user_profile_url(user)
    "/users/#{user.id}"
  end
end

describe K5Mode, type: :request do
  include K5Common

  before do
    course_with_teacher(active_all: true)
    student_in_course(active_all: true)
    account_admin_user(account: @course.account)
    toggle_k5_setting(@course.account)
  end

  before :all do # rubocop:disable RSpec/BeforeAfterAll
    Rails.application.routes.draw do
      resources :courses do
        get "assignments", to: "k5_mode_test#index"
      end
    end
  end

  describe "set_k5_mode" do
    shared_examples_for ":show_left_side" do
      it "does not set :show_left_side in non-k5 contexts" do
        toggle_k5_setting(@course.account, enable: false)
        get "/courses/#{@course.id}/assignments.json"
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body["show_left_side"]).to be_nil
      end
    end

    context "teacher" do
      before do
        user_session(@teacher)
      end

      it_behaves_like ":show_left_side"

      it "sets k5 variables" do
        get "/courses/#{@course.id}/assignments.json"
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body["k5_details_view"]).to be(false)
        expect(response.parsed_body["show_left_side"]).to be(true)
        expect(response.parsed_body["css_bundles"].flatten).to include("k5_theme", "k5_font")
      end

      context "when the user prefers the dyslexia friendly font" do
        before do
          @teacher.enable_feature!(:use_dyslexic_font)
        end

        it "does not include k5_font css bundle" do
          get "/courses/#{@course.id}/assignments.json"
          expect(response).to have_http_status(:ok)
          expect(response.parsed_body["css_bundles"].flatten).to include("k5_theme")
          expect(response.parsed_body["css_bundles"].flatten).not_to include("k5_font")
        end
      end

      context "that is also a student" do
        before do
          @course.enroll_user(@teacher, "StudentEnrollment", enrollment_state: "active")
        end

        it_behaves_like ":show_left_side"

        it "sets k5 variables" do
          get "/courses/#{@course.id}/assignments.json"
          expect(response).to have_http_status(:ok)
          expect(response.parsed_body["k5_details_view"]).to be(false)
          expect(response.parsed_body["show_left_side"]).to be(true)
          expect(response.parsed_body["css_bundles"].flatten).to include("k5_theme", "k5_font")
        end
      end
    end

    context "admin" do
      before do
        user_session(@admin)
      end

      it_behaves_like ":show_left_side"

      it "sets k5 variables" do
        get "/courses/#{@course.id}/assignments.json"
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body["k5_details_view"]).to be(false)
        expect(response.parsed_body["show_left_side"]).to be(true)
        expect(response.parsed_body["css_bundles"].flatten).to include("k5_theme", "k5_font")
      end
    end

    context "student" do
      before do
        user_session(@student)
      end

      it_behaves_like ":show_left_side"

      it "sets k5 variables" do
        get "/courses/#{@course.id}/assignments.json"
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body["k5_details_view"]).to be(true)
        expect(response.parsed_body["show_left_side"]).to be(false)
        expect(response.parsed_body["css_bundles"].flatten).to include("k5_theme", "k5_font")
      end
    end

    it "uses K5 theme for homeroom courses" do
      @course.homeroom_course = true
      user_session(@teacher)
      get "/courses/#{@course.id}/assignments.json"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["css_bundles"].flatten).to include("k5_theme", "k5_font")
    end

    it "prefers the K5 theme to the old elementary theme if both apply" do
      @course.enable_feature!(:canvas_k6_theme)
      user_session(@teacher)
      get "/courses/#{@course.id}/assignments.json"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["css_bundles"].flatten).to include("k5_theme", "k5_font")
      expect(Array(response.parsed_body["js_bundles"]).flatten).not_to include("k6_theme")
    end

    it "uses the old elementary theme if the flag is on and K5 mode is off" do
      @course.enable_feature!(:canvas_k6_theme)
      @course.account.settings[:enable_as_k5_account] = { value: false }
      @course.account.save!
      user_session(@teacher)
      get "/courses/#{@course.id}/assignments.json"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["css_bundles"].flatten).to include("k6_theme")
    end

    it "does not include the k5_font css bundle if use_classic_font_in_k5? is true" do
      @course.account.settings[:use_classic_font_in_k5] = { value: true }
      @course.account.save!
      user_session(@teacher)
      get "/courses/#{@course.id}/assignments.json"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["css_bundles"].flatten).to include("k5_theme")
      expect(response.parsed_body["css_bundles"].flatten).not_to include("k5_font")
    end
  end
end
