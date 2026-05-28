# frozen_string_literal: true

#
# Copyright (C) 2023 - present Instructure, Inc.
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

require_relative "../../helpers/gradebook_common"
require_relative "../pages/enhanced_srgb_page"
require_relative "../pages/speedgrader_page"

describe "Individual View Gradebook" do
  include_context "in-process server selenium tests"
  include GradebookCommon

  before(:once) do
    # create a course with a teacher
    @teacher1 = course_with_teacher(course_name: "Course1", active_all: true).user

    # enroll a second teacher
    @teacher2 = course_with_teacher(course: @course, name: "Teacher2", active_all: true).user

    # enroll two students
    @student1 = course_with_student(course: @course, name: "Student1", active_all: true).user
    @student2 = course_with_student(course: @course, name: "Student2", active_all: true).user
  end

  context "with an anonymous assignment" do
    before(:once) do
      # create a new anonymous assignment
      @anonymous_assignment = @course.assignments.create!(
        title: "Anonymous Assignment",
        submission_types: "online_text_entry",
        anonymous_grading: true,
        points_possible: 10
      )

      # create an unmuted anonymous assignment
      @unmuted_anonymous_assignment = @course.assignments.create!(
        title: "Unmuted Anon Assignment",
        submission_types: "online_text_entry",
        anonymous_grading: true,
        points_possible: 10
      )
      @unmuted_anonymous_assignment.unmute!
    end

    before do
      user_session(@teacher1)
      EnhancedSRGB.visit(@course.id)
    end

    it "speedgrader link opens in new tab" do
      EnhancedSRGB.select_assignment(@anonymous_assignment)
      scroll_into_view('[data-testid="assignment-speedgrader-link"]')

      speedgrader_link = EnhancedSRGB.speedgrader_link
      expect(speedgrader_link.attribute("target")).to eq("_blank")
      expect(speedgrader_link.attribute("href")).to include(
        "/courses/#{@course.id}/gradebook/speed_grader?assignment_id=#{@anonymous_assignment.id}"
      )
    end

    it "hides student names in speedgrader" do
      EnhancedSRGB.select_assignment(@anonymous_assignment)
      scroll_into_view('[data-testid="assignment-speedgrader-link"]')
      EnhancedSRGB.speedgrader_link.click

      driver.switch_to.window(driver.window_handles.last)

      Speedgrader.students_dropdown_button.click

      student_names = Speedgrader.students_select_menu_list.map(&:text)
      expect(student_names).to match_array ["Student 1", "Student 2"]
    end
  end
end
