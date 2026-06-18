# frozen_string_literal: true

#
# Copyright (C) 2025 - present Instructure, Inc.
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

describe Lti::AssetProcessorController do
  describe "#resubmit_notice" do
    let(:course) { course_model }
    let(:assignment) { assignment_model(course:, submission_types: "online_upload") }
    let(:student) { course_with_student(course:, active_all: true).user }
    let(:teacher) { course_with_teacher(course:, active_all: true).user }
    let(:asset_processor) { lti_asset_processor_model(assignment:) }
    let(:attachment) { attachment_model(user: student) }
    let(:submission) do
      assignment.submit_homework(student, submission_type: "online_upload", attachments: [attachment])
    end

    let(:attempt) { "latest" }

    before do
      Account.site_admin.enable_feature!(:lti_asset_processor)
    end

    def expect_submission_notified(expected_attempt: nil, expected_attachment_ids: nil)
      received_submission = nil
      allow(Lti::AssetProcessorNotifier).to receive(:notify_asset_processors).and_wrap_original do |method, sub, *args|
        received_submission = sub
        method.call(sub, *args)
      end

      yield

      expect(response).to have_http_status(:no_content)

      if expected_attempt.present?
        expect(received_submission&.attempt).to eq(expected_attempt)
      end
      if expected_attachment_ids.present?
        expected_ids = Array(expected_attachment_ids).join(",")
        actual_ids = received_submission&.attachment_ids.to_s
        expect(actual_ids).to eq(expected_ids)
      end
    end

    context "when the user has proper permissions" do
      before do
        user_session(teacher)
      end

      it "notifies asset processors and returns success" do
        expect_submission_notified(expected_attempt: submission.attempt, expected_attachment_ids: [attachment.id]) do
          post "/api/lti/asset_processors/#{asset_processor.id}/notices/#{student.id}/attempts/#{attempt}"
        end
      end

      context "when there are multiple attempts" do
        let(:attachment2) { attachment_model(user: student) }

        before do
          opts = { submission_type: "online_upload", attachments: [attachment] }
          # Create a second submission with attempt number 1
          assignment.submit_homework(student, **opts, submitted_at: submission.submitted_at)

          opts = { submission_type: "online_upload", attachments: [attachment2] }
          # Create a third submission with a attempt number 2
          submission2 = assignment.submit_homework(student, **opts)

          # Create a fourth submission with attempt number 2
          assignment.submit_homework(student, **opts, submitted_at: submission2.submitted_at)
        end

        context "when attempt is given" do
          let(:attempt) { "1" }

          it "uses the given attempt" do
            expect_submission_notified(expected_attempt: 1, expected_attachment_ids: [attachment.id]) do
              post "/api/lti/asset_processors/#{asset_processor.id}/notices/#{student.id}/attempts/#{attempt}"
            end
          end
        end

        context "when attempt is not found" do
          let(:attempt) { "100" }

          it "uses the latest attempt" do
            expect_submission_notified(expected_attempt: 2, expected_attachment_ids: [attachment2.id]) do
              post "/api/lti/asset_processors/#{asset_processor.id}/notices/#{student.id}/attempts/#{attempt}"
            end
          end
        end

        context "when attempt is 'latest'" do
          it "uses the latest attempt" do
            expect_submission_notified(expected_attempt: 2, expected_attachment_ids: [attachment2.id]) do
              post "/api/lti/asset_processors/#{asset_processor.id}/notices/#{student.id}/attempts/#{attempt}"
            end
          end
        end
      end
    end

    context "when testing before_actions" do
      context "require_feature_enabled" do
        before do
          Account.site_admin.disable_feature!(:lti_asset_processor)
          user_session(teacher)
        end

        it "returns not found when feature is disabled" do
          post "/api/lti/asset_processors/#{asset_processor.id}/notices/#{student.id}/attempts/latest"
          expect(response).to have_http_status(:not_found)
        end
      end

      context "require_user" do
        it "returns unauthorized when user is not authenticated" do
          post "/api/lti/asset_processors/#{asset_processor.id}/notices/#{student.id}/attempts/latest"
          expect(response).to have_http_status(:unauthorized)
        end
      end

      context "require_asset_processor" do
        before do
          user_session(teacher)
        end

        it "returns not found when asset processor doesn't exist" do
          post "/api/lti/asset_processors/nonexistent/notices/#{student.id}/attempts/latest"
          expect(response).to have_http_status(:not_found)
        end
      end

      context "require_access_to_context" do
        before do
          user_session(student) # Student doesn't have manage_grades permission
        end

        it "returns forbidden when user doesn't have access" do
          post "/api/lti/asset_processors/#{asset_processor.id}/notices/#{student.id}/attempts/latest"
          expect(response).to have_http_status(:forbidden)
          expect(response.body).to eq("invalid_request")
        end
      end

      context "require_submission" do
        before do
          user_session(teacher)
        end

        it "returns not found when student doesn't exist" do
          post "/api/lti/asset_processors/#{asset_processor.id}/notices/nonexistent/attempts/latest"
          expect(response).to have_http_status(:not_found)
        end

        it "returns not found when submission doesn't exist" do
          other_student = user_model
          post "/api/lti/asset_processors/#{asset_processor.id}/notices/#{other_student.id}/attempts/latest"
          expect(response).to have_http_status(:not_found)
        end
      end
    end

    context "when assignment uses anonymous grading" do
      let(:assignment) { assignment_model(course:, submission_types: "online_upload", anonymous_grading: true) }
      let(:submission) do
        assignment.submit_homework(student, submission_type: "online_upload", attachments: [attachment])
      end
      let(:anonymous_id) { submission.anonymous_id }

      before do
        user_session(teacher)
      end

      it "processes anonymous student ID and returns success" do
        received_submission = nil
        allow(Lti::AssetProcessorNotifier).to receive(:notify_asset_processors).and_wrap_original do |method, sub, *args|
          received_submission = sub
          method.call(sub, *args)
        end

        post "/api/lti/asset_processors/#{asset_processor.id}/notices/anonymous:#{anonymous_id}/attempts/#{attempt}"
        expect(response).to have_http_status(:no_content)
        expect(received_submission).to eq(submission)
      end

      it "returns not found for invalid anonymous_id" do
        post "/api/lti/asset_processors/#{asset_processor.id}/notices/anonymous:invalid_id/attempts/#{attempt}"
        expect(response).to have_http_status(:not_found)
      end
    end

    context "when assignment is a group assignment" do
      let(:assignment) { assignment_model(course:, submission_types: "online_upload", group_category: "Group category 1") }
      let(:group_category) { assignment.group_category }
      let(:student2_enrollment) { student_in_course(course:, active_all: true) }
      let(:student2) { student2_enrollment.user }
      let(:group) { course.groups.create!(name: "Test Group", group_category:, context: course) }

      before do
        user_session(teacher)
        group.add_user(student, "accepted")
        group.add_user(student2, "accepted")
        assignment.submissions.find_by(user: student).tap { |s| s.update!(group:) }
        assignment.submissions.find_by(user: student2).tap { |s| s.update!(group:) }
      end

      it "notifies with the student's own submission when they are the real submitter" do
        student_submission = assignment.submit_homework(student, submission_type: "online_upload", attachments: [attachment])

        expect_submission_notified(expected_attempt: student_submission.attempt, expected_attachment_ids: [attachment.id]) do
          post "/api/lti/asset_processors/#{asset_processor.id}/notices/#{student.id}/attempts/latest"
        end
      end

      it "notifies with the real submitter's submission when targeting a groupmate" do
        primary_submission = assignment.submit_homework(student, submission_type: "online_upload", attachments: [attachment])
        groupmate_submission = assignment.submissions.find_by(user_id: student2.id)

        expect(primary_submission.real_submitter_id).to eq(primary_submission.user_id)
        expect(groupmate_submission).to be_present
        expect(groupmate_submission.group_id).to be_present
        expect(groupmate_submission.real_submitter_id).to eq(student.id)
        expect(groupmate_submission.user_id).not_to eq(groupmate_submission.real_submitter_id)

        expect_submission_notified(expected_attempt: primary_submission.attempt, expected_attachment_ids: [attachment.id]) do
          post "/api/lti/asset_processors/#{asset_processor.id}/notices/#{student2.id}/attempts/latest"
        end
      end
    end
  end

  describe "#resubmit_discussion_notices_all" do
    let(:course) { course_model }
    let(:discussion_topic) { graded_discussion_topic(context: course) }
    let(:assignment) { discussion_topic.assignment }
    let(:student) { course_with_student(course:, active_all: true).user }
    let(:teacher) { course_with_teacher(course:, active_all: true).user }
    let(:tool) { external_tool_1_3_model(context: course, placements: ["ActivityAssetProcessorContribution"]) }
    let(:asset_processor1) { lti_asset_processor_model(assignment:, tool:) }
    let(:asset_processor2) { lti_asset_processor_model(assignment:, tool:) }

    context "when the user has proper permissions" do
      before do
        user_session(teacher)
      end

      context "with discussion entries" do
        before do
          @entry1 = discussion_topic.discussion_entries.create!(
            user: student,
            message: "First entry"
          )
          @entry2 = discussion_topic.discussion_entries.create!(
            user: student,
            message: "Second entry"
          )
          asset_processor1
          asset_processor2
        end

        it "notifies all asset processors for each latest discussion entry version" do
          # rubocop:disable RSpec/VerifiedDoubles
          mock_notifier = double("Lti::AssetProcessorDiscussionNotifier")
          # rubocop:enable RSpec/VerifiedDoubles
          allow(mock_notifier).to receive(:notify_asset_processors_of_discussion)
          allow(Lti::AssetProcessorDiscussionNotifier).to receive(:delay_if_production).and_return(mock_notifier)
          expect(mock_notifier).to receive(:notify_asset_processors_of_discussion).at_least(:once)

          post "/api/lti/asset_processors/discussion_notices/#{assignment.id}/#{student.id}/resubmit_all"
          expect(response).to have_http_status(:no_content)
        end

        context "when entries have multiple versions" do
          before do
            @entry1.update!(message: "Updated first entry")
            @entry2.update!(message: "Updated second entry")
          end

          it "only notifies for the latest version of each entry" do
            expect(@entry1.discussion_entry_versions.count).to eq(2)
            expect(@entry2.discussion_entry_versions.count).to eq(2)

            notified_versions = []
            # rubocop:disable RSpec/VerifiedDoubles
            mock_notifier = double("Lti::AssetProcessorDiscussionNotifier")
            # rubocop:enable RSpec/VerifiedDoubles
            allow(mock_notifier).to receive(:notify_asset_processors_of_discussion) do |**kwargs|
              notified_versions.concat(kwargs[:discussion_entry_versions])
            end
            allow(Lti::AssetProcessorDiscussionNotifier).to receive(:delay_if_production).and_return(mock_notifier)

            post "/api/lti/asset_processors/discussion_notices/#{assignment.id}/#{student.id}/resubmit_all"
            expect(response).to have_http_status(:no_content)

            # Should notify with latest versions: one for each entry's latest version
            notified_entry_ids = notified_versions.map(&:discussion_entry_id).sort
            expected_entry_ids = [@entry1.id, @entry2.id].sort
            expect(notified_entry_ids).to eq(expected_entry_ids)

            # All notified versions should be the latest (newest created_at for each entry)
            latest_entry1_version = @entry1.discussion_entry_versions.max_by(&:created_at)
            latest_entry2_version = @entry2.discussion_entry_versions.max_by(&:created_at)
            expect(notified_versions).to include(latest_entry1_version, latest_entry2_version)
          end
        end
      end

      context "when student has no discussion entries" do
        it "returns no content without calling notifier" do
          # rubocop:disable RSpec/VerifiedDoubles
          mock_notifier = double("Lti::AssetProcessorDiscussionNotifier")
          # rubocop:enable RSpec/VerifiedDoubles
          allow(Lti::AssetProcessorDiscussionNotifier).to receive(:delay_if_production).and_return(mock_notifier)
          expect(mock_notifier).not_to receive(:notify_asset_processors_of_discussion)

          post "/api/lti/asset_processors/discussion_notices/#{assignment.id}/#{student.id}/resubmit_all"
          expect(response).to have_http_status(:no_content)
        end
      end

      context "when assignment is not a discussion" do
        let(:assignment) { assignment_model(course:, submission_types: "online_upload") }

        it "returns unprocessable entity" do
          post "/api/lti/asset_processors/discussion_notices/#{assignment.id}/#{student.id}/resubmit_all"
          expect(response).to have_http_status(:unprocessable_content)
          expect(response.parsed_body["error"]).to eq("Not a discussion assignment")
        end
      end

      context "when no asset processors are configured" do
        before do
          discussion_topic.discussion_entries.create!(
            user: student,
            message: "Entry without APs"
          )
        end

        it "returns no content without errors" do
          post "/api/lti/asset_processors/discussion_notices/#{assignment.id}/#{student.id}/resubmit_all"
          expect(response).to have_http_status(:no_content)
        end
      end
    end

    context "when testing before_actions" do
      context "require_feature_enabled" do
        before do
          Account.site_admin.disable_feature!(:lti_asset_processor)
          user_session(teacher)
        end

        it "returns not found when feature is disabled" do
          post "/api/lti/asset_processors/discussion_notices/#{assignment.id}/#{student.id}/resubmit_all"
          expect(response).to have_http_status(:not_found)
        end
      end

      context "require_user" do
        it "returns unauthorized when user is not authenticated" do
          post "/api/lti/asset_processors/discussion_notices/#{assignment.id}/#{student.id}/resubmit_all"
          expect(response).to have_http_status(:unauthorized)
        end
      end

      context "require_access_to_context" do
        before do
          user_session(student)
        end

        it "returns forbidden when user doesn't have manage_grades permission" do
          post "/api/lti/asset_processors/discussion_notices/#{assignment.id}/#{student.id}/resubmit_all"
          expect(response).to have_http_status(:forbidden)
          expect(response.body).to eq("invalid_request")
        end
      end

      context "require_submission" do
        before do
          user_session(teacher)
        end

        it "returns not found when student doesn't exist" do
          post "/api/lti/asset_processors/discussion_notices/#{assignment.id}/nonexistent/resubmit_all"
          expect(response).to have_http_status(:not_found)
        end

        it "returns not found when student is not enrolled" do
          other_student = user_model
          post "/api/lti/asset_processors/discussion_notices/#{assignment.id}/#{other_student.id}/resubmit_all"
          expect(response).to have_http_status(:not_found)
        end
      end
    end
  end

  describe "parameter resolution" do
    let(:course) { course_model }
    let(:assignment) { assignment_model(course:) }
    let(:student) { course_with_student(course:, active_all: true).user }
    let(:teacher) { course_with_teacher(course:, active_all: true).user }
    let(:asset_processor) { lti_asset_processor_model(assignment:) }
    let(:submission) { submission_model(assignment:, user: student) }

    before do
      Account.site_admin.enable_feature!(:lti_asset_processor)
      user_session(teacher)
    end

    describe "asset_processor resolution" do
      it "resolves asset processor from asset_processor_id param and succeeds" do
        received_submission = nil
        allow(Lti::AssetProcessorNotifier).to receive(:notify_asset_processors).and_wrap_original do |method, sub, *args|
          received_submission = sub
          method.call(sub, *args)
        end

        post "/api/lti/asset_processors/#{asset_processor.id}/notices/#{student.id}/attempts/latest"
        expect(response).to have_http_status(:no_content)
        expect(received_submission&.user).to eq(student)
      end

      it "fails when asset processor doesn't exist" do
        post "/api/lti/asset_processors/nonexistent/notices/#{student.id}/attempts/latest"
        expect(response).to have_http_status(:not_found)
      end
    end

    describe "student resolution" do
      it "resolves student from student_id param and succeeds" do
        received_submission = nil
        allow(Lti::AssetProcessorNotifier).to receive(:notify_asset_processors).and_wrap_original do |method, sub, *args|
          received_submission = sub
          method.call(sub, *args)
        end

        post "/api/lti/asset_processors/#{asset_processor.id}/notices/#{student.id}/attempts/latest"
        expect(response).to have_http_status(:no_content)
        expect(received_submission&.user).to eq(student)
      end

      it "fails when student doesn't exist" do
        post "/api/lti/asset_processors/#{asset_processor.id}/notices/nonexistent/attempts/latest"
        expect(response).to have_http_status(:not_found)
      end

      context "with anonymous student ID" do
        let(:anonymous_submission) { submission_model(assignment:, user: student, anonymous_grading: true) }

        it "resolves student from anonymous student ID format" do
          received_submission = nil
          allow(Lti::AssetProcessorNotifier).to receive(:notify_asset_processors).and_wrap_original do |method, sub, *args|
            received_submission = sub
            method.call(sub, *args)
          end

          post "/api/lti/asset_processors/#{asset_processor.id}/notices/anonymous:#{anonymous_submission.anonymous_id}/attempts/latest"
          expect(response).to have_http_status(:no_content)
          expect(received_submission&.user).to eq(student)
        end

        it "fails when anonymous ID is invalid" do
          post "/api/lti/asset_processors/#{asset_processor.id}/notices/anonymous:invalid_id/attempts/latest"
          expect(response).to have_http_status(:not_found)
        end
      end
    end

    describe "submission resolution" do
      it "resolves submission for student and succeeds" do
        received_submission = nil
        allow(Lti::AssetProcessorNotifier).to receive(:notify_asset_processors).and_wrap_original do |method, sub, *args|
          received_submission = sub
          method.call(sub, *args)
        end

        post "/api/lti/asset_processors/#{asset_processor.id}/notices/#{student.id}/attempts/latest"
        expect(response).to have_http_status(:no_content)
        expect(received_submission).to eq(submission)
      end

      it "returns the submission for anonymous student ID" do
        anonymous_assignment = assignment_model(course:, anonymous_grading: true)
        anonymous_submission = submission_model(assignment: anonymous_assignment, user: student)
        anonymous_asset_processor = lti_asset_processor_model(assignment: anonymous_assignment)

        received_submission = nil
        allow(Lti::AssetProcessorNotifier).to receive(:notify_asset_processors).and_wrap_original do |method, sub, *args|
          received_submission = sub
          method.call(sub, *args)
        end

        post "/api/lti/asset_processors/#{anonymous_asset_processor.id}/notices/anonymous:#{anonymous_submission.anonymous_id}/attempts/latest"
        expect(response).to have_http_status(:no_content)
        expect(received_submission).to eq(anonymous_submission)
      end
    end
  end
end
