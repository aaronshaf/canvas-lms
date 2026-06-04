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

require_relative "advantage_services_shared_context"

module Lti
  module IMS::Concerns
    describe GradebookServices, type: :request do
      include_context "advantage services context"

      let(:test_request_host) { "www.example.com" }
      let(:access_token_scopes) do
        %W[
          #{TokenScopes::LTI_AGS_LINE_ITEM_SCOPE}
          #{TokenScopes::LTI_AGS_LINE_ITEM_READ_ONLY_SCOPE}
          #{TokenScopes::LTI_AGS_RESULT_READ_ONLY_SCOPE}
          #{TokenScopes::LTI_AGS_SCORE_SCOPE}
          #{TokenScopes::LTI_NRPS_V2_SCOPE}
        ].join(" ")
      end

      let(:context) { course }
      let(:user) { student_in_course(course: context, active_all: true).user }
      let(:assignment) do
        opts = { course: context }
        opts[:submission_types] = "external_tool"
        opts[:external_tool_tag_attributes] = {
          url: tool.url,
          content_type: "context_external_tool",
          content_id: tool.id
        }
        assignment_model(opts)
      end
      let(:line_item) { assignment.line_items.first }

      # Primary request helper — GET to ResultsController#index, which includes
      # GradebookServices and exercises verify_course_not_concluded_for_user and
      # verify_line_item_in_context before_actions.
      def send_request(user_id: user.lti_id, extra_params: {})
        get(
          "/api/lti/courses/#{context.id}/line_items/#{line_item.id}/results",
          params: { userId: user_id }.merge(extra_params),
          headers: { "Authorization" => "Bearer #{access_token_jwt}" }
        )
        run_jobs
      end

      # Secondary request helper — POST to ScoresController#create. Used only for
      # tests that specifically exercise verify_user_in_context, which is an explicit
      # before_action on ScoresController but not on the GET results endpoint.
      def send_score_request(user_id: user.lti_id)
        post(
          "/api/lti/courses/#{context.id}/line_items/#{line_item.id}/scores",
          params: {
            userId: user_id,
            activityProgress: "Completed",
            gradingProgress: "FullyGraded",
            timestamp: Time.now.iso8601(3)
          }.to_json,
          headers: {
            "Authorization" => "Bearer #{access_token_jwt}",
            "Content-Type" => "application/vnd.ims.lis.v1.score+json"
          }
        )
        run_jobs
      end

      # Sends a line item creation (POST to LineItemsController#create)
      def send_line_item_request(extra_params: {})
        body = {
          scoreMaximum: 100,
          label: "test line item"
        }.merge(extra_params).to_json
        post(
          "/api/lti/courses/#{context.id}/line_items",
          params: body,
          headers: {
            "Authorization" => "Bearer #{access_token_jwt}",
            "Content-Type" => "application/vnd.ims.lis.v2.lineitem+json"
          }
        )
        run_jobs
      end

      describe "#before_actions" do
        context "with user and line item in context" do
          before { user.enrollments.first.update!(workflow_state: "active") }

          it "processes the request" do
            send_request
            expect(response).to have_http_status(:ok)
          end
        end

        # verify_user_in_context is only an explicit before_action on ScoresController,
        # so these enrollment-state tests use send_score_request (POST).
        context "with user not active in context" do
          before { user.enrollments.first.update!(workflow_state: "inactive") }

          it "fails to process the request" do
            send_score_request
            expect(response).to have_http_status :unprocessable_content
          end
        end

        context "with course term ended, but not for teachers" do
          it "processes the request" do
            term = context.enrollment_term
            term.update!(end_at: 1.day.ago)
            section = context.course_sections.create!(
              name: "Active Section",
              start_at: 2.days.ago,
              end_at: 1.day.from_now,
              restrict_enrollments_to_section_dates: true
            )
            student_in_section(section, { user: })

            send_request
            expect(response).to have_http_status(:ok)
          end
        end

        context "with course term ended, but not for TAs" do
          it "processes the request" do
            term = context.enrollment_term
            term.update!(end_at: 1.day.ago)
            term.set_overrides(
              context.account,
              "TaEnrollment" => { end_at: 1.day.from_now }
            )

            send_request
            expect(response).to have_http_status(:ok)
          end
        end

        context "with course term ended for both teachers and TAs" do
          it "fails to process the request" do
            term = context.enrollment_term
            term.update!(end_at: 1.day.ago)
            term.set_overrides(
              context.account,
              "TeacherEnrollment" => { end_at: 1.day.ago },
              "TaEnrollment" => { end_at: 1.day.ago }
            )

            send_request
            expect(response).to have_http_status(:unprocessable_content)
          end
        end

        it "responds with 422 if course is hard concluded" do
          context.update!(workflow_state: "completed")
          send_request
          expect(response).to have_http_status(:unprocessable_content)
        end

        it "responds with 422 if course end date has passed" do
          context.update!(start_at: 2.days.ago, conclude_at: 1.day.ago, restrict_enrollments_to_course_dates: true)
          send_request
          expect(response).to have_http_status(:unprocessable_content)
        end

        it "still responds with a 404 if an invalid course_id is passed" do
          invalid_course_id = (Course.maximum(:id) || 0) + 1
          get(
            "/api/lti/courses/#{invalid_course_id}/line_items/#{line_item.id}/results",
            headers: { "Authorization" => "Bearer #{access_token_jwt}" }
          )
          expect(response).to have_http_status(:not_found)
        end

        context "with user not in context" do
          before { user.enrollments.destroy_all }

          it "fails to process the request" do
            send_score_request
            expect(response).to have_http_status :unprocessable_content
          end
        end

        context "with uuid that first digit matches user_id" do
          before { user.enrollments.first.update!(workflow_state: "active") }

          let(:some_lti_id) do
            "#{user.id}a000000"[0...8] + "-1234-1234-1234-e1214b67696d"
          end

          it "fails to find user" do
            send_score_request(user_id: some_lti_id)
            expect(response).to have_http_status :unprocessable_content
            expect(response.parsed_body["errors"]["message"]).to eq("User not found in course or is not a student")
          end

          it "still uses such a user_id to look up by lti_id" do
            User.where(id: user.id).update_all lti_id: some_lti_id
            send_score_request(user_id: some_lti_id)
            expect(response).to have_http_status(:ok)
          end
        end

        context "when two students with enrollments were merged" do
          let(:user_to_merge) { student_in_course(course: context).user }
          let(:lti_id) { user_to_merge.lti_id }

          before do
            user.enrollments.first.update!(workflow_state: "active")
            user_to_merge.enrollments.first.update!(workflow_state: "active")
            UserMerge.from(user_to_merge).into(user)
          end

          it "successfuly finds the active user using the user past lti id" do
            send_score_request(user_id: lti_id)
            expect(response).to have_http_status(:ok)
          end
        end

        context "when student was deleted and it was not merged (is not a past user)" do
          let(:lti_id) { user.lti_id }

          before do
            user.update!(workflow_state: "deleted")
          end

          it "fails to find user" do
            send_score_request(user_id: lti_id)
            expect(response).to have_http_status :unprocessable_content
            expect(response.parsed_body["errors"]["message"]).to eq("User not found in course or is not a student")
          end
        end

        context "when line item does not exist" do
          before { user.enrollments.first.update!(workflow_state: "active") }

          it "fails to process the request" do
            invalid_line_item_id = (LineItem.maximum(:id) || 0) + 1
            get(
              "/api/lti/courses/#{context.id}/line_items/#{invalid_line_item_id}/results",
              headers: { "Authorization" => "Bearer #{access_token_jwt}" }
            )
            expect(response).to have_http_status(:not_found)
          end
        end
      end

      describe "#prepare_line_item_for_ags!" do
        context "when resource link id is missing" do
          it "is ignored" do
            send_line_item_request
            expect(response).to have_http_status(:created)
          end
        end

        context "when resource link id points to wrong assignment" do
          it "fails to match assignment tool" do
            a2 = assignment.clone
            a2.lti_context_id = nil
            a2.save
            send_line_item_request(extra_params: { resourceLinkId: a2.lti_context_id })
            expect(response).to have_http_status :unprocessable_content
            expect(response.parsed_body["errors"]["message"]).to eq("Resource link id points to Tool not associated with this Context")
          end
        end

        context "with correct resource link id" do
          it "fixes up line items on assignment" do
            send_line_item_request(extra_params: { resourceLinkId: assignment.lti_context_id })
            expect(response).to have_http_status(:created)
            expect(response.parsed_body["label"]).to eq("test line item")
            expect(response.parsed_body["scoreMaximum"]).to eql(100.0) # rubocop:disable RSpec/BeEql
          end
        end
      end
    end
  end
end
