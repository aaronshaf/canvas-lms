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

require_relative '../../support/request_helper'

describe 'Quizzes::QuizzesController#show GET /courses/:course_id/quizzes/:id (part 2)' do
  # The quiz show view (and its layout partials) call BrandableCSS.handlebars_index_json,
  # which reads from public/dist/brandable_css/brandable_css_handlebars_index.json on disk.
  # Stub it so these request specs don't depend on `yarn run build:css` having been run.
  before do
    allow(BrandableCSS).to receive(:handlebars_index_json).and_return('{}'.html_safe)
  end

  describe 'rubric dialog rendered for a quiz assignment' do
    it "suppresses the 'use for grading' option in the rubric add dialog for a quiz" do
      # Arrange
      course_with_teacher(active_all: true)
      assignment = @course.assignments.create!(
        title: 'Graded Quiz',
        submission_types: 'online_quiz',
        workflow_state: 'published'
      )
      quiz = Quizzes::Quiz.where(assignment_id: assignment.id).first
      quiz.workflow_state = 'available'
      quiz.generate_quiz_data
      quiz.save!
      user_session(@teacher)

      # Act
      get "/courses/#{@course.id}/assignments/#{assignment.id}/rubric"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).not_to include('class="rubric_grading"')
      expect(response.body).not_to include('id="grading_rubric"')
    end
  end

  describe 'as an observer linked to two students in different sections' do
    it 'does not render a take_quiz_button on the quiz show page' do
      # Arrange
      course = course_factory(active_all: true)
      section_a = course.course_sections.create!(name: 'Section A')
      section_b = course.course_sections.create!(name: 'Section B')

      assignment = course.assignments.create!(
        title: 'VDD Quiz',
        submission_types: 'online_quiz',
        workflow_state: 'published'
      )
      quiz = Quizzes::Quiz.where(assignment_id: assignment.id).first
      quiz.update!(workflow_state: 'available', due_at: 2.days.from_now)

      student1 = user_with_pseudonym(username: 'student1@example.com', active_all: 1)
      course.enroll_student(student1, section: section_a, enrollment_state: 'active')
      student2 = user_with_pseudonym(username: 'student2@example.com', active_all: 1)
      course.enroll_student(student2, section: section_b, enrollment_state: 'active')

      observer1 = user_with_pseudonym(username: 'observer1@example.com', active_all: 1)
      course.enroll_user(observer1,
                         'ObserverEnrollment',
                         enrollment_state: 'active',
                         allow_multiple_enrollments: true,
                         section: section_a,
                         associated_user_id: student1.id)
      course.enroll_user(observer1,
                         'ObserverEnrollment',
                         enrollment_state: 'active',
                         allow_multiple_enrollments: true,
                         section: section_b,
                         associated_user_id: student2.id)

      user_session(observer1)

      # Act
      get "/courses/#{course.id}/quizzes/#{quiz.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).not_to match(/class=["'][^"']*\btake_quiz_button\b[^"']*["']/)
    end
  end

  describe 'as an observer linked to a single student in Section B' do
    it 'does not render a take_quiz_button on the quiz show page' do
      # Arrange
      course = course_factory(active_all: true)
      course.course_sections.create!(name: 'Section A')
      section_b = course.course_sections.create!(name: 'Section B')

      assignment = course.assignments.create!(
        title: 'VDD Quiz',
        submission_types: 'online_quiz',
        workflow_state: 'published'
      )
      quiz = Quizzes::Quiz.where(assignment_id: assignment.id).first
      quiz.update!(workflow_state: 'available', due_at: 2.days.from_now)

      student2 = user_with_pseudonym(username: 'student2@example.com', active_all: 1)
      course.enroll_student(student2, section: section_b, enrollment_state: 'active')

      observer2 = user_with_pseudonym(username: 'observer2@example.com', active_all: 1)
      course.enroll_user(observer2,
                         'ObserverEnrollment',
                         enrollment_state: 'active',
                         section: section_b,
                         associated_user_id: student2.id)

      user_session(observer2)

      # Act
      get "/courses/#{course.id}/quizzes/#{quiz.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).not_to match(/class=["'][^"']*\btake_quiz_button\b[^"']*["']/)
    end
  end

  describe 'as a TA enrolled in both sections' do
    it 'renders the preview_quiz_button on the quiz show page' do
      # Arrange
      course = course_factory(active_all: true)
      section_a = course.course_sections.create!(name: 'Section A')
      section_b = course.course_sections.create!(name: 'Section B')

      assignment = course.assignments.create!(
        title: 'VDD Quiz',
        submission_types: 'online_quiz',
        workflow_state: 'published'
      )
      quiz = Quizzes::Quiz.where(assignment_id: assignment.id).first
      quiz.update!(workflow_state: 'available', due_at: 2.days.from_now)

      ta = user_with_pseudonym(username: 'ta1@example.com', active_all: 1)
      course.enroll_ta(ta, section: section_a).accept!
      course.enroll_ta(ta, section: section_b, allow_multiple_enrollments: true).accept!

      user_session(ta)

      # Act
      get "/courses/#{course.id}/quizzes/#{quiz.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to match(/id=["']preview_quiz_button["']/)
    end
  end
end
