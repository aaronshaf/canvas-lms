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

RSpec.describe "anonymous submission downloads" do
  describe "GET /courses/:course_id/assignments/:assignment_id/anonymous_submissions/:anonymous_id" do
    before do
      course_with_student_and_submitted_homework
      @course.account.enable_service(:avatars)
      @context = @course
      user_session(@student)
    end

    context "when attachment belongs to submission" do
      before do
        @attachment = @submission.attachment = attachment_model(context: @context)
        @submission.save!
      end

      it "redirects to the attachment download url" do
        get "/courses/#{@context.id}/assignments/#{@assignment.id}/anonymous_submissions/#{@submission.anonymous_id}",
            params: { download: @submission.attachment_id }
        expect(response).to redirect_to(course_file_download_url(@context, @attachment, {
                                                                   download_frd: true,
                                                                   inline: nil,
                                                                   verifier: @attachment.uuid
                                                                 }))
      end

      it "renders as json" do
        get "/courses/#{@context.id}/assignments/#{@assignment.id}/anonymous_submissions/#{@submission.anonymous_id}",
            headers: { "Accept" => Mime[:json].to_s },
            params: { download: @submission.attachment_id }
        expect(response.parsed_body["attachment"]["id"]).to eq @submission.attachment_id
      end
    end

    it "redirects to the attachment from submission history when present" do
      attachment = @submission.attachment = attachment_model(context: @context)
      @submission.submitted_at = 3.hours.ago
      @submission.save!
      expect(@submission.attachment).not_to be_nil, "precondition"
      expect do
        @submission.with_versioning(explicit: true) do
          @submission.attachment = nil
          @submission.submitted_at = 1.hour.ago
          @submission.save!
        end
      end.to change(@submission.versions, :count), "precondition"
      expect(@submission.attachment).to be_nil, "precondition"

      get "/courses/#{@context.id}/assignments/#{@assignment.id}/anonymous_submissions/#{@submission.anonymous_id}",
          params: { download: attachment.id }
      expect(response).to have_http_status(:found)
      expect(response.headers["Location"]).to include(attachment.uuid)
    end

    it "redirects to the attachment from the attachments collection when attachment_id is not present" do
      attachment = attachment_model(context: @submission.user)
      @submission.attachments = [attachment]
      @submission.save!

      get "/courses/#{@course.id}/assignments/#{@assignment.id}/anonymous_submissions/#{@submission.anonymous_id}",
          params: { download: @submission.attachments.first.id }
      expect(response).to have_http_status(:found)
      expect(response.headers["Location"]).to include(attachment.uuid)
    end

    context "and params[:comment_id]" do
      before do
        # our factory system is broken
        @original_context = @context
        @original_student = @student
        course_with_student(active_all: true)
        @course.account.enable_service(:avatars)
        submission_comment_model
        @attachment = attachment_model(context: @assignment)
        @submission_comment.attachments = [@attachment]
        @submission_comment.save!
      end

      it "redirects to the submission comment attachment" do
        expect(@assignment.attachments).to include(@attachment), "precondition"
        expect(@submission_comment.attachments).to include(@attachment), "precondition"

        get "/courses/#{@original_context.id}/assignments/#{@assignment.id}/anonymous_submissions/#{@submission.anonymous_id}",
            params: { download: @attachment.id, comment_id: @submission_comment.id }
        expect(response).to redirect_to(file_download_url(@attachment, {
                                                            download_frd: true,
                                                            inline: nil,
                                                            verifier: @attachment.uuid
                                                          }))
      end
    end

    it "redirects download requests with the download_frd parameter" do
      # The files controller looks for download_frd to indicate a forced download
      course_with_teacher_logged_in
      @course.account.enable_service(:avatars)
      assignment = assignment_model(course: @course)
      student_in_course
      att = attachment_model(uploaded_data: stub_file_data("test.txt", "asdf", "text/plain"), context: @student)
      submission_model(
        course: @course,
        assignment:,
        submission_type: "online_upload",
        attachment_ids: att.id,
        attachments: [att],
        user: @student
      )
      get "/courses/#{@course.id}/assignments/#{assignment.id}/anonymous_submissions/#{@submission.anonymous_id}",
          params: { download: att.id }
      expect(response).to have_http_status(:found)
      expect(response.headers["Location"]).to match %r{/users/#{@student.id}/files/#{att.id}/download\?download_frd=true}
    end
  end
end
