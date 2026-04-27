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

RSpec.describe Assignment::BulkUpdate do
  def month_day(num_days) = Time.now.utc.beginning_of_month + num_days.days

  let(:course) { course_model }
  let(:teacher) { teacher_in_course(course:, active_all: true).user }

  let(:parent_assignment) do
    assignment_model(
      course:,
      peer_reviews: true,
      unlock_at: month_day(4),
      due_at: month_day(10),
      lock_at: month_day(24),
      submission_types: "online_text_entry"
    )
  end

  let(:peer_review_sub) { @peer_review_sub_assignment }
  let(:bulk_update) { described_class.new(course, teacher) }

  let(:progress) do
    instance_double(Progress,
                    calculate_completion!: nil,
                    fail: nil,
                    complete: nil,
                    set_results: nil)
  end

  before do
    peer_review_model(parent_assignment:)
    parent_assignment.reload
  end

  describe "#run with peer review sub assignment data" do
    # ordering: parent_unlock(T+4) <= parent_due(T+10) <= peer_review_unlock(T+11) <= peer_review_due(T+14) <= peer_review_lock(T+16) <= parent_lock(T+24)
    let(:new_peer_review_unlock_at) { month_day(11).iso8601 }
    let(:new_peer_review_due_at)    { month_day(14).iso8601 }
    let(:new_peer_review_lock_at)   { month_day(16).iso8601 }

    let(:assignment_data) do
      [
        {
          "id" => parent_assignment.id.to_s,
          "all_dates" => [
            {
              "base" => true,
              "due_at" => parent_assignment.due_at.utc.iso8601,
              "unlock_at" => parent_assignment.unlock_at.utc.iso8601,
              "lock_at" => parent_assignment.lock_at.utc.iso8601
            }
          ],
          "peer_review_sub_assignment" => {
            "id" => peer_review_sub.id.to_s,
            "all_dates" => [
              {
                "base" => true,
                "due_at" => new_peer_review_due_at,
                "unlock_at" => new_peer_review_unlock_at,
                "lock_at" => new_peer_review_lock_at
              }
            ]
          }
        }
      ]
    end

    it "saves peer review sub assignment base dates to the database" do
      bulk_update.run(progress, assignment_data)
      peer_review_sub.reload
      expect(peer_review_sub.due_at.utc.iso8601).to eq(new_peer_review_due_at)
    end

    it "marks progress as complete on success" do
      expect(progress).to receive(:complete)
      bulk_update.run(progress, assignment_data)
    end

    it "does not process peer review data when the feature flag is off" do
      course.disable_feature!(:peer_review_allocation_and_grading)
      original_due_at = peer_review_sub.due_at
      bulk_update.run(progress, assignment_data)
      peer_review_sub.reload
      expect(peer_review_sub.due_at).to be_within(1.second).of(original_due_at)
    end

    it "saves peer review sub assignment base dates when all_dates is empty (parent not edited)" do
      data_pr_only = [
        {
          "id" => parent_assignment.id.to_s,
          "all_dates" => [],
          "peer_review_sub_assignment" => {
            "id" => peer_review_sub.id.to_s,
            "all_dates" => [
              {
                "base" => true,
                "due_at" => new_peer_review_due_at,
                "unlock_at" => new_peer_review_unlock_at,
                "lock_at" => new_peer_review_lock_at
              }
            ]
          }
        }
      ]
      bulk_update.run(progress, data_pr_only)
      peer_review_sub.reload
      expect(peer_review_sub.due_at.utc.iso8601).to eq(new_peer_review_due_at)
    end

    it "does not modify peer review sub assignment dates when no peer_review_sub_assignment data is in the payload" do
      data_without_pr = [
        {
          "id" => parent_assignment.id.to_s,
          "all_dates" => [
            {
              "base" => true,
              "due_at" => (parent_assignment.due_at + 1.day).utc.iso8601,
              "unlock_at" => parent_assignment.unlock_at.utc.iso8601,
              "lock_at" => parent_assignment.lock_at.utc.iso8601
            }
          ]
        }
      ]
      original_peer_review_due_at = peer_review_sub.due_at
      bulk_update.run(progress, data_without_pr)
      peer_review_sub.reload
      expect(peer_review_sub.due_at).to be_within(1.second).of(original_peer_review_due_at)
    end

    it "includes peer review sub assignment in SubmissionLifecycleManager recompute when peer review data is present" do
      expect(SubmissionLifecycleManager).to receive(:recompute_course) do |_ctx, kwargs|
        expect(kwargs[:assignments]).to include(peer_review_sub)
      end
      bulk_update.run(progress, assignment_data)
    end

    context "with override date data" do
      let!(:section) { add_section("Section A", course:) }
      let!(:parent_override) do
        parent_assignment.assignment_overrides.create!(
          set_type: "CourseSection",
          set: section,
          due_at: month_day(19),
          due_at_overridden: true,
          dont_touch_assignment: true
        )
      end
      let!(:peer_review_override) do
        peer_review_sub.assignment_overrides.create!(
          set_type: "CourseSection",
          set: section,
          parent_override:,
          due_at: month_day(21),
          due_at_overridden: true,
          dont_touch_assignment: true
        )
      end

      let(:new_override_peer_review_due_at) { month_day(23).iso8601 }

      let(:assignment_data_with_overrides) do
        [
          {
            "id" => parent_assignment.id.to_s,
            "all_dates" => [
              {
                "base" => true,
                "due_at" => parent_assignment.due_at.utc.iso8601,
                "unlock_at" => parent_assignment.unlock_at.utc.iso8601,
                "lock_at" => parent_assignment.lock_at.utc.iso8601
              }
            ],
            "peer_review_sub_assignment" => {
              "id" => peer_review_sub.id.to_s,
              "all_dates" => [
                {
                  "id" => peer_review_override.id.to_s,
                  "due_at" => new_override_peer_review_due_at,
                  "unlock_at" => nil,
                  "lock_at" => nil
                }
              ]
            }
          }
        ]
      end

      it "saves peer review override dates to the database" do
        bulk_update.run(progress, assignment_data_with_overrides)
        peer_review_override.reload
        # override_due_at normalizes to end-of-day; compare dates only
        expect(peer_review_override.due_at.to_date).to eq(Date.parse(new_override_peer_review_due_at))
      end

      context "when all peer review override dates are cleared" do
        let(:assignment_data_clear_peer_review_override) do
          [
            {
              "id" => parent_assignment.id.to_s,
              "all_dates" => [
                {
                  "base" => true,
                  "due_at" => parent_assignment.due_at.utc.iso8601,
                  "unlock_at" => parent_assignment.unlock_at.utc.iso8601,
                  "lock_at" => parent_assignment.lock_at.utc.iso8601
                }
              ],
              "peer_review_sub_assignment" => {
                "id" => peer_review_sub.id.to_s,
                "all_dates" => [
                  {
                    "id" => peer_review_override.id.to_s,
                    "due_at" => nil,
                    "unlock_at" => nil,
                    "lock_at" => nil
                  }
                ]
              }
            }
          ]
        end

        it "persists null dates on the peer review override (does not destroy it)" do
          bulk_update.run(progress, assignment_data_clear_peer_review_override)
          peer_review_override.reload
          expect(peer_review_override.workflow_state).to eq("active")
          expect(peer_review_override.due_at).to be_nil
        end
      end
    end

    context "broadcasting and notifications" do
      it "saves the peer review sub assignment without broadcasting" do
        expect_any_instance_of(PeerReviewSubAssignment).to receive(:save_without_broadcasting!).and_call_original
        bulk_update.run(progress, assignment_data)
      end

      it "schedules do_notifications! for the peer review sub via delay_if_production when it changes" do
        delayed_proxy = instance_double(PeerReviewSubAssignment, do_notifications!: nil)
        allow_any_instance_of(Assignment).to receive(:delay_if_production).and_call_original
        expect_any_instance_of(PeerReviewSubAssignment).to receive(:delay_if_production).and_return(delayed_proxy)
        expect(delayed_proxy).to receive(:do_notifications!)
        bulk_update.run(progress, assignment_data)
      end

      it "does not call do_notifications! on the peer review sub when only parent dates change" do
        data_without_pr = [
          {
            "id" => parent_assignment.id.to_s,
            "all_dates" => [
              {
                "base" => true,
                "due_at" => (parent_assignment.due_at + 1.day).utc.iso8601,
                "unlock_at" => parent_assignment.unlock_at.utc.iso8601,
                "lock_at" => parent_assignment.lock_at.utc.iso8601
              }
            ]
          }
        ]
        expect_any_instance_of(PeerReviewSubAssignment).not_to receive(:delay_if_production)
        expect_any_instance_of(PeerReviewSubAssignment).not_to receive(:do_notifications!)
        bulk_update.run(progress, data_without_pr)
      end
    end

    context "when peer review sub assignment fails validation" do
      before do
        allow_any_instance_of(PeerReviewSubAssignment).to receive(:valid?).and_return(false)
        allow_any_instance_of(PeerReviewSubAssignment).to receive(:errors).and_return(
          ActiveModel::Errors.new(PeerReviewSubAssignment.new)
        )
      end

      it "marks progress as failed" do
        expect(progress).to receive(:fail)
        bulk_update.run(progress, assignment_data)
      end
    end

    context "when parent date shift makes peer review base dates invalid" do
      # peer_review due_at is T+14; shifting parent due_at to T+20 makes it invalid
      let(:assignment_data_parent_shifted) do
        [
          {
            "id" => parent_assignment.id.to_s,
            "all_dates" => [
              {
                "base" => true,
                "due_at" => month_day(20).iso8601,
                "unlock_at" => parent_assignment.unlock_at.utc.iso8601,
                "lock_at" => parent_assignment.lock_at.utc.iso8601
              }
            ]
          }
        ]
      end

      before do
        peer_review_sub.update_columns(
          unlock_at: nil,
          due_at: month_day(14)
        )
      end

      it "marks progress as failed" do
        expect(progress).to receive(:fail)
        bulk_update.run(progress, assignment_data_parent_shifted)
      end

      it "reports the peer review violation per assignment" do
        bulk_update.run(progress, assignment_data_parent_shifted)
        expect(progress).to have_received(:set_results).with(
          array_including(
            hash_including(
              "assignment_id" => parent_assignment.id,
              "errors" => hash_including(
                "base" => array_including(
                  hash_including("message" => "Peer Review: Peer review due date cannot be before assignment due date")
                )
              )
            )
          )
        )
      end
    end

    context "when the peer review sub assignment is missing" do
      let(:missing_pr_sub_id) { peer_review_sub.id }

      let(:assignment_data_missing_pr_sub) do
        [
          {
            "id" => parent_assignment.id.to_s,
            "all_dates" => [],
            "peer_review_sub_assignment" => {
              "id" => missing_pr_sub_id.to_s,
              "all_dates" => [
                {
                  "base" => true,
                  "due_at" => new_peer_review_due_at,
                  "unlock_at" => new_peer_review_unlock_at,
                  "lock_at" => new_peer_review_lock_at
                }
              ]
            }
          }
        ]
      end

      before do
        missing_pr_sub_id
        peer_review_sub.destroy
        parent_assignment.reload
      end

      it "marks progress as failed" do
        expect(progress).to receive(:fail)
        bulk_update.run(progress, assignment_data_missing_pr_sub)
      end

      it "reports the failure with a message that names the assignment id" do
        bulk_update.run(progress, assignment_data_missing_pr_sub)
        expect(progress).to have_received(:set_results).with(
          hash_including(
            "message" => a_string_matching(/Peer review sub assignment does not exist.*for assignment #{parent_assignment.id}/)
          )
        )
      end
    end

    context "when a peer review override id is unknown" do
      let(:assignment_data_bad_pr_override) do
        [
          {
            "id" => parent_assignment.id.to_s,
            "all_dates" => [],
            "peer_review_sub_assignment" => {
              "id" => peer_review_sub.id.to_s,
              "all_dates" => [
                {
                  "id" => "999999",
                  "due_at" => new_peer_review_due_at,
                  "unlock_at" => new_peer_review_unlock_at,
                  "lock_at" => new_peer_review_lock_at
                }
              ]
            }
          }
        ]
      end

      it "marks progress as failed" do
        expect(progress).to receive(:fail)
        bulk_update.run(progress, assignment_data_bad_pr_override)
      end

      it "reports the failure with a message that names the assignment id" do
        bulk_update.run(progress, assignment_data_bad_pr_override)
        expect(progress).to have_received(:set_results).with(
          hash_including(
            "message" => a_string_matching(/Override does not exist.*for assignment #{parent_assignment.id}/)
          )
        )
      end
    end

    context "when parent date shift makes a peer review override invalid" do
      let!(:section) { add_section("Section A", course:) }
      let!(:parent_override) do
        parent_assignment.assignment_overrides.create!(
          set_type: "CourseSection",
          set: section,
          due_at: month_day(19),
          due_at_overridden: true,
          dont_touch_assignment: true
        )
      end
      let(:peer_review_override) do
        peer_review_sub.assignment_overrides.create!(
          set_type: "CourseSection",
          set: section,
          parent_override:,
          unlock_at: month_day(20),
          unlock_at_overridden: true,
          dont_touch_assignment: true
        )
      end

      # shifting parent override due_at to T+21 makes peer review unlock_at (T+20) invalid
      let(:assignment_data_override_shifted) do
        [
          {
            "id" => parent_assignment.id.to_s,
            "all_dates" => [
              {
                "id" => parent_override.id.to_s,
                "due_at" => month_day(21).iso8601,
                "unlock_at" => nil,
                "lock_at" => nil
              }
            ]
          }
        ]
      end

      before { peer_review_override }

      it "marks progress as failed" do
        expect(progress).to receive(:fail)
        bulk_update.run(progress, assignment_data_override_shifted)
      end

      it "reports the override violation per assignment" do
        bulk_update.run(progress, assignment_data_override_shifted)
        expect(progress).to have_received(:set_results).with(
          array_including(
            hash_including(
              "assignment_id" => parent_assignment.id,
              "errors" => hash_including(
                "base" => array_including(
                  hash_including("message" => a_string_matching(/override/i))
                )
              )
            )
          )
        )
      end
    end
  end
end
