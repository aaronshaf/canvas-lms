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

require_relative "page_objects/widget_dashboard_page"
require_relative "../../helpers/student_dashboard_common"

describe "student dashboard Recent grades & feedback widget", :ignore_js_errors do
  include_context "in-process server selenium tests"
  include WidgetDashboardPage
  include StudentDashboardCommon

  before :once do
    dashboard_student_setup
    dashboard_course_assignment_setup
    dashboard_course_submission_setup
    dashboard_course_grade_setup
    dashboard_recent_grades_setup
    set_widget_dashboard_flag(feature_status: true)
    enable_widget_dashboard_for(@student)
  end

  before do
    user_session(@student)
  end

  context "recent grades & feedback widget smoke tests" do
    it "displays graded and feedback assignment, discussion, and quiz submissions" do
      go_to_dashboard

      expect(all_recent_grade_course_name.size).to eq(5)
      expect(recent_grades_widget.text).to include(@graded_assignment.name)
      expect(recent_grades_widget.text).to include(@graded_discussion.title)
      expect(recent_grades_widget.text).to include(@graded_quiz.title)
      expect(recent_grades_widget.text).to include(@submitted_assignment.name)
      expect(recent_grades_widget.text).to include(@submitted_discussion.title)
    end
  end

  context "Recent grades & feedback widget pagination" do
    before :once do
      pagination_recent_grades_setup # Creates 27 assignments
    end

    it "maintains pagination when switching filters" do
      go_to_dashboard

      expect(widget_pagination_button("Recent grades", "3")).to be_displayed
      filter_recent_grades_by_course(@course1.name)
      expect(widget_pagination_button("Recent grades", "3")).to be_displayed
      widget_pagination_button("Recent grades", "3").click
      expect(all_recent_grade_course_name.size).to eq(2)

      filter_recent_grades_by_course(@course2.name)
      expect(all_recent_grade_course_name.size).to eq(2)
    end
  end

  context "navigation workflows" do
    it "navigates to assignment with feedback when clicking view inline feedback link" do
      submission = @graded_assignment.submission_for_student(@student)

      go_to_dashboard
      expand_feedback_on_recent_grade(submission.id)

      expect(recent_grade_view_feedback_link(submission.id)).to be_displayed
      expect(recent_grade_feedback_section(submission.id).text).to include("Place for improvement...")
      recent_grade_view_feedback_link(submission.id).click
      expect(driver.current_url).to include("/courses/#{@course2.id}/assignments/#{@graded_assignment.id}")
    end
  end

  context "pre-submission feedback" do
    before :once do
      @presubmission_assignment = @course1.assignments.create!(
        name: "Course 1: Pre-submission Feedback Assignment",
        points_possible: 10,
        submission_types: "online_text_entry"
      )
      @presubmission_assignment.submission_for_student(@student).add_comment(
        author: @teacher1,
        comment: "Get started early on this one!"
      )
    end

    it "displays unsubmitted assignment with instructor feedback" do
      go_to_dashboard
      submission = @presubmission_assignment.submission_for_student(@student)

      expect(recent_grades_widget.text).to include(@presubmission_assignment.name)
      expect(recent_grade_expand_button(submission.id)).to be_displayed
    end
  end
end
