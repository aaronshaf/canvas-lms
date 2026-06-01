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

require_relative "../../support/request_helper"

describe "Quizzes::QuizzesController new/edit form" do
  # Render the layout's _head partial without relying on compiled CSS assets.
  # `BrandableCSS.handlebars_index_json` reads a file produced by `yarn build:css`,
  # which is not guaranteed to be present in CI/dev for request specs.
  before do
    allow(BrandableCSS).to receive(:handlebars_index_json).and_return("{}".html_safe)
  end

  describe "POST /courses/:course_id/quizzes/new" do
    it "creates a new quiz and redirects to its edit page" do
      # Arrange
      course_with_teacher(active_all: true)
      user_session(@teacher)

      # Act
      post "/courses/#{@course.id}/quizzes/new"

      # Assert
      expect(response).to have_http_status(:redirect)
      created_quiz = Quizzes::Quiz.last
      expect(created_quiz).not_to be_nil
      expect(created_quiz.context_id).to eq @course.id
      expect(response.headers["Location"]).to match(%r{/courses/#{@course.id}/quizzes/#{created_quiz.id}/edit$})
    end
  end

  describe "POST /courses/:course_id/quizzes/:quiz_id/groups" do
    it "creates a question group with the submitted name" do
      # Arrange
      course_with_teacher(active_all: true)
      user_session(@teacher)
      quiz = @course.quizzes.create!(title: "Quiz with groups")

      # Act
      post "/courses/#{@course.id}/quizzes/#{quiz.id}/groups",
           params: { quiz_groups: [{ name: "new group", pick_count: 1, question_points: 1 }] }

      # Assert
      expect(response).to have_http_status(:created)
      json = response.parsed_body
      expect(json["quiz_groups"].length).to eq 1
      expect(json["quiz_groups"].first["name"]).to eq "new group"
      expect(quiz.reload.quiz_groups.count).to eq 1
      expect(quiz.quiz_groups.first.name).to eq "new group"
    end
  end

  describe "GET /courses/:course_id/quizzes/:quiz_id/edit (new quiz form initial state)" do
    it "renders the quiz access code input with tabindex=-1 by default" do
      # Arrange
      course_with_teacher(active_all: true)
      user_session(@teacher)
      quiz = @course.quizzes.create!(title: "Access code form quiz")

      # Act
      get "/courses/#{@course.id}/quizzes/#{quiz.id}/edit"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include('id="quiz_access_code"')
      expect(response.body).to match(/<input\s+type="text"\s+tabindex="-1"[^>]*\sid="quiz_access_code"/)
    end

    it "renders the enable_quiz_access_code checkbox unchecked when no access code is set" do
      # Arrange
      course_with_teacher(active_all: true)
      user_session(@teacher)
      quiz = @course.quizzes.create!(title: "No access code")

      # Act
      get "/courses/#{@course.id}/quizzes/#{quiz.id}/edit"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to match(/<input\s+type="checkbox"\s+id="enable_quiz_access_code"/)
      expect(response.body).not_to match(/<input\s+type="checkbox"\s+checked\s+id="enable_quiz_access_code"/)
    end

    it "renders the enable_quiz_access_code checkbox pre-checked when the quiz already has an access code" do
      # Arrange
      course_with_teacher(active_all: true)
      user_session(@teacher)
      quiz = @course.quizzes.create!(title: "Has access code", access_code: "abc123")

      # Act
      get "/courses/#{@course.id}/quizzes/#{quiz.id}/edit"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to match(/<input\s+type="checkbox"\s+checked\s+id="enable_quiz_access_code"/)
    end

    it "renders the quiz ip filter input with tabindex=-1 by default" do
      # Arrange
      course_with_teacher(active_all: true)
      user_session(@teacher)
      quiz = @course.quizzes.create!(title: "IP filter form quiz")

      # Act
      get "/courses/#{@course.id}/quizzes/#{quiz.id}/edit"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include('id="quiz_ip_filter"')
      expect(response.body).to match(/<input\s+type="text"[^>]*\stabindex="-1"[^>]*\sid="quiz_ip_filter"/)
    end

    it "renders the enable_quiz_ip_filter checkbox unchecked when no ip filter is set" do
      # Arrange
      course_with_teacher(active_all: true)
      user_session(@teacher)
      quiz = @course.quizzes.create!(title: "No ip filter")

      # Act
      get "/courses/#{@course.id}/quizzes/#{quiz.id}/edit"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to match(/<input\s+type="checkbox"\s+id="enable_quiz_ip_filter"/)
      expect(response.body).not_to match(/<input\s+type="checkbox"\s+checked\s+id="enable_quiz_ip_filter"/)
    end

    it "renders the enable_quiz_ip_filter checkbox pre-checked when the quiz already has an ip filter" do
      # Arrange
      course_with_teacher(active_all: true)
      user_session(@teacher)
      quiz = @course.quizzes.create!(title: "Has ip filter", ip_filter: "192.168.0.0/24")

      # Act
      get "/courses/#{@course.id}/quizzes/#{quiz.id}/edit"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to match(/<input\s+type="checkbox"\s+checked\s+id="enable_quiz_ip_filter"/)
    end
  end

  describe "GET edit page #quiz_post_to_sis default state" do
    it "renders #quiz_post_to_sis pre-checked when the account sis_default_grade_export setting is enabled" do
      # Arrange
      account = Account.create!
      account.set_feature_flag!(:post_grades, "on")
      account.settings[:sis_default_grade_export] = { locked: false, value: true }
      account.save!
      course_with_teacher(active_all: true, account:)
      user_session(@teacher)
      # POST to /quizzes/new creates a quiz without triggering assignment build
      # (quiz_type is nil during build_assignment callback), so @quiz.assignment
      # is nil on the resulting edit page and the checkbox falls back to the
      # account default.
      post "/courses/#{@course.id}/quizzes/new"
      quiz = Quizzes::Quiz.last

      # Act
      get "/courses/#{@course.id}/quizzes/#{quiz.id}/edit"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include('id="quiz_post_to_sis"')
      expect(response.body).to match(/name="quiz\[post_to_sis\]"[^>]*checked="checked"|checked="checked"[^>]*name="quiz\[post_to_sis\]"/)
    end

    it "renders #quiz_post_to_sis unchecked when the account sis_default_grade_export setting is not enabled" do
      # Arrange
      account = Account.create!
      account.set_feature_flag!(:post_grades, "on")
      # Intentionally do not set sis_default_grade_export — default value is false.
      course_with_teacher(active_all: true, account:)
      user_session(@teacher)
      post "/courses/#{@course.id}/quizzes/new"
      quiz = Quizzes::Quiz.last

      # Act
      get "/courses/#{@course.id}/quizzes/#{quiz.id}/edit"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include('id="quiz_post_to_sis"')
      # The post_to_sis checkbox should be rendered, but the visible checkbox
      # (not the hidden value=0 input) should not have checked="checked".
      visible_checkbox = response.body[/<input[^>]*type="checkbox"[^>]*name="quiz\[post_to_sis\]"[^>]*>/]
      expect(visible_checkbox).not_to be_nil
      expect(visible_checkbox).not_to include('checked="checked"')
    end
  end
end
