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

describe "AssignmentsController" do
  # ---------------------------------------------------------------------------
  # Moderation page pagination
  # Covers: spec/selenium/grades/moderation/moderate_page_large_students_spec.rb:91
  # ---------------------------------------------------------------------------
  describe "GET /courses/:course_id/assignments/:assignment_id/moderate" do
    it "returns :ok and renders the moderate page for the final grader" do
      # Arrange
      course = course_factory(active_all: true)
      final_grader = teacher_in_course(active_all: true, course:).user
      assignment = course.assignments.create!(
        title: "Moderated Assignment",
        grader_count: 2,
        final_grader_id: final_grader.id,
        submission_types: "online_text_entry",
        grading_type: "points",
        points_possible: 10,
        moderated_grading: true
      )
      user_session(final_grader)

      # Act
      get "/courses/#{course.id}/assignments/#{assignment.id}/moderate"

      # Assert
      expect(response).to have_http_status(:ok)
    end
  end

  # ---------------------------------------------------------------------------
  # Gradeable students API paginates to 20 per page
  # Covers: spec/selenium/grades/moderation/moderate_page_large_students_spec.rb:91
  # The moderate-page React app calls this API with per_page=20; the first page
  # must return exactly 20 records when 25 students are enrolled.
  # ---------------------------------------------------------------------------
  describe "GET /api/v1/courses/:course_id/assignments/:assignment_id/gradeable_students" do
    it "returns 20 students on the first page when 25 are enrolled" do
      # Arrange
      course = course_factory(active_all: true)
      final_grader = teacher_in_course(active_all: true, course:).user
      assignment = course.assignments.create!(
        title: "Moderated Assignment",
        grader_count: 3,
        final_grader_id: final_grader.id,
        submission_types: "online_text_entry",
        grading_type: "points",
        points_possible: 10,
        moderated_grading: true
      )
      students = create_users_in_course(course, 25, return_type: :record, enrollment_type: "StudentEnrollment")
      students.each { |s| assignment.submit_homework(s, body: "submitted") }
      user_session(final_grader)

      # Act
      get "/api/v1/courses/#{course.id}/assignments/#{assignment.id}/gradeable_students",
          params: { per_page: 20, page: 1 }

      # Assert
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json.length).to eq(20)
    end

    it "returns the remaining 5 students on page 2 when 25 are enrolled" do
      # Arrange
      course = course_factory(active_all: true)
      final_grader = teacher_in_course(active_all: true, course:).user
      assignment = course.assignments.create!(
        title: "Moderated Assignment",
        grader_count: 3,
        final_grader_id: final_grader.id,
        submission_types: "online_text_entry",
        grading_type: "points",
        points_possible: 10,
        moderated_grading: true
      )
      students = create_users_in_course(course, 25, return_type: :record, enrollment_type: "StudentEnrollment")
      students.each { |s| assignment.submit_homework(s, body: "submitted") }
      user_session(final_grader)

      # Act
      get "/api/v1/courses/#{course.id}/assignments/#{assignment.id}/gradeable_students",
          params: { per_page: 20, page: 2 }

      # Assert
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json.length).to eq(5)
    end
  end

  # ---------------------------------------------------------------------------
  # Bulk-select provisional grades for a grader
  # Covers: spec/selenium/grades/moderation/moderate_page_large_students_spec.rb:115
  # The "Accept grades for grader" button calls PUT
  # /api/v1/courses/:id/assignments/:id/provisional_grades/bulk_select with all
  # provisional grade ids belonging to that grader.  After the call, the
  # selected_provisional_grade_id on each affected selection must point to the
  # accepted grader's provisional grade.
  # ---------------------------------------------------------------------------
  describe "PUT /api/v1/courses/:course_id/assignments/:assignment_id/provisional_grades/bulk_select" do
    it "selects each student's provisional grade for the accepted grader" do
      # Arrange
      course = course_factory(active_all: true)
      final_grader = teacher_in_course(active_all: true, course:).user
      provisional_grader = teacher_in_course(active_all: true, course:).user
      assignment = course.assignments.create!(
        title: "Moderated Assignment",
        grader_count: 3,
        final_grader_id: final_grader.id,
        submission_types: "online_text_entry",
        grading_type: "points",
        points_possible: 10,
        moderated_grading: true
      )
      students = create_users_in_course(course, 7, return_type: :record, enrollment_type: "StudentEnrollment")

      # Create moderation selections (required before bulk_select)
      students.each { |s| assignment.moderated_grading_selections.find_or_create_by!(student: s) }

      provisional_grades = students.map do |student|
        graded = assignment.grade_student(student, grade: "8", grader: provisional_grader, provisional: true)
        graded.first.provisional_grade(provisional_grader)
      end

      user_session(final_grader)

      # Act
      put "/api/v1/courses/#{course.id}/assignments/#{assignment.id}/provisional_grades/bulk_select",
          params: { provisional_grade_ids: provisional_grades.map(&:id) }

      # Assert
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json.length).to eq(7)
      accepted_ids = json.pluck("selected_provisional_grade_id")
      expect(accepted_ids).to match_array(provisional_grades.map(&:id))
    end

    it "records the selected provisional grade id in each student's moderation selection" do
      # Arrange
      course = course_factory(active_all: true)
      final_grader = teacher_in_course(active_all: true, course:).user
      provisional_grader = teacher_in_course(active_all: true, course:).user
      assignment = course.assignments.create!(
        title: "Moderated Assignment",
        grader_count: 3,
        final_grader_id: final_grader.id,
        submission_types: "online_text_entry",
        grading_type: "points",
        points_possible: 10,
        moderated_grading: true
      )
      students = create_users_in_course(course, 3, return_type: :record, enrollment_type: "StudentEnrollment")

      # Create moderation selections (required before bulk_select)
      students.each { |s| assignment.moderated_grading_selections.find_or_create_by!(student: s) }

      provisional_grades = students.map do |student|
        graded = assignment.grade_student(student, grade: "7", grader: provisional_grader, provisional: true)
        graded.first.provisional_grade(provisional_grader)
      end

      user_session(final_grader)

      # Act
      put "/api/v1/courses/#{course.id}/assignments/#{assignment.id}/provisional_grades/bulk_select",
          params: { provisional_grade_ids: provisional_grades.map(&:id) }

      # Assert
      expect(response).to have_http_status(:ok)
      selections = assignment.moderated_grading_selections.where(student_id: students.map(&:id))
      selected_pg_ids = selections.pluck(:selected_provisional_grade_id)
      expect(selected_pg_ids).to match_array(provisional_grades.map(&:id))
    end
  end
end
