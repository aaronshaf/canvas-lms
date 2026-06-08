# frozen_string_literal: true

#
# Copyright (C) 2015 - present Instructure, Inc.
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

RSpec.describe "submission preview" do
  describe "GET /courses/:course_id/assignments/:assignment_id/submissions/:id" do
    let(:course) { course_factory(active_course: true) }
    let(:teacher) { teacher_in_course(course:, active_all: true).user }
    let(:student) { student_in_course(course:, active_all: true).user }
    let(:assignment) { course.assignments.create!(title: "Test Assignment") }

    before { user_session(student) }

    it "renders the preview for the correct assignment" do
      get "/courses/#{course.id}/assignments/#{assignment.id}/submissions/#{student.id}",
          params: { preview: true }
      expect(response).to have_http_status(:ok)
      expect(response.body).to include(assignment.title)
    end

    it "renders the preview for the correct student" do
      student2 = student_in_course(course:, active_all: true).user
      assignment.submit_homework(student, submission_type: "online_text_entry", body: "student one homework")
      assignment.submit_homework(student2, submission_type: "online_text_entry", body: "student two homework")
      get "/courses/#{course.id}/assignments/#{assignment.id}/submissions/#{student.id}",
          params: { preview: true }
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("student one homework")
      expect(response.body).not_to include("student two homework")
    end

    it "renders a no submission message when the student has not submitted" do
      Submission.delete_all
      get "/courses/#{course.id}/assignments/#{assignment.id}/submissions/#{student.id}",
          params: { preview: true }
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("No Submission")
    end

    it "renders the existing submission content" do
      assignment.submit_homework(student, submission_type: "online_text_entry", body: "initial body")
      get "/courses/#{course.id}/assignments/#{assignment.id}/submissions/#{student.id}",
          params: { preview: true }
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("initial body")
    end

    it "renders the version from submission history when version and preview params are provided" do
      submission = assignment.submit_homework(student, submission_type: "online_text_entry", body: "pre-submission")
      Timecop.freeze(2.hours.ago) do
        submission.with_versioning(explicit: true) do
          submission.body = "initial body"
          submission.submitted_at = 2.hours.ago
          submission.save!
        end
      end
      Timecop.freeze(1.hour.ago) do
        submission.with_versioning(explicit: true) do
          submission.body = "updated body"
          submission.submitted_at = 1.hour.ago
          submission.save!
        end
      end
      get "/courses/#{course.id}/assignments/#{assignment.id}/submissions/#{student.id}",
          params: { preview: true, version: 0 }
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("initial body")
    end

    it "redirects to the quiz when the assignment is a quiz, ignoring the version param" do
      quiz = course.quizzes.build(title: "Test Quiz", quiz_type: "assignment")
      quiz.workflow_state = "available"
      quiz.save!
      get "/courses/#{course.id}/assignments/#{quiz.assignment.id}/submissions/#{student.id}",
          params: { preview: true, version: 1 }
      expect(response).to redirect_to("/courses/#{course.id}/quizzes/#{quiz.id}?headless=1")
    end
  end
end
