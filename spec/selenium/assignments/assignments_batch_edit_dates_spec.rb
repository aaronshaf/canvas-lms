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
require_relative "../helpers/assignments_common"
require_relative "page_objects/assignments_index_page"

describe "assignment batch edit" do
  include_context "in-process server selenium tests"
  include AssignmentsCommon
  include AssignmentsIndexPage

  context "with assignments in course" do
    before(:once) do
      # reference date
      @date = Time.zone.now.change(usec: 0)
      # Course
      @course1 = Course.create!(name: "First Course1")
      # Teacher
      @teacher1 = User.create!
      @teacher1 = User.create!(name: "First Teacher")
      @teacher1.accept_terms
      @teacher1.register!
      @course1.enroll_teacher(@teacher1, enrollment_state: "active")
      # Student1 and Student2 and Student3
      @student1 = User.create!(name: "First Student")
      @student1.accept_terms
      @student1.register!
      @course1.enroll_student(@student1, enrollment_state: "active")
      @student2 = User.create!(name: "Second Student")
      @student2.accept_terms
      @student2.register!
      @course1.enroll_student(@student2, enrollment_state: "active")
      @student3 = User.create!(name: "Third Student")
      @student3.accept_terms
      @student3.register!
      @course1.enroll_student(@student3, enrollment_state: "active")
      # Two Assignments, one with overrides and one with no due date
      @assignment1 = @course1.assignments.create!(
        title: "First Overrides Assignment",
        points_possible: 10,
        submission_types: "online_url,online_upload,online_text_entry",
        due_at: @date + 1.day,
        lock_at: @date + 3.days,
        unlock_at: @date - 3.days
      )
      @assignment2 = @course1.assignments.create!(
        title: "Second Assignment",
        points_possible: 10,
        submission_types: "online_text_entry"
      )
      # add some overrides for Assignment1
      @override1 = create_adhoc_override_for_assignment(@assignment1,
                                                        [@student1],
                                                        { title: "override1",
                                                          due_at: @date - 1.day,
                                                          lock_at: @date + 4.days,
                                                          unlock_at: @date - 4.days })
      @override2 = create_adhoc_override_for_assignment(@assignment1,
                                                        [@student2],
                                                        { title: "override2",
                                                          due_at: @date - 10.days,
                                                          lock_at: @date + 10.days,
                                                          unlock_at: @date - 10.days })
      @override2 = create_adhoc_override_for_assignment(@assignment1,
                                                        [@student3],
                                                        { title: "override3",
                                                          due_at: @date + 10.days,
                                                          lock_at: @date + 20.days,
                                                          unlock_at: @date })
    end

    context "bulk edit feature" do
      before do
        user_session(@teacher1)
        visit_assignments_index_page(@course1.id)
        goto_bulk_edit_view
      end

      it "displays all assignments and overrides in batch view", custom_timeout: 60 do
        bulk_edit_text = bulk_edit_root.text
        # includes both assignments
        expect(bulk_edit_text).to include("First Overrides Assignment")
        expect(bulk_edit_text).to include("Second Assignment")
        # should have 5 rows including overrides and assignment titles
        expect(bulk_edit_tr_rows.count).to eq 5
      end
    end
  end

  context "with peer review assignments" do
    before(:once) do
      @date = Time.zone.now.change(usec: 0, hour: 12)
      @pr_course = Course.create!(name: "Peer Review Course")
      @pr_course.enable_feature!(:peer_review_allocation_and_grading)
      @pr_teacher = User.create!(name: "PR Teacher")
      @pr_teacher.accept_terms
      @pr_teacher.register!
      @pr_course.enroll_teacher(@pr_teacher, enrollment_state: "active")

      @pr_assignment = @pr_course.assignments.create!(
        title: "Graded Peer Review Assignment",
        peer_reviews: true,
        peer_review_count: 1,
        points_possible: 10,
        submission_types: "online_text_entry",
        due_at: @date + 7.days,
        unlock_at: @date + 1.day,
        lock_at: @date + 21.days
      )
      @pr_sub = PeerReview::PeerReviewCreatorService.call(
        parent_assignment: @pr_assignment,
        points_possible: 10,
        grading_type: "points",
        due_at: @date + 10.days,
        unlock_at: @date + 8.days,
        lock_at: @date + 14.days
      )
      @pr_assignment.reload

      @legacy_pr_assignment = @pr_course.assignments.create!(
        title: "Legacy Peer Review Assignment",
        peer_reviews: true,
        peer_review_count: 1,
        points_possible: 10,
        submission_types: "online_text_entry",
        due_at: @date + 3.days,
        unlock_at: @date + 1.day,
        lock_at: @date + 10.days
      )
    end

    context "when in graded peer review mode (peer review allocation and grading feature enabled)", :ignore_js_errors do
      before do
        @pr_course.enable_feature!(:peer_review_allocation_and_grading)
        user_session(@pr_teacher)
        visit_assignments_index_page(@pr_course.id)
        goto_bulk_edit_view
      end

      it "can edit and persist peer review due date for assignment with graded peer reviews", custom_timeout: 60 do
        new_review_date = format_date_for_view(@pr_assignment.due_at + 3.days, "%m/%d/%Y")
        input = review_due_date_input(@pr_assignment.name)
        replace_content(input, new_review_date, tab_out: true)
        save_bulk_edited_dates

        expect(format_date_for_view(@pr_sub.reload.due_at, "%m/%d/%Y")).to eq new_review_date
      end

      it "shifts the peer review due date when batch shifting dates forward", custom_timeout: 60 do
        shift_days = 3
        original_review_due = @pr_sub.due_at

        select_assignment_checkbox(@pr_assignment.name).click
        open_batch_edit_dialog
        replace_content(batch_edit_shift_days_input, shift_days.to_s)
        batch_edit_confirm_button.click
        wait_for_ajaximations
        save_bulk_edited_dates

        expect(@pr_sub.reload.due_at).to be_within(1.minute).of(original_review_due + shift_days.days)
      end

      it "clears parent availability dates and re-derives peer review availability dates when batch removing availability dates", custom_timeout: 60 do
        select_assignment_checkbox(@pr_assignment.name).click
        open_batch_edit_dialog
        batch_edit_remove_dates_radio_label.click
        batch_edit_remove_availability_dates_radio_label.click
        batch_edit_confirm_button.click
        wait_for_ajaximations
        save_bulk_edited_dates

        expect(@pr_assignment.reload.unlock_at).to be_nil
        expect(@pr_assignment.lock_at).to be_nil
        # Peer review dates are derived from parent at serialization time:
        # unlock_at from parent due_at, lock_at from parent lock_at.
        expect(@pr_sub.reload.unlock_at).to eq(@pr_assignment.due_at)
        expect(@pr_sub.lock_at).to be_nil
      end

      it "does not render peer review due date input for assignment with legacy peer reviews", custom_timeout: 60 do
        expect(assignment_dates_inputs(@legacy_pr_assignment.name).count).to eq 3
      end
    end

    context "with a pre-existing invalid peer review due date", :ignore_js_errors do
      before do
        @pr_course.enable_feature!(:peer_review_allocation_and_grading)
        # update_columns bypasses model validations so we can simulate data introduced
        # via API/console/migration that left peer_review.due_at before parent due_at.
        @pr_sub.update_columns(due_at: @pr_assignment.due_at - 5.days)
        user_session(@pr_teacher)
        visit_assignments_index_page(@pr_course.id)
        goto_bulk_edit_view
      end

      it "re-enables Save once the invalid review due date is corrected", custom_timeout: 60 do
        expect(bulk_edit_save_button.attribute("disabled")).to be_truthy

        fixed_review_date = format_date_for_view(@pr_assignment.due_at + 3.days, "%m/%d/%Y")
        replace_content(review_due_date_input(@pr_assignment.name), fixed_review_date, tab_out: true)
        wait_for_ajaximations

        expect(bulk_edit_root).not_to include_text("Due date cannot be before assignment due date")
        expect(bulk_edit_save_button.attribute("disabled")).to be_falsey
      end
    end

    context "when in legacy peer review mode (feature disabled)", :ignore_js_errors do
      before do
        @pr_course.disable_feature!(:peer_review_allocation_and_grading)
        user_session(@pr_teacher)
        visit_assignments_index_page(@pr_course.id)
        goto_bulk_edit_view
      end

      it "does not render the Review Due Date column", custom_timeout: 60 do
        expect(bulk_edit_root.text).not_to include("Review Due Date")
        expect(assignment_dates_inputs(@pr_assignment.name).count).to eq 3
      end

      it "does not change peer review sub assignment dates when parent availability dates are removed", custom_timeout: 60 do
        original_due_at = @pr_sub.due_at
        original_unlock_at = @pr_sub.unlock_at
        original_lock_at = @pr_sub.lock_at

        select_assignment_checkbox(@pr_assignment.name).click
        open_batch_edit_dialog
        batch_edit_remove_dates_radio_label.click
        batch_edit_remove_availability_dates_radio_label.click
        batch_edit_confirm_button.click
        wait_for_ajaximations
        save_bulk_edited_dates

        expect(@pr_assignment.reload.unlock_at).to be_nil
        expect(@pr_assignment.lock_at).to be_nil
        expect(@pr_sub.reload.due_at).to be_within(1.minute).of(original_due_at)
        expect(@pr_sub.unlock_at).to be_within(1.minute).of(original_unlock_at)
        expect(@pr_sub.lock_at).to be_within(1.minute).of(original_lock_at)
      end
    end
  end

  context "in a paced course" do
    before do
      course_with_teacher_logged_in
      @course.enable_course_paces = true
      @course.save!

      @course.assignments.create!(
        title: "Overrides Assignment",
        points_possible: 10,
        submission_types: "online_url,online_upload,online_text_entry"
      )
    end

    it "does not include Edit Assignment Dates in the page menu" do
      visit_assignments_index_page(@course.id)
      course_assignments_settings_button.click
      expect(f("body")).not_to contain_jqcss(bulk_edit_dates_menu_jqselector)
      expect(assignment_groups_weight).to be_displayed
    end
  end
end
