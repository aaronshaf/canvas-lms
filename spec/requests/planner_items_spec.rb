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

describe "Planner API" do
  # ---------------------------------------------------------------------------
  # GET /api/v1/planner/items — submission data assertions
  # Covers: k5_dashboard_teacher_spec.rb planner behaviors
  # ---------------------------------------------------------------------------
  describe "GET /api/v1/planner/items" do
    it "returns graded:true in submissions when assignment is graded" do
      # Arrange
      course = course_factory(active_all: true)
      student = user_factory(active_all: true)
      student_in_course(course:, user: student, active_all: true)
      teacher = teacher_in_course(course:, active_all: true).user
      assignment = course.assignments.create!(
        title: "Graded Assignment",
        due_at: 1.week.from_now,
        submission_types: "online_text_entry",
        points_possible: 10
      )
      assignment.grade_student(student, grade: 10, grader: teacher)
      user_session(student)

      # Act
      get "/api/v1/planner/items",
          params: { start_date: 2.weeks.ago.to_date.to_s, end_date: 2.weeks.from_now.to_date.to_s }

      # Assert
      expect(response).to have_http_status(:ok)
      item = response.parsed_body.find { |i| i["plannable_id"] == assignment.id && i["plannable_type"] == "assignment" }
      expect(item).not_to be_nil
      expect(item["submissions"]["graded"]).to be true
      expect(item["submissions"]["has_feedback"]).to be false
    end

    it "returns has_feedback:true in submissions when teacher adds a comment" do
      # Arrange
      course = course_factory(active_all: true)
      student = user_factory(active_all: true)
      student_in_course(course:, user: student, active_all: true)
      teacher = teacher_in_course(course:, active_all: true).user
      assignment = course.assignments.create!(
        title: "Feedback Assignment",
        due_at: 1.week.from_now,
        submission_types: "online_text_entry"
      )
      submission = assignment.submit_homework(student, submission_type: "online_text_entry", body: "my work")
      submission.add_comment(comment: "Great job!", author: teacher)
      user_session(student)

      # Act
      get "/api/v1/planner/items",
          params: { start_date: 2.weeks.ago.to_date.to_s, end_date: 2.weeks.from_now.to_date.to_s }

      # Assert
      expect(response).to have_http_status(:ok)
      item = response.parsed_body.find { |i| i["plannable_id"] == assignment.id && i["plannable_type"] == "assignment" }
      expect(item).not_to be_nil
      expect(item["submissions"]["has_feedback"]).to be true
      expect(item["submissions"]["graded"]).to be false
    end

    it "returns the course html_url in plannable items so the client can navigate to the course" do
      # Arrange
      course = course_factory(active_all: true)
      student = user_factory(active_all: true)
      student_in_course(course:, user: student, active_all: true)
      assignment = course.assignments.create!(
        title: "Course Link Assignment",
        due_at: 1.week.from_now
      )
      user_session(student)

      # Act
      get "/api/v1/planner/items",
          params: { start_date: 2.weeks.ago.to_date.to_s, end_date: 2.weeks.from_now.to_date.to_s }

      # Assert
      expect(response).to have_http_status(:ok)
      item = response.parsed_body.find { |i| i["plannable_id"] == assignment.id && i["plannable_type"] == "assignment" }
      expect(item).not_to be_nil
      expect(item["html_url"]).to eq("/courses/#{course.id}/assignments/#{assignment.id}")
      expect(item["context_name"]).to eq(course.name)
    end

    it "returns new_activity:true for a graded discussion with unread teacher replies" do
      # Arrange
      course = course_factory(active_all: true)
      student = user_factory(active_all: true)
      student_in_course(course:, user: student, active_all: true)
      teacher = teacher_in_course(course:, active_all: true).user
      assignment = course.assignments.create!(
        title: "Graded Discussion Assignment",
        due_at: 1.week.from_now,
        submission_types: "discussion_topic"
      )
      topic = assignment.discussion_topic
      entry = topic.discussion_entries.create!(message: "Student reply", user: student)
      entry.reply_from(user: teacher, text: "Teacher response")
      topic.reload
      user_session(student)

      # Act
      get "/api/v1/planner/items",
          params: {
            filter: "new_activity",
            start_date: 2.weeks.ago.to_date.to_s,
            end_date: 2.weeks.from_now.to_date.to_s
          }

      # Assert
      expect(response).to have_http_status(:ok)
      discussion_item = response.parsed_body.find do |i|
        i["plannable_id"] == topic.id && i["plannable_type"] == "discussion_topic"
      end
      expect(discussion_item).not_to be_nil
      expect(discussion_item["new_activity"]).to be true
      expect(discussion_item["plannable"]["unread_count"]).to eql(1)
    end

    it "returns an empty list when the student has no upcoming assignments" do
      # Arrange
      course = course_factory(active_all: true)
      student = user_factory(active_all: true)
      student_in_course(course:, user: student, active_all: true)
      user_session(student)

      # Act
      get "/api/v1/planner/items",
          params: { start_date: 1.day.from_now.to_date.to_s, end_date: 4.weeks.from_now.to_date.to_s }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to be_empty
    end

    it "returns context_image from the course image_url when the course has an image set" do
      # Arrange
      course = course_factory(active_all: true)
      student = user_factory(active_all: true)
      student_in_course(course:, user: student, active_all: true)
      course.image_url = "https://example.com/course-image.jpg"
      course.save!
      assignment = course.assignments.create!(
        title: "Image Course Assignment",
        due_at: 1.week.from_now
      )
      user_session(student)

      # Act
      get "/api/v1/planner/items",
          params: { start_date: 2.weeks.ago.to_date.to_s, end_date: 2.weeks.from_now.to_date.to_s }

      # Assert
      expect(response).to have_http_status(:ok)
      item = response.parsed_body.find { |i| i["plannable_id"] == assignment.id && i["plannable_type"] == "assignment" }
      expect(item).not_to be_nil
      expect(item["context_image"]).to eq("https://example.com/course-image.jpg")
    end

    it "returns both a planner_note and an assignment in the same date range" do
      # Arrange
      course = course_factory(active_all: true)
      student = user_factory(active_all: true)
      student_in_course(course:, user: student, active_all: true)
      due_date = 1.week.from_now
      assignment = course.assignments.create!(title: "Group Assignment", due_at: due_date)
      planner_note_model(user: student, todo_date: due_date, course:)
      user_session(student)

      # Act
      get "/api/v1/planner/items",
          params: { start_date: 2.weeks.ago.to_date.to_s, end_date: 2.weeks.from_now.to_date.to_s }

      # Assert
      expect(response).to have_http_status(:ok)
      assignment_item = response.parsed_body.find { |i| i["plannable_type"] == "assignment" }
      note_item = response.parsed_body.find { |i| i["plannable_type"] == "planner_note" }
      expect(assignment_item).not_to be_nil
      expect(assignment_item["plannable_id"]).to eq(assignment.id)
      expect(note_item).not_to be_nil
      expect(note_item["plannable_id"]).to eq(@planner_note.id)
    end

    it "returns missing:true for a past-due assignment that was not submitted" do
      # Arrange
      course = course_factory(active_all: true)
      student = user_factory(active_all: true)
      student_in_course(course:, user: student, active_all: true)
      assignment = course.assignments.create!(
        title: "Overdue Assignment",
        due_at: 3.days.ago,
        submission_types: "online_text_entry"
      )
      user_session(student)

      # Act
      get "/api/v1/planner/items",
          params: { start_date: 2.weeks.ago.to_date.to_s, end_date: 1.day.ago.to_date.to_s }

      # Assert
      expect(response).to have_http_status(:ok)
      item = response.parsed_body.find { |i| i["plannable_id"] == assignment.id && i["plannable_type"] == "assignment" }
      expect(item).not_to be_nil
      expect(item["submissions"]["missing"]).to be true
    end
  end

  # ---------------------------------------------------------------------------
  # POST /api/v1/planner_notes — create a todo item
  # Covers: k5_dashboard_teacher_spec.rb todo modal
  # ---------------------------------------------------------------------------
  describe "POST /api/v1/planner_notes" do
    it "creates a planner note successfully so todo modal data is persisted" do
      # Arrange
      course = course_factory(active_all: true)
      student = user_factory(active_all: true)
      student_in_course(course:, user: student, active_all: true)
      user_session(student)
      todo_title = "My New To-Do Item"
      todo_date = 3.days.from_now.iso8601

      # Act
      post "/api/v1/planner_notes",
           params: { title: todo_title, todo_date:, course_id: course.id }

      # Assert
      expect(response).to have_http_status(:created)
      json = response.parsed_body
      expect(json["title"]).to eq(todo_title)
      expect(json["course_id"]).to eq(course.id)
      expect(json["workflow_state"]).to eq("active")
    end
  end

  # ---------------------------------------------------------------------------
  # DELETE /api/v1/planner_notes/:id — delete a todo item
  # Covers: k5_dashboard_teacher_spec.rb todo close behavior
  # ---------------------------------------------------------------------------
  describe "DELETE /api/v1/planner_notes/:id" do
    it "deletes a planner note so the closed todo sidebar state is reflected in API" do
      # Arrange
      course = course_factory(active_all: true)
      student = user_factory(active_all: true)
      student_in_course(course:, user: student, active_all: true)
      note = planner_note_model(user: student, todo_date: 1.week.from_now, course:)
      user_session(student)

      # Act
      delete "/api/v1/planner_notes/#{note.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json["workflow_state"]).to eq("deleted")
      expect(student.planner_notes.active.find_by(id: note.id)).to be_nil
    end
  end
end
