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

describe "Quizzes Index read-only question bank visibility" do
  describe "GET /courses/:course_id/quizzes" do
    it "exposes read_question_banks permission for a teacher in a soft-concluded course" do
      # Arrange
      course_with_teacher(active_all: true)
      term = Account.default.enrollment_terms.create!
      term.set_overrides(Account.default, "TeacherEnrollment" => { end_at: 3.days.ago })
      @course.enrollment_term = term
      @course.save!
      user_session(@teacher)

      # Act
      get "/courses/#{@course.id}/quizzes"

      # Assert
      expect(response).to have_http_status(:ok)
      js_env = js_env_from_response(response)
      expect(js_env.dig("PERMISSIONS", "read_question_banks")).to be true
      expect(js_env.dig("PERMISSIONS", "manage")).to be false
      expect(js_env.dig("URLS", "question_banks_url")).to eq("/courses/#{@course.id}/question_banks")
    end

    it "exposes read_question_banks permission for a custom-role admin without manage_assignments_add" do
      # Arrange
      course_with_teacher(active_all: true)
      account = @course.account
      role = custom_account_role("weakling", account:)
      account.role_overrides.create!(permission: "read_course_content", enabled: true, role:)
      account.role_overrides.create!(permission: "read_question_banks", enabled: true, role:)
      admin_user = user_factory(active_all: true)
      account.account_users.create!(user: admin_user, role:)
      user_session(admin_user)

      # Act
      get "/courses/#{@course.id}/quizzes"

      # Assert
      expect(response).to have_http_status(:ok)
      js_env = js_env_from_response(response)
      expect(js_env.dig("PERMISSIONS", "read_question_banks")).to be true
      expect(js_env.dig("PERMISSIONS", "manage")).to be false
      expect(js_env.dig("URLS", "question_banks_url")).to eq("/courses/#{@course.id}/question_banks")
    end
  end

  describe "GET /courses/:course_id/question_banks" do
    it "renders the bank title link but hides add/edit/delete affordances for a teacher in a soft-concluded course" do
      # Arrange
      course_with_teacher(active_all: true)
      term = Account.default.enrollment_terms.create!
      term.set_overrides(Account.default, "TeacherEnrollment" => { end_at: 3.days.ago })
      @course.enrollment_term = term
      @course.save!
      bank = @course.assessment_question_banks.create!(title: "Test Bank")
      user_session(@teacher)

      # Act
      get "/courses/#{@course.id}/question_banks"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("question_bank_#{bank.id}")
      expect(response.body).to include("Test Bank")
      expect(response.body).to include("/courses/#{@course.id}/question_banks/#{bank.id}")
      expect(response.body).not_to match(/class="[^"]*\badd_bank_link\b/)
      expect(response.body).not_to match(/class="[^"]*\bedit_bank_link\b/)
      expect(response.body).not_to match(/class="[^"]*\bdelete_bank_link\b/)
    end

    it "renders the bank title link but hides add/edit/delete affordances for a custom-role admin without manage_assignments_add" do
      # Arrange
      course_with_teacher(active_all: true)
      account = @course.account
      role = custom_account_role("weakling", account:)
      account.role_overrides.create!(permission: "read_course_content", enabled: true, role:)
      account.role_overrides.create!(permission: "read_question_banks", enabled: true, role:)
      admin_user = user_factory(active_all: true)
      account.account_users.create!(user: admin_user, role:)
      bank = @course.assessment_question_banks.create!(title: "Test Bank")
      user_session(admin_user)

      # Act
      get "/courses/#{@course.id}/question_banks"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("question_bank_#{bank.id}")
      expect(response.body).to include("Test Bank")
      expect(response.body).to include("/courses/#{@course.id}/question_banks/#{bank.id}")
      expect(response.body).not_to match(/class="[^"]*\badd_bank_link\b/)
      expect(response.body).not_to match(/class="[^"]*\bedit_bank_link\b/)
      expect(response.body).not_to match(/class="[^"]*\bdelete_bank_link\b/)
    end
  end

  describe "GET /courses/:course_id/question_banks/:id" do
    it "renders the bank for a teacher in a soft-concluded course without edit/delete affordances" do
      # Arrange
      course_with_teacher(active_all: true)
      term = Account.default.enrollment_terms.create!
      term.set_overrides(Account.default, "TeacherEnrollment" => { end_at: 3.days.ago })
      @course.enrollment_term = term
      @course.save!
      bank = @course.assessment_question_banks.create!(title: "Test Bank")
      user_session(@teacher)

      # Act
      get "/courses/#{@course.id}/question_banks/#{bank.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("Test Bank")
      expect(response.body).not_to match(/class="[^"]*\bedit_bank_link\b/)
      expect(response.body).not_to match(/class="[^"]*\bdelete_bank_link\b/)
    end

    it "renders the bank for a custom-role admin without manage_assignments_add and without edit/delete affordances" do
      # Arrange
      course_with_teacher(active_all: true)
      account = @course.account
      role = custom_account_role("weakling", account:)
      account.role_overrides.create!(permission: "read_course_content", enabled: true, role:)
      account.role_overrides.create!(permission: "read_question_banks", enabled: true, role:)
      admin_user = user_factory(active_all: true)
      account.account_users.create!(user: admin_user, role:)
      bank = @course.assessment_question_banks.create!(title: "Test Bank")
      user_session(admin_user)

      # Act
      get "/courses/#{@course.id}/question_banks/#{bank.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("Test Bank")
      expect(response.body).not_to match(/class="[^"]*\bedit_bank_link\b/)
      expect(response.body).not_to match(/class="[^"]*\bdelete_bank_link\b/)
    end
  end
end
