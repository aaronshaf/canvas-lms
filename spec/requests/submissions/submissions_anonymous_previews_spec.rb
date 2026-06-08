# frozen_string_literal: true

#
# Copyright (C) 2018 - present Instructure, Inc.
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

RSpec.describe "anonymous submission previews" do
  describe "GET /courses/:course_id/assignments/:assignment_id/anonymous_submissions/:anonymous_id" do
    let(:course) do
      c = course_factory(active_course: true)
      c.account.enable_service(:avatars)
      c
    end
    let(:teacher) { teacher_in_course(course:, active_all: true).user }
    let(:student) { student_in_course(course:, active_all: true).user }
    let(:assignment) do
      course.assignments.create!(title: "some assignment", submission_types: "online_url,online_upload")
    end
    let(:submission) do
      assignment.submit_homework(student, submission_type: "online_url", url: "http://www.google.com")
    end

    before { user_session(student) }

    it "renders show_preview" do
      get "/courses/#{course.id}/assignments/#{assignment.id}/anonymous_submissions/#{submission.anonymous_id}",
          params: { preview: true }
      expect(response).to have_http_status(:ok)
    end

    it "anonymizes student info when viewer is a teacher and the assignment anonymizes students" do
      anon_assignment = course.assignments.create!(
        title: "shhh",
        anonymous_grading: true,
        submission_types: "online_upload"
      )
      attachment = attachment_model(filename: "test.txt", context: student)
      anon_submission = anon_assignment.submit_homework(
        student,
        submission_type: "online_upload",
        attachments: [attachment]
      )
      user_session(teacher)
      url = "/courses/#{course.id}/assignments/#{anon_assignment.id}" \
            "/anonymous_submissions/#{anon_submission.anonymous_id}"
      get url, params: { preview: true }
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("anonymous_submissions/#{anon_submission.anonymous_id}")
      expect(response.body).not_to include("/submissions/#{student.id}")
    end

    it "does not throw an error when an admin without an enrollment in the course views the preview" do
      anon_assignment = course.assignments.create!(title: "shhh", anonymous_grading: true)
      admin = account_admin_user(active_all: true, account: Account.site_admin)
      user_session(admin)
      anon_submission = anon_assignment.submission_for_student(student)
      url = "/courses/#{course.id}/assignments/#{anon_assignment.id}" \
            "/anonymous_submissions/#{anon_submission.anonymous_id}"
      get url, params: { preview: true }
      expect(response).to have_http_status(:ok)
    end

    it "anonymizes student information when the viewer is a peer reviewer and anonymous peer reviews are enabled" do
      peer_assignment = course.assignments.create!(
        title: "ok",
        peer_reviews: true,
        anonymous_peer_reviews: true,
        submission_types: "online_upload"
      )
      attachment = attachment_model(filename: "test.txt", context: student)
      peer_submission = peer_assignment.submit_homework(
        student,
        submission_type: "online_upload",
        attachments: [attachment]
      )
      reviewer = student_in_course(course:, active_all: true).user
      reviewer_attachment = attachment_model(filename: "reviewer.txt", context: reviewer)
      peer_assignment.submit_homework(reviewer, submission_type: "online_upload", attachments: [reviewer_attachment])
      peer_assignment.assign_peer_review(reviewer, student)
      user_session(reviewer)
      url = "/courses/#{course.id}/assignments/#{peer_assignment.id}" \
            "/anonymous_submissions/#{peer_submission.anonymous_id}"
      get url, params: { preview: true }
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("anonymous_submissions/#{peer_submission.anonymous_id}")
      expect(response.body).not_to include("/submissions/#{student.id}")
    end
  end
end
