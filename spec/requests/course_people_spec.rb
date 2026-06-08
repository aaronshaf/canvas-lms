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

describe "ContextController" do
  # ---------------------------------------------------------------------------
  # Manage Tags permission visibility for students
  # Covers: spec/selenium/people/differentiation_tag_management_spec.rb:936
  # A student visiting the people page must not be granted the
  # can_manage_differentiation_tags permission in the page ENV.
  # ---------------------------------------------------------------------------
  describe "GET /courses/:id/users" do
    let(:enrollment) { course_with_teacher(active_all: true) }
    let(:course) { enrollment.course }
    let(:student) { student_in_course(active_all: true, course:).user }

    it "does not grant can_manage_differentiation_tags to a student" do
      user_session student
      get "/courses/#{course.id}/users"
      expect(response).to have_http_status(:ok)
      expect(js_env_from_response(response).dig("permissions", "can_manage_differentiation_tags")).to be(false)
    end
  end

  # ---------------------------------------------------------------------------
  # Prior enrollment page loads with student name
  # Covers: spec/selenium/people/people_spec.rb:314
  # After a course is completed, a teacher can view prior enrollments and see
  # enrolled student names on the prior users page.
  # ---------------------------------------------------------------------------
  describe "GET /courses/:id/users/prior" do
    let(:enrollment) { course_with_teacher(active_all: true) }
    let(:course) { enrollment.course }
    let(:teacher) { enrollment.user }

    before do
      s = user_factory(name: "Prior Student", active_user: true)
      e = course.enroll_student(s, enrollment_state: "active")
      e.update_columns(workflow_state: "completed")
    end

    it "returns ok and includes prior enrolled student name for teacher" do
      user_session teacher
      get "/courses/#{course.id}/users/prior"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("Student, Prior")
    end
  end

  # ---------------------------------------------------------------------------
  # TA does not receive manage-tags permissions in page ENV
  # Covers: spec/selenium/people/differentiation_tag_management_spec.rb:942
  #         spec/selenium/people/people_spec.rb:1135
  # TAs do not hold GRANULAR_MANAGE_TAGS_PERMISSIONS so can_manage_differentiation_tags
  # must be false in the PERMISSIONS ENV even when the account setting is enabled.
  # ---------------------------------------------------------------------------
  describe "GET /courses/:id/users as a TA" do
    let(:ta_enrollment) { course_with_ta(active_all: true) }
    let(:course) { ta_enrollment.course }
    let(:ta) { ta_enrollment.user }

    before do
      ta_enrollment
      Account.default.settings[:allow_assign_to_differentiation_tags] = { value: true }
      Account.default.save!
    end

    after do
      Account.default.settings.delete(:allow_assign_to_differentiation_tags)
      Account.default.save!
    end

    it "does not grant can_manage_differentiation_tags to a TA" do
      user_session ta
      get "/courses/#{course.id}/users"
      expect(response).to have_http_status(:ok)
      expect(js_env_from_response(response).dig("permissions", "can_manage_differentiation_tags")).to be(false)
    end

    it "does not render Manage Tags permission for a TA even when account setting is on" do
      user_session ta
      get "/courses/#{course.id}/users"
      expect(response).to have_http_status(:ok)
      permissions = js_env_from_response(response)["permissions"]
      expect(permissions["can_manage_differentiation_tags"]).to be(false)
      expect(permissions["allow_assign_to_differentiation_tags"]).to be(true)
    end
  end

  # ---------------------------------------------------------------------------
  # allow_assign_to_differentiation_tags account setting inheritance
  # Covers: spec/selenium/people/differentiation_tag_management_spec.rb:958,971,977,993,999
  # The inheritable account setting must propagate correctly through the account
  # hierarchy, with locked parent settings overriding child settings.
  # ---------------------------------------------------------------------------
  describe "GET /courses/:id/users allow_assign_to_differentiation_tags inheritance" do
    let(:enrollment) { course_with_teacher(active_all: true) }
    let(:course) { enrollment.course }
    let(:teacher) { enrollment.user }
    let(:sub_account) { Account.default.sub_accounts.create!(name: "Sub Account") }

    before do
      course.update!(account: sub_account)
    end

    after do
      Account.default.settings.delete(:allow_assign_to_differentiation_tags)
      Account.default.save!
    end

    it "shows Manage Tags when parent account is locked true and child is disabled" do
      Account.default.settings[:allow_assign_to_differentiation_tags] = { value: true, locked: true }
      Account.default.save!
      sub_account.settings[:allow_assign_to_differentiation_tags] = { value: false }
      sub_account.save!
      user_session teacher
      get "/courses/#{course.id}/users"
      expect(response).to have_http_status(:ok)
      expect(js_env_from_response(response).dig("permissions", "allow_assign_to_differentiation_tags")).to be(true)
    end

    it "shows Manage Tags when sub-account setting is on and parent is not locked" do
      sub_account.settings[:allow_assign_to_differentiation_tags] = { value: true }
      sub_account.save!
      user_session teacher
      get "/courses/#{course.id}/users"
      expect(response).to have_http_status(:ok)
      expect(js_env_from_response(response).dig("permissions", "allow_assign_to_differentiation_tags")).to be(true)
    end

    it "hides Manage Tags when sub-account setting is off and parent is not locked" do
      sub_account.settings[:allow_assign_to_differentiation_tags] = { value: false }
      sub_account.save!
      user_session teacher
      get "/courses/#{course.id}/users"
      expect(response).to have_http_status(:ok)
      expect(js_env_from_response(response).dig("permissions", "allow_assign_to_differentiation_tags")).to be(false)
    end

    it "shows Manage Tags when sub-account enabled overrides parent disabled (not locked)" do
      Account.default.settings[:allow_assign_to_differentiation_tags] = { value: false }
      Account.default.save!
      sub_account.settings[:allow_assign_to_differentiation_tags] = { value: true }
      sub_account.save!
      user_session teacher
      get "/courses/#{course.id}/users"
      expect(response).to have_http_status(:ok)
      expect(js_env_from_response(response).dig("permissions", "allow_assign_to_differentiation_tags")).to be(true)
    end

    it "hides Manage Tags when both parent and sub-account setting are disabled" do
      Account.default.settings[:allow_assign_to_differentiation_tags] = { value: false }
      Account.default.save!
      sub_account.settings[:allow_assign_to_differentiation_tags] = { value: false }
      sub_account.save!
      user_session teacher
      get "/courses/#{course.id}/users"
      expect(response).to have_http_status(:ok)
      expect(js_env_from_response(response).dig("permissions", "allow_assign_to_differentiation_tags")).to be(false)
    end
  end

  # ---------------------------------------------------------------------------
  # Login ID column visibility based on view_user_logins permission
  # Covers: spec/selenium/people/people_spec.rb:616,624
  # The view_user_logins PERMISSION flag in page ENV controls Login ID column
  # visibility independent of manage_students permission.
  # ---------------------------------------------------------------------------
  describe "GET /courses/:id/users Login ID column visibility" do
    let(:ta_enrollment) { course_with_ta(active_all: true) }
    let(:course) { ta_enrollment.course }
    let(:ta) { ta_enrollment.user }

    it "includes view_user_logins:true in PERMISSIONS when TA has that right" do
      user_session ta
      get "/courses/#{course.id}/users"
      expect(response).to have_http_status(:ok)
      expect(js_env_from_response(response).dig("permissions", "view_user_logins")).to be(true)
    end

    it "sets view_user_logins:false in PERMISSIONS when TA has that right revoked" do
      RoleOverride.create!(
        context: Account.default,
        permission: "view_user_logins",
        role: ta_role,
        enabled: false
      )
      user_session ta
      get "/courses/#{course.id}/users"
      expect(response).to have_http_status(:ok)
      expect(js_env_from_response(response).dig("permissions", "view_user_logins")).to be(false)
    end
  end

  # ---------------------------------------------------------------------------
  # TA cannot delete or reset course
  # Covers: spec/selenium/people/people_spec.rb:608
  # TAs lack manage_courses_conclude and delete permissions so the course
  # settings page must not expose the reset button, and the confirm_action
  # page must return unauthorized.
  # ---------------------------------------------------------------------------
  describe "GET /courses/:id/settings as a TA" do
    let(:ta_enrollment) { course_with_ta(active_all: true) }
    let(:course) { ta_enrollment.course }
    let(:ta) { ta_enrollment.user }

    it "does not include reset_course_content_button on settings page for TA" do
      user_session ta
      get "/courses/#{course.id}/settings"
      expect(response).to have_http_status(:ok)
      expect(response.body).not_to include("reset_course_content_button")
    end

    it "returns unauthorized when TA attempts to access course conclude confirmation" do
      user_session ta
      get "/courses/#{course.id}/confirm_action?event=conclude"
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
