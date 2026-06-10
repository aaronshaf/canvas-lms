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

RSpec.describe "submission downloads", type: :request do
  describe "GET /courses/:course_id/assignments/:assignment_id/submissions/:id" do
    before do
      course_with_student_and_submitted_homework
      @context = @course
      user_session(@student)
    end

    context "with user id not present in course" do
      before do
        @attachment = @submission.attachment = attachment_model(context: @context)
        @submission.save!
        course_with_student(active_all: true)
        user_session(@student)
      end

      it "sets flash error" do
        get "/courses/#{@context.id}/assignments/#{@assignment.id}/submissions/#{@student.id}",
            params: { download: @submission.attachment_id }
        expect(flash[:error]).to include("The specified user is not a student in this course")
      end

      it "redirects to course assignment url" do
        get "/courses/#{@context.id}/assignments/#{@assignment.id}/submissions/#{@student.id}",
            params: { download: @submission.attachment_id }
        expect(response).to redirect_to(course_assignment_url(@context, @assignment))
      end
    end

    context "when attachment belongs to submission" do
      before do
        @attachment = @submission.attachment = attachment_model(context: @context)
        @submission.save!
      end

      it "redirects to the attachment download url" do
        get "/courses/#{@context.id}/assignments/#{@assignment.id}/submissions/#{@student.id}",
            params: { download: @submission.attachment_id }
        expect(response).to redirect_to(course_file_download_url(@context, @attachment, {
                                                                   download_frd: true,
                                                                   inline: nil,
                                                                   verifier: @attachment.uuid
                                                                 }))
      end

      it "renders as json" do
        get "/courses/#{@context.id}/assignments/#{@assignment.id}/submissions/#{@student.id}",
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

      get "/courses/#{@context.id}/assignments/#{@assignment.id}/submissions/#{@student.id}",
          params: { download: attachment.id }
      expect(response).to have_http_status(:found)
      expect(response.headers["Location"]).to include(attachment.uuid)
    end

    it "redirects to the attachment from the attachments collection when attachment_id is not present" do
      attachment = attachment_model(context: @submission.user)
      @submission.attachments = [attachment]
      @submission.save!

      get "/courses/#{@course.id}/assignments/#{@assignment.id}/submissions/#{@student.id}",
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
        submission_comment_model
        @attachment = attachment_model(context: @assignment)
        @submission_comment.attachments = [@attachment]
        @submission_comment.save!
      end

      it "redirects to the submission comment attachment" do
        expect(@assignment.attachments).to include(@attachment), "precondition"
        expect(@submission_comment.attachments).to include(@attachment), "precondition"

        get "/courses/#{@original_context.id}/assignments/#{@assignment.id}/submissions/#{@original_student.id}",
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
      get "/courses/#{@course.id}/assignments/#{assignment.id}/submissions/#{@user.id}",
          params: { download: att.id }
      expect(response).to have_http_status(:found)
      expect(response.headers["Location"]).to match %r{users/#{@student.id}/files/#{att.id}/download\?download_frd=true}
    end

    it "redirects download requests for submissions other than the most recent" do
      course_with_teacher_logged_in
      assignment = assignment_model(course: @course)
      student_in_course

      Timecop.travel(3.days.ago) do
        @attachment1 = attachment_model(uploaded_data: stub_file_data("test1.txt", "asdf", "text/plain"), context: @student)
        assignment.submit_homework(@student, {
                                     submission_type: "online_upload",
                                     attachment_ids: @attachment1.id,
                                     attachments: [@attachment1]
                                   })
      end

      @attachment2 = attachment_model(uploaded_data: stub_file_data("test2.txt", "asdf", "text/plain"), context: @student)
      assignment.submit_homework(@student, {
                                   submission_type: "online_upload",
                                   attachment_ids: @attachment2.id,
                                   attachments: [@attachment2]
                                 })

      get "/courses/#{@course.id}/assignments/#{assignment.id}/submissions/#{@user.id}",
          params: { download: @attachment1.id }
      expect(response).to have_http_status(:found)
      expect(response.headers["Location"]).to match %r{users/#{@student.id}/files/#{@attachment1.id}/download\?download_frd=true}
      expect(URI.parse(response.headers["Location"]).query).to match(/verifier=#{@attachment1.uuid}/)

      get "/courses/#{@course.id}/assignments/#{assignment.id}/submissions/#{@user.id}",
          params: { download: @attachment2.id }
      expect(response).to have_http_status(:found)
      expect(response.headers["Location"]).to match %r{users/#{@student.id}/files/#{@attachment2.id}/download\?download_frd=true}
      expect(URI.parse(response.headers["Location"]).query).to match(/verifier=#{@attachment2.uuid}/)
    end
  end
end
