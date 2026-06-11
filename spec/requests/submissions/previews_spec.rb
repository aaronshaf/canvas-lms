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

require_relative "../../lti_spec_helper"

RSpec.describe "submission previews" do
  include LtiSpecHelper

  describe "GET /courses/:course_id/assignments/:assignment_id/submissions/:id" do
    before do
      course_with_student_and_submitted_homework
      @context = @course
    end

    it "renders show_preview" do
      user_session(@student)
      get "/courses/#{@context.id}/assignments/#{@assignment.id}/submissions/#{@student.id}",
          params: { preview: true }
      expect(response).to render_template("show_preview")
    end

    context "when assignment is a quiz" do
      before do
        quiz_with_submission
      end

      it "redirects to course_quiz_url" do
        user_session(@student)
        get "/courses/#{@context.id}/assignments/#{@quiz.assignment.id}/submissions/#{@student.id}",
            params: { preview: true }
        expect(response).to redirect_to(course_quiz_url(@context, @quiz, headless: 1))
      end

      context "and user is a teacher" do
        before do
          user_session(@teacher)
          submission = @quiz.assignment.submissions.where(user_id: @student).first
          submission.quiz_submission.with_versioning do
            submission.quiz_submission.update_attribute(:finished_at, 1.hour.ago)
          end
        end

        it "redirects to course_quiz_history_url" do
          submission = @quiz.assignment.submissions.find_by(user_id: @student)
          version = submission.quiz_submission.versions.find { |v| v.model.finished_at }&.number
          get "/courses/#{@context.id}/assignments/#{@quiz.assignment.id}/submissions/#{@student.id}",
              params: { preview: true }
          expect(response).to redirect_to(course_quiz_history_url(@context, @quiz, {
                                                                    headless: 1,
                                                                    user_id: @student.id,
                                                                    version:
                                                                  }))
        end

        it "favors params[:version] when set" do
          version = 1
          get "/courses/#{@context.id}/assignments/#{@quiz.assignment.id}/submissions/#{@student.id}",
              params: { preview: true, version: }
          expect(response).to redirect_to(course_quiz_history_url(@context, @quiz, {
                                                                    headless: 1,
                                                                    user_id: @student.id,
                                                                    version:
                                                                  }))
        end
      end
    end

    context "anonymous assignments" do
      let(:observer) do
        course_with_observer(
          course: @course,
          associated_user_id: @student.id,
          active_all: true
        ).user
      end

      it "allows observers of the submission's owner to view the preview" do
        assignment = @course.assignments.create!(title: "shhh", anonymous_grading: true)
        user_session(observer)
        get "/courses/#{@course.id}/assignments/#{assignment.id}/submissions/#{@student.id}",
            params: { preview: true }
        expect(response).to have_http_status(:ok)
      end

      it "does not allow observers not observing the submission's owner to view the preview" do
        new_student = User.create!
        @course.enroll_student(new_student, enrollment_state: "active")
        assignment = @course.assignments.create!(title: "shhh", anonymous_grading: true)
        user_session(observer)
        get "/courses/#{@course.id}/assignments/#{assignment.id}/submissions/#{new_student.id}",
            params: { preview: true }
        expect(response).to have_http_status(:unauthorized)
      end

      it "returns unauthorized when the viewer is a teacher and the assignment is currently anonymizing students" do
        assignment = @course.assignments.create!(title: "shhh", anonymous_grading: true)
        user_session(@teacher)
        get "/courses/#{@course.id}/assignments/#{assignment.id}/submissions/#{@student.id}",
            params: { preview: true }
        expect(response).to have_http_status(:unauthorized)
      end

      it "returns unauthorized when the viewer is a peer reviewer and anonymous peer reviews are enabled" do
        assignment = @course.assignments.create!(title: "ok", peer_reviews: true, anonymous_peer_reviews: true)
        reviewer = @course.enroll_student(User.create!, enrollment_state: "active").user
        assignment.assign_peer_review(reviewer, @student)
        user_session(reviewer)
        get "/courses/#{@course.id}/assignments/#{assignment.id}/submissions/#{@student.id}",
            params: { preview: true }
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "when Asset Processor is attached and submission type is online_upload" do
      before do
        @attachment1 = attachment_with_context @student, { display_name: "a1.txt", uploaded_data: StringIO.new("hello") }
        @attachment2 = attachment_with_context @student, { display_name: "a2.txt", uploaded_data: StringIO.new("world") }
        @submission = @assignment.submit_homework(@student, attachments: [@attachment1, @attachment2], submission_type: "online_upload")
        @context = @course
        user_session(@student)
      end

      it "renders show_preview with asset processor data attributes for uploaded files" do
        get "/courses/#{@context.id}/assignments/#{@assignment.id}/submissions/#{@student.id}",
            params: { preview: true }
        doc = Nokogiri::HTML(response.body)
        [@attachment1, @attachment2].each do |attachment|
          node = doc.at_css("[data-attachment-id='#{attachment.id}']")
          expect(node).not_to be_nil
          expect(node["data-submission-id"]).to eq(@submission.id.to_s)
          expect(node["data-submission-type"]).to eq("online_upload")
        end
      end
    end
  end
end
