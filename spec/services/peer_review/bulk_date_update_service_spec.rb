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

RSpec.describe PeerReview::BulkDateUpdateService do
  def month_day(num_days) = Time.now.utc.beginning_of_month + num_days.days

  let(:course) { course_model }
  let(:parent_assignment) do
    assignment_model(
      course:,
      peer_reviews: true,
      unlock_at: month_day(4),
      due_at: month_day(14),
      lock_at: month_day(22),
      submission_types: "online_text_entry"
    )
  end

  let(:peer_review_sub) { @parent_assignment.peer_review_sub_assignment }

  before do
    peer_review_model(parent_assignment:)
    @parent_assignment.reload
  end

  describe ".call" do
    context "with base date data" do
      # ordering: parent_unlock(T+4) <= peer_review_unlock(T+6) <= peer_review_due(T+10) <= parent_due(T+14) <= peer_review_lock(T+16) <= parent_lock(T+22)
      let(:new_unlock_at) { month_day(6).iso8601 }
      let(:new_due_at)    { month_day(10).iso8601 }
      let(:new_lock_at)   { month_day(16).iso8601 }

      let(:peer_review_data) do
        {
          "all_dates" => [
            {
              "base" => true,
              "due_at" => new_due_at,
              "unlock_at" => new_unlock_at,
              "lock_at" => new_lock_at
            }
          ]
        }
      end

      it "mutates due_at on the peer review sub-assignment in memory" do
        described_class.call(assignment: @parent_assignment, peer_review_data:)
        expect(peer_review_sub.due_at.utc.iso8601).to eq(new_due_at)
      end

      it "mutates unlock_at on the peer review sub-assignment in memory" do
        described_class.call(assignment: @parent_assignment, peer_review_data:)
        expect(peer_review_sub.unlock_at.utc.iso8601).to eq(new_unlock_at)
      end

      it "mutates lock_at on the peer review sub-assignment in memory" do
        described_class.call(assignment: @parent_assignment, peer_review_data:)
        expect(peer_review_sub.lock_at.utc.iso8601).to eq(new_lock_at)
      end

      it "returns true when dates changed" do
        expect(described_class.call(assignment: @parent_assignment, peer_review_data:)).to be true
      end

      it "does not persist the changes" do
        original_due_at = peer_review_sub.due_at
        described_class.call(assignment: @parent_assignment, peer_review_data:)
        expect(peer_review_sub.changed?).to be true
        peer_review_sub.reload
        expect(peer_review_sub.due_at).to be_within(1.second).of(original_due_at)
      end
    end

    context "when no dates have changed" do
      let(:peer_review_data) do
        # Use the Time objects directly to avoid ISO8601 precision mismatches
        {
          "all_dates" => [
            {
              "base" => true,
              "due_at" => peer_review_sub.due_at,
              "unlock_at" => peer_review_sub.unlock_at,
              "lock_at" => peer_review_sub.lock_at
            }
          ]
        }
      end

      it "returns false" do
        expect(described_class.call(assignment: @parent_assignment, peer_review_data:)).to be false
      end
    end

    context "when all_dates is missing" do
      it "returns false without raising" do
        expect(described_class.call(assignment: @parent_assignment, peer_review_data: {})).to be false
      end
    end

    context "when peer_review_sub_assignment is nil" do
      before { allow(@parent_assignment).to receive(:peer_review_sub_assignment).and_return(nil) }

      it "raises PeerReview::SubAssignmentNotExistError" do
        expect do
          described_class.call(assignment: @parent_assignment, peer_review_data: { "all_dates" => [] })
        end.to raise_error(PeerReview::SubAssignmentNotExistError)
      end
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

      # ordering: parent_override_due(T+19) = peer_review_override_unlock(T+19) <= peer_review_override_due(T+20) <= peer_review_override_lock(T+21) <= parent_lock(T+22)
      let(:new_unlock_at) { month_day(19).iso8601 }
      let(:new_due_at)    { month_day(20).iso8601 }
      let(:new_lock_at)   { month_day(21).iso8601 }

      let(:peer_review_data) do
        {
          "all_dates" => [
            {
              "id" => peer_review_override.id.to_s,
              "due_at" => new_due_at,
              "unlock_at" => new_unlock_at,
              "lock_at" => new_lock_at
            }
          ]
        }
      end

      before do
        # Ensure the association is loaded so detect works
        peer_review_sub.assignment_overrides.load
      end

      it "mutates the override due_at in memory" do
        described_class.call(assignment: @parent_assignment, peer_review_data:)
        expect(peer_review_override.due_at_overridden).to be true
        expect(peer_review_override.changed?).to be true
      end

      it "returns true when override dates changed" do
        expect(described_class.call(assignment: @parent_assignment, peer_review_data:)).to be true
      end

      it "does not persist override changes" do
        original_due_at = peer_review_override.due_at
        described_class.call(assignment: @parent_assignment, peer_review_data:)
        peer_review_override.reload
        expect(peer_review_override.due_at).to be_within(1.second).of(original_due_at)
      end

      it "raises PeerReview::OverrideNotFoundError for an unknown override id" do
        bad_data = {
          "all_dates" => [{ "id" => "999999", "due_at" => new_due_at }]
        }
        expect do
          described_class.call(assignment: @parent_assignment, peer_review_data: bad_data)
        end.to raise_error(PeerReview::OverrideNotFoundError)
      end

      context "when all override dates are cleared" do
        let(:peer_review_data) do
          {
            "all_dates" => [
              {
                "id" => peer_review_override.id.to_s,
                "due_at" => nil,
                "unlock_at" => nil,
                "lock_at" => nil
              }
            ]
          }
        end

        it "applies null dates to the override in memory (does not destroy)" do
          described_class.call(assignment: @parent_assignment, peer_review_data:)
          expect(peer_review_override.changed?).to be true
          expect(peer_review_override.due_at).to be_nil
        end

        it "returns true" do
          expect(described_class.call(assignment: @parent_assignment, peer_review_data:)).to be true
        end

        it "does not persist the null dates" do
          original_due_at = peer_review_override.due_at
          described_class.call(assignment: @parent_assignment, peer_review_data:)
          peer_review_override.reload
          expect(peer_review_override.due_at).to be_within(1.second).of(original_due_at)
        end
      end
    end
  end
end
