# frozen_string_literal: true

#
# Copyright (C) 2020 - present Instructure, Inc.
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

require_relative "../common"
require_relative "pages/courses_home_page"

describe "courses" do
  include_context "in-process server selenium tests"
  include CoursesHomePage

  context "as a teacher" do
    before do
      account = Account.default
      account.settings = { open_registration: true, no_enrollments_can_create_courses: true, teachers_can_create_courses: true }
      account.save!
      allow_any_instance_of(Account).to receive(:feature_enabled?).and_call_original
      allow_any_instance_of(Account).to receive(:feature_enabled?).with(:new_user_tutorial).and_return(false)
    end

    context "in draft state" do
      before do
        course_with_student_submissions
        @course.default_view = "feed"
        @course.save
      end

      it "loads the users page using ajax", custom_timeout: 30 do
        # Set up the course with > 50 users (to test scrolling)
        create_users_in_course @course, 60
        @course.enroll_user(user_factory, "TaEnrollment")
        visit_course_people(@course)
        wait_for_ajaximations

        expect_no_flash_message :error
        expect(course_user_list.length).to eq 50
      end
    end

    context "differentiation tag rollback plan" do
      before :once do
        @course = course_model(name: "Tag Conversion Course")
        @course.account.settings[:allow_assign_to_differentiation_tags] = { value: true }
        @course.account.save!

        @teacher = teacher_in_course(active_all: true, course: @course).user
        @student = student_in_course(active_all: true, course: @course).user

        @diff_tag_category = @course.group_categories.create!(name: "Tag Category", non_collaborative: true)
        @diff_tag = @course.groups.create!(name: "Tag 1", group_category: @diff_tag_category, non_collaborative: true)

        @diff_tag.add_user(@student)

        @assignment = @course.assignments.create!(title: "Test Assignment")
        @assignment.assignment_overrides.create!(set_type: "Group", set: @diff_tag)

        # disable differentiation tag feature for the course
        @course.account.settings[:allow_assign_to_differentiation_tags] = { value: false }
        @course.account.save!
      end

      it "allows teacher to convert tag overrides to adhoc overrides for entire course" do
        user_session(@teacher)
        visit_course(@course)

        convert_button = f('[data-testid="course-tag-conversion-button"]')
        convert_button.click

        wait_for_ajaximations
        expect(@course.progresses.where(tag: DifferentiationTag::DELAYED_JOB_TAG).count).to eq(1)
        progress_bar = f('[data-testid="course-tag-conversion-progress-bar"]')
        expect(progress_bar).to be_displayed

        # manually complete the job for testing purposes
        @course.progresses.where(tag: DifferentiationTag::DELAYED_JOB_TAG).update(workflow_state: "completed")

        # verify that the success message is displayed
        wait_for_ajaximations
        success_message = f('[data-testid="course-differentiation-tag-conversion-success"]')
        expect(success_message).to be_displayed
      end

      it "does not display warning message if there are no tag overrides in the course" do
        @assignment.assignment_overrides.destroy_all

        user_session(@teacher)
        visit_course(@course)

        expect(element_exists?('[data-testid="course-differentiation-tag-converter-warning"]')).to be_falsey
      end
    end
  end

  context "as a student" do
    before :once do
      course_with_teacher(active_all: true, name: "discussion course")
      @student = User.create!(name: "First Student")
      @course.enroll_student(@student)
    end

    before do
      user_session(@student)
    end

    it "rejects a course invitation", custom_timeout: 20 do
      Account.default.settings[:allow_invitation_previews] = true
      Account.default.save!
      visit_course(@course)
      decline_enrollment_button.click
      wait_for_ajaximations

      assert_flash_notice_message "Invitation canceled."
    end
  end
end
