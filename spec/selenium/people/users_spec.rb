# frozen_string_literal: true

#
# Copyright (C) 2012 - present Instructure, Inc.
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

require_relative "../common"

describe "users" do
  include_context "in-process server selenium tests"

  context "page views" do
    before do
      course_with_admin_logged_in
      @student = student_in_course.user
      Setting.set("enable_page_views", "db")
    end

    it "validates page view with a participation" do
      page_view(user: @student, course: @course, participated: true)
      get "/users/#{@student.id}"
      expect(f(%([data-testid="page-views-table-body"] tr svg))).to be_displayed
    end

    it "validates a page view url" do
      second_student_name = "test student for page views"
      get "/users/#{@student.id}"
      page_view(user: @student, course: @course, participated: true, url: student_in_course(name: second_student_name).user.id.to_s)
      refresh_page # in order to get the generated page view
      page_view_url = f(%([data-testid="page-views-table-body"] a))
      second_student = User.where(name: second_student_name).first
      expect(page_view_url.text).to eq second_student.id.to_s
      expect_new_page_load { page_view_url.click }
      expect(f(".user_details .name").text).to eq second_student.name
      expect(f(%([data-testid="page-views-empty-state"]))).to be_displayed # validate the second student has no page views
    end
  end

  context "admin merge" do
    def select_user_for_merge_by_user_id(user)
      user_id_input = f("input[name=destinationUserId]")
      select_button = f("button[type=submit]")
      user_id_input.send_keys(user.id)
      select_button.click
    end

    def select_user_for_merge_by_user_name(user)
      select_button = f("button[type=submit]")
      click_option("input[data-testid=find-by-select]", "Name")
      destination_user_input = f("input[name=destinationUserId]")
      destination_user_input.send_keys(user.name)
      option = fj("[role=option]:contains(#{user.name})")
      option.click
      select_button.click
    end

    before do
      course_with_admin_logged_in
      @student_1 = User.create!(name: "Student One")
      @student_1.register!
      @student_1.pseudonyms.create!(unique_id: "studentr1_pseudonym1@example.com", password: "asdfasdf", password_confirmation: "asdfasdf")
      @student_1.communication_channels.create(path: "student1_cc@instructure.com").confirm!
      @common_course = @course
      @common_course.enroll_user(@student_1).accept!
      course_with_student({ user: @student_1, active_course: true, active_enrollment: true })

      @student_2 = User.create!(name: "Student Two")
      @student_2.register!
      @student_2.pseudonyms.create!(unique_id: "student2_pseudonym@example.com", password: "asdfasdf", password_confirmation: "asdfasdf")
      @student_2.communication_channels.create(path: "student2_cc@instructure.com").confirm!
      @common_course.enroll_user(@student_2).accept!
      course_with_student({ user: @student_2, active_course: true, active_enrollment: true })
    end

    it "merges user A with user B by user id" do
      get "/users/#{@student_1.id}/admin_merge"
      expected_enrollment_ids = [*@student_1.enrollments.filter { |e| e.course_id != @common_course.id }, *@student_2.enrollments].map(&:id)
      expected_pseudonym_ids = [*@student_1.pseudonyms, *@student_2.pseudonyms].map(&:id)
      expected_login_ids = [*@student_1.communication_channels, *@student_2.communication_channels].map(&:id)

      select_user_for_merge_by_user_id(@student_2)
      merge_account_button = f("[aria-label='Merge Accounts']")
      merge_account_button.click
      confirm_merge_account_button = f("[aria-label='Merge User Accounts']")
      confirm_merge_account_button.click

      @student_1.reload
      @student_2.reload
      expect(@student_2.workflow_state).to eq "registered"
      expect(@student_1.workflow_state).to eq "deleted"
      expect(@student_1.merged_into_user_id).to be(@student_2.id)
      expect(@student_2.enrollments.map(&:id)).to match_array(expected_enrollment_ids)
      expect(@student_2.pseudonyms.map(&:id)).to match_array(expected_pseudonym_ids)
      expect(@student_2.communication_channels.map(&:id)).to match_array(expected_login_ids)
    end

    it "merges user B with user A by user name" do
      get "/users/#{@student_2.id}/admin_merge"
      expected_enrollment_ids = [*@student_2.enrollments.filter { |e| e.course_id != @common_course.id }, *@student_1.enrollments].map(&:id)
      expected_pseudonym_ids = [*@student_2.pseudonyms, *@student_1.pseudonyms].map(&:id)
      expected_login_ids = [*@student_2.communication_channels, *@student_1.communication_channels].map(&:id)

      select_user_for_merge_by_user_name(@student_1)
      merge_account_button = f("[aria-label='Merge Accounts']")
      merge_account_button.click
      confirm_merge_account_button = f("[aria-label='Merge User Accounts']")
      confirm_merge_account_button.click

      @student_1.reload
      @student_2.reload
      expect(@student_1.workflow_state).to eq "registered"
      expect(@student_2.workflow_state).to eq "deleted"
      expect(@student_2.merged_into_user_id).to be(@student_1.id)
      expect(@student_1.enrollments.map(&:id)).to match_array(expected_enrollment_ids)
      expect(@student_1.pseudonyms.map(&:id)).to match_array(expected_pseudonym_ids)
      expect(@student_1.communication_channels.map(&:id)).to match_array(expected_login_ids)
    end
  end

  context "registration" do
    before do
      Account.default.canvas_authentication_provider.update_attribute(:self_registration, true)
    end

    it "requires terms if configured to do so" do
      Account.default.terms_of_service&.update(passive: false)

      get "/register"

      %w[teacher student parent].each do |type|
        f("#signup_#{type}").click
        form = fj(".ui-dialog:visible form")
        input = f('input[name="user[terms_of_use]"]', form)
        expect(input).not_to be_nil
        form.submit
        wait_for_ajaximations
        assert_error_box 'input[name="user[terms_of_use]"]:visible'
        fj(".ui-dialog-titlebar-close:visible").click
      end
    end

    it "registers a student with a join code" do
      Account.default.terms_of_service&.update(passive: false)

      Account.default.allow_self_enrollment!
      course_factory(active_all: true)
      @course.update_attribute(:self_enrollment, true)

      get "/register"
      f("#signup_student").click

      form = fj(".ui-dialog:visible form")
      f("#student_join_code").send_keys(@course.self_enrollment_code)
      f("#student_name").send_keys("student!")
      f("#student_username").send_keys("student")
      f("#student_password").send_keys("asdfasdf")
      f("#student_password_confirmation").send_keys("asdfasdf")
      f('input[name="user[terms_of_use]"]', form).click

      expect_new_page_load { form.submit }
      # confirm the user is authenticated into the dashboard
      expect_logout_link_present
      expect(User.last.initial_enrollment_type).to eq "student"
    end

    it "registers a teacher" do # flaky-fix: QE-169
      Account.default.terms_of_service&.update(passive: false)

      get "/register"
      f("#signup_teacher").click

      form = fj(".ui-dialog:visible form")
      f("#teacher_name").send_keys("teacher!")
      f("#teacher_email").send_keys("teacher@example.com")

      # instructure_misc_plugin adds extra fields when salesforce registration is active;
      # check the DOM rather than the filesystem to match the frontend's actual state
      if element_exists?("#teacher_organization_type")
        set_value f("#teacher_organization_type"), "Higher Ed"
        set_value f("#teacher_school_position"), "Dean"
        f("#teacher_phone").send_keys("1231231234")
        f("#teacher_school_name").send_keys("example org")
        set_value f("#location"), "United States and Canada"
      end

      f('input[name="user[terms_of_use]"]', form).click

      expect_new_page_load { form.submit }
      # confirm the user is authenticated into the dashboard

      # close the "check your email to confirm your account" dialog
      f(".ui-dialog-titlebar-close").click
      expect(displayed_username).to eq("teacher!")
      expect(fj('form[action="/logout"] button:contains("Logout")')).to be_present
      expect(User.last.initial_enrollment_type).to eq "teacher"
    end

    it "registers an observer" do
      Account.default.terms_of_service&.update(passive: false)

      user = user_with_pseudonym(active_all: true, password: "lolwut12")
      pairing_code = user.generate_observer_pairing_code

      get "/register"
      f("#signup_parent").click

      form = fj(".ui-dialog:visible form")
      f("#parent_name").send_keys("parent!")
      f("#parent_email").send_keys("parent@example.com")
      f("#password").send_keys("password")
      f("#confirm_password").send_keys("password")
      f("#pairing_code").send_keys(pairing_code.code)
      f('input[name="user[terms_of_use]"]', form).click

      expect_new_page_load { form.submit }
      # confirm the user is authenticated into the dashboard

      expect_logout_link_present

      expect(User.last.initial_enrollment_type).to eq "observer"
    end
  end

  context "masquerading" do
    it "masquerades as a user", priority: "1" do
      site_admin_logged_in(name: "The Admin")
      user_with_pseudonym(active_user: true, name: "The Student")

      masquerade_url = "/users/#{@user.id}/masquerade"
      get masquerade_url
      f('a[href="' + masquerade_url + '"]').click
      expect(displayed_username).to include("The Student")

      bar = f("#masquerade_bar")
      expect(bar).to include_text "You are currently acting as"
      bar.find_element(:css, ".stop_masquerading").click
      expect(displayed_username).to eq("The Admin")
    end
  end
end
