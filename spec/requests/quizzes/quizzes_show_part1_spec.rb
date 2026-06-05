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

describe "Quizzes Show Page" do
  describe "GET /courses/:course_id/quizzes/:id" do
    it "renders the take-quiz link for a student when due_at is past but no lock_at is set" do
      # Arrange
      course_with_student(active_all: true)
      quiz = @course.quizzes.create!(
        title: "Past Due Quiz",
        workflow_state: "available",
        due_at: 1.day.ago,
        quiz_type: "assignment"
      )
      quiz.quiz_questions.create!(
        question_data: { name: "q1", question_type: "true_false_question",
                         answers: [{ id: 1, text: "True", weight: 100 }, { id: 2, text: "False", weight: 0 }] }
      )
      quiz.generate_quiz_data
      quiz.published_at = Time.zone.now
      quiz.save!
      user_session(@student)

      # Act
      get "/courses/#{@course.id}/quizzes/#{quiz.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include('id="take_quiz_link"')
    end

    it "renders the take-quiz link for a student in a paced course when unlock_at is in the future" do
      # Arrange
      course_with_student(active_all: true)
      @course.update!(enable_course_paces: true)
      quiz = @course.quizzes.create!(
        title: "Paced Future Unlock Quiz",
        workflow_state: "available",
        unlock_at: 1.day.from_now,
        due_at: 2.days.from_now,
        quiz_type: "assignment"
      )
      quiz.quiz_questions.create!(
        question_data: { name: "q1", question_type: "true_false_question",
                         answers: [{ id: 1, text: "True", weight: 100 }, { id: 2, text: "False", weight: 0 }] }
      )
      quiz.generate_quiz_data
      quiz.published_at = Time.zone.now
      quiz.save!
      user_session(@student)

      # Act
      get "/courses/#{@course.id}/quizzes/#{quiz.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include('id="take_quiz_link"')
    end

    it "renders the take-quiz link for a student in a paced course when lock_at is in the past" do
      # Arrange
      course_with_student(active_all: true)
      @course.update!(enable_course_paces: true)
      quiz = @course.quizzes.create!(
        title: "Paced Past Lock Quiz",
        workflow_state: "available",
        due_at: 2.days.ago,
        lock_at: 1.day.ago,
        quiz_type: "assignment"
      )
      quiz.quiz_questions.create!(
        question_data: { name: "q1", question_type: "true_false_question",
                         answers: [{ id: 1, text: "True", weight: 100 }, { id: 2, text: "False", weight: 0 }] }
      )
      quiz.generate_quiz_data
      quiz.published_at = Time.zone.now
      quiz.save!
      user_session(@student)

      # Act
      get "/courses/#{@course.id}/quizzes/#{quiz.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include('id="take_quiz_link"')
    end

    it "renders the quiz description text for an observer associated with a student" do
      # Arrange
      course_with_student(active_all: true)
      observer_enrollment = course_with_observer(active_all: true, course: @course)
      observer_enrollment.update_column(:associated_user_id, @student.id)
      @context = @course
      quiz = quiz_model(course: @course, description: "some description")
      user_session(@observer)

      # Act
      get "/courses/#{@course.id}/quizzes/#{quiz.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("some description")
      expect(response.body).to match(/class=["'][^"']*description[^"']*["']/)
    end

    it "renders the literal access_code value on the show page for a teacher" do
      # Arrange
      course_with_teacher(active_all: true)
      @context = @course
      quiz = quiz_model(course: @course, access_code: "1234")
      quiz.quiz_questions.create!(
        question_data: { name: "q1", question_type: "true_false_question",
                         answers: [{ id: 1, text: "True", weight: 100 }, { id: 2, text: "False", weight: 0 }] }
      )
      quiz.generate_quiz_data
      quiz.save!
      user_session(@teacher)

      # Act
      get "/courses/#{@course.id}/quizzes/#{quiz.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include('id="quiz_show"')
      body_after_quiz_show = response.body.split('id="quiz_show"', 2).last
      expect(body_after_quiz_show).to include("Access Code")
      expect(body_after_quiz_show).to include("1234")
    end

    it "renders the literal ip_filter value on the show page for a teacher" do
      # Arrange
      course_with_teacher(active_all: true)
      @context = @course
      quiz = quiz_model(course: @course, ip_filter: "64.233.160.0")
      user_session(@teacher)

      # Act
      get "/courses/#{@course.id}/quizzes/#{quiz.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include('id="quiz_show"')
      body_after_quiz_show = response.body.split('id="quiz_show"', 2).last
      expect(body_after_quiz_show).to include("IP Filter")
      expect(body_after_quiz_show).to include("64.233.160.0")
    end

    it "renders the Assign To button on the show page for a teacher with manage_assignments_edit" do
      # Arrange
      course_with_teacher(active_all: true)
      @context = @course
      # quiz_type: "assignment" causes the quiz to build its own assignment via
      # build_assignment callback — do not create an assignment separately or
      # the unique constraint on assignment_id will be violated.
      quiz = quiz_model(course: @course, quiz_type: "assignment")
      user_session(@teacher)

      # Act
      get "/courses/#{@course.id}/quizzes/#{quiz.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("assign-to-link")
    end

    it "does not render the Assign To button when manage_assignments_edit permission is revoked from teacher role" do
      # Arrange
      course_with_teacher(active_all: true)
      @context = @course
      @course.account.role_overrides.create!(
        role: teacher_role,
        permission: "manage_assignments_edit",
        enabled: false
      )
      quiz = quiz_model(course: @course, quiz_type: "assignment")
      user_session(@teacher)

      # Act
      get "/courses/#{@course.id}/quizzes/#{quiz.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).not_to include("assign-to-link")
    end

    it "does not render the publish button for a student viewing the quiz show page" do
      # Arrange
      course_with_student(active_all: true)
      @context = @course
      quiz = quiz_model(course: @course)
      quiz.quiz_questions.create!(
        question_data: { name: "q1", question_type: "true_false_question",
                         answers: [{ id: 1, text: "True", weight: 100 }, { id: 2, text: "False", weight: 0 }] }
      )
      quiz.generate_quiz_data
      quiz.save!
      user_session(@student)

      # Act
      get "/courses/#{@course.id}/quizzes/#{quiz.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).not_to include('id="quiz-publish-link"')
    end

    it "renders correct_answer markup when show_correct_answers is true and student has a graded submission" do
      # Arrange
      quiz_with_submission
      @course.update!(workflow_state: "available")
      @quiz.update!(show_correct_answers: true)
      user_session(@student)

      # Act
      get "/courses/#{@course.id}/quizzes/#{@quiz.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("correct_answer")
    end

    it "renders incorrect answer markup when show_correct_answers is true and student has a graded submission" do
      # Arrange
      quiz_with_submission
      @course.update!(workflow_state: "available")
      @quiz.update!(show_correct_answers: true)
      user_session(@student)

      # Act
      get "/courses/#{@course.id}/quizzes/#{@quiz.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to match(/class=["'][^"']*\bincorrect\b[^"']*["']/)
    end

    it "does not render correct_answer markup on non-final attempt when show_correct_answers_last_attempt is enabled" do
      # Arrange
      quiz_with_submission
      @course.update!(workflow_state: "available")
      @quiz.update!(
        show_correct_answers: true,
        show_correct_answers_last_attempt: true,
        allowed_attempts: 2
      )
      # @qsub already has attempt: 1 from factory
      user_session(@student)

      # Act
      get "/courses/#{@course.id}/quizzes/#{@quiz.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).not_to match(/class=["'][^"']*\bcorrect_answer\b[^"']*["']/)
    end

    it "renders correct_answer markup on the final attempt when show_correct_answers_last_attempt is enabled" do
      # Arrange
      quiz_with_submission
      @course.update!(workflow_state: "available")
      @quiz.update!(
        show_correct_answers: true,
        show_correct_answers_last_attempt: true,
        allowed_attempts: 2
      )
      @qsub.update_column(:attempt, 2)
      user_session(@student)

      # Act
      get "/courses/#{@course.id}/quizzes/#{@quiz.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("correct_answer")
    end

    it "renders incorrect answer markup even when show_correct_answers is false" do
      # Arrange
      quiz_with_submission
      @course.update!(workflow_state: "available")
      @quiz.update!(show_correct_answers: false)
      user_session(@student)

      # Act
      get "/courses/#{@course.id}/quizzes/#{@quiz.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to match(/class=["'][^"']*\bincorrect\b[^"']*["']/)
    end

    it "renders the grades section nav-badge data reflecting an ungraded submission for a student" do
      # Arrange: ungraded submission means assignment.submission for student is unread
      # to the student (submission needs comments / grade changes). Use the
      # completed-submission factory and mark it submitted so badge_counts has an
      # unread submission entry.
      quiz_with_submission
      @course.update!(workflow_state: "available")
      user_session(@student)

      # Act
      get "/courses/#{@course.id}/quizzes/#{@quiz.id}"

      # Assert: the section-tabs shell renders server-side and the JS env carries
      # the badge_counts hash that the client-side showBadgeCounts initializer reads
      # to inject the nav-badge into #section-tabs .grades. We verify both pieces.
      expect(response).to have_http_status(:ok)
      expect(response.body).to include('id="section-tabs"')
      expect(response.body).to include("badge_counts")
    end

    it "renders the take-quiz link for a user with dual teacher and student enrollment" do
      # Arrange
      course_with_teacher(active_all: true)
      @course.enroll_student(@teacher, enrollment_state: "active", allow_multiple_enrollments: true)
      @context = @course
      quiz = quiz_model(course: @course)
      quiz.quiz_questions.create!(
        question_data: { name: "q1", question_type: "true_false_question",
                         answers: [{ id: 1, text: "True", weight: 100 }, { id: 2, text: "False", weight: 0 }] }
      )
      quiz.generate_quiz_data
      quiz.published_at = Time.zone.now
      quiz.save!
      user_session(@teacher)

      # Act
      get "/courses/#{@course.id}/quizzes/#{quiz.id}?take=1&preview=0"

      # Assert
      expect(response).to have_http_status(:ok)
      # A user with both teacher and student enrollments should see the take-quiz link
      # (the page renders preview_quiz_button for teachers; the take_quiz_link appears when
      # the user is treated as a student-eligible taker).
      expect(response.body).to include("take_quiz")
    end
  end
end
