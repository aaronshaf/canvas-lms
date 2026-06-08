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

describe "UsersController" do
  # ---------------------------------------------------------------------------
  # Site admin can create pseudonym with password
  # Covers: spec/selenium/people/users_spec.rb:27
  # A site admin visiting a user's profile page must be able to add a new
  # login with an explicit password, and the saved pseudonym must accept
  # that password.
  # ---------------------------------------------------------------------------
  describe "POST /users/:user_id/pseudonyms" do
    it "creates a new pseudonym with a valid password for site admin" do
      admin = User.create!
      Account.site_admin.account_users.create!(user: admin)
      user_session(admin)

      target_user = User.create!
      course_factory.enroll_student(target_user)

      post "/users/#{target_user.id}/pseudonyms", params: {
        pseudonym: {
          unique_id: "new_login_user",
          password: "qwertyuiop",
          password_confirmation: "qwertyuiop",
          account_id: Account.default.id
        }
      }

      expect(response).to have_http_status(:redirect)
      pseudonym = Pseudonym.by_unique_id("new_login_user").first
      expect(pseudonym).not_to be_nil
      expect(pseudonym.valid_password?("qwertyuiop")).to be true
    end
  end

  # ---------------------------------------------------------------------------
  # Unenroll link visibility based on remove_student_from_course permission
  # Covers: spec/selenium/people/people_spec.rb:1092
  # An account admin can unenroll students by default. Disabling the
  # remove_student_from_course permission must remove the unenroll link
  # from the user's profile page.
  # ---------------------------------------------------------------------------
  describe "GET /users/:id unenroll link" do
    before do
      account_admin_user(active_all: true)
      course_with_student(active_all: true)
    end

    it "shows unenroll link for admin with default permissions" do
      user_session @admin
      get "/users/#{@student.id}"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("unenroll_link")
    end

    it "hides unenroll link when remove_student_from_course is disabled" do
      Account.default.role_overrides.create!(
        permission: "remove_student_from_course",
        enabled: false,
        role: admin_role
      )
      user_session @admin
      get "/users/#{@student.id}"
      expect(response).to have_http_status(:ok)
      expect(response.body).not_to include("unenroll_link")
    end
  end
end
