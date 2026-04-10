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

RSpec.describe PeerReview::DateValidationService do
  let(:course) { course_model(name: "Test Course") }
  let(:peer_review_sub_assignment) { peer_review_model(course:) }
  let(:parent_assignment) { peer_review_sub_assignment.parent_assignment }

  before { course.enable_feature!(:peer_review_allocation_and_grading) }

  describe "#call" do
    context "when base dates are valid relative to parent" do
      it "returns true without raising" do
        result = described_class.call(peer_review_sub_assignment:)
        expect(result).to be(true)
      end
    end

    context "when peer review sub assignment has no base dates" do
      before do
        peer_review_sub_assignment.update_columns(due_at: nil, unlock_at: nil, lock_at: nil)
      end

      it "returns true without validating" do
        result = described_class.call(peer_review_sub_assignment:)
        expect(result).to be(true)
      end
    end

    context "when peer review unlock_at is before parent due_at" do
      before do
        peer_review_sub_assignment.update_columns(unlock_at: 4.days.from_now)
        parent_assignment.update_columns(due_at: 5.days.from_now)
      end

      it "raises InvalidDatesError" do
        expect do
          described_class.call(peer_review_sub_assignment:)
        end.to raise_error(PeerReview::InvalidDatesError, /available from date cannot be before assignment due date/)
      end
    end

    context "when peer review lock_at is after parent lock_at" do
      before do
        peer_review_sub_assignment.update_columns(lock_at: 12.days.from_now)
        parent_assignment.update_columns(lock_at: 10.days.from_now)
      end

      it "raises InvalidDatesError" do
        expect do
          described_class.call(peer_review_sub_assignment:)
        end.to raise_error(PeerReview::InvalidDatesError, /until date cannot be after assignment until date/)
      end
    end

    context "when peer review due_at is before parent due_at" do
      before do
        parent_assignment.update_columns(due_at: 5.days.from_now)
        # unlock_at nil to avoid the unlock_at constraint firing first
        peer_review_sub_assignment.update_columns(unlock_at: nil, due_at: 3.days.from_now)
      end

      it "raises InvalidDatesError" do
        expect do
          described_class.call(peer_review_sub_assignment:)
        end.to raise_error(PeerReview::InvalidDatesError, /Peer review due date cannot be before assignment due date/)
      end
    end

    context "with section override dates" do
      let(:section) { course.default_section }
      let(:parent_override) do
        parent_assignment.assignment_overrides.create!(
          set_type: "CourseSection",
          set_id: section.id,
          due_at: 5.days.from_now,
          due_at_overridden: true
        )
      end
      let(:pr_override) do
        peer_review_sub_assignment.assignment_overrides.create!(
          set_type: "CourseSection",
          set_id: section.id,
          unlock_at: 6.days.from_now,
          unlock_at_overridden: true,
          due_at: 8.days.from_now,
          due_at_overridden: true,
          parent_override:
        )
      end

      before { pr_override }

      it "returns true when override dates are valid" do
        result = described_class.call(peer_review_sub_assignment:)
        expect(result).to be(true)
      end

      context "when peer review override unlock_at is before parent override due_at" do
        before do
          parent_override.update_columns(due_at: 7.days.from_now)
        end

        it "raises InvalidDatesError" do
          expect do
            described_class.call(peer_review_sub_assignment:)
          end.to raise_error(PeerReview::InvalidDatesError, /override available from date cannot be before parent override due date/)
        end
      end

      context "when peer review override has no dates set" do
        before do
          pr_override.update_columns(
            due_at: nil,
            due_at_overridden: false,
            unlock_at: nil,
            unlock_at_overridden: false,
            lock_at: nil,
            lock_at_overridden: false
          )
        end

        it "skips that override and returns true" do
          result = described_class.call(peer_review_sub_assignment:)
          expect(result).to be(true)
        end
      end
    end

    context "with multiple overrides where one is valid and one is invalid" do
      let(:section1) { course.default_section }
      let(:section2) { course.course_sections.create!(name: "Section 2") }

      before do
        parent_override1 = parent_assignment.assignment_overrides.create!(
          set_type: "CourseSection",
          set_id: section1.id,
          due_at: 5.days.from_now,
          due_at_overridden: true
        )
        peer_review_sub_assignment.assignment_overrides.create!(
          set_type: "CourseSection",
          set_id: section1.id,
          unlock_at: 6.days.from_now,
          unlock_at_overridden: true,
          parent_override: parent_override1
        )

        parent_override2 = parent_assignment.assignment_overrides.create!(
          set_type: "CourseSection",
          set_id: section2.id,
          due_at: 8.days.from_now,
          due_at_overridden: true
        )
        peer_review_sub_assignment.assignment_overrides.create!(
          set_type: "CourseSection",
          set_id: section2.id,
          unlock_at: 7.days.from_now,
          unlock_at_overridden: true,
          parent_override: parent_override2
        )
      end

      it "raises InvalidDatesError for the invalid override" do
        expect do
          described_class.call(peer_review_sub_assignment:)
        end.to raise_error(PeerReview::InvalidDatesError, /override available from date cannot be before parent override due date/)
      end
    end

    context "with an orphaned peer review override (no parent_override)" do
      before do
        parent_override = parent_assignment.assignment_overrides.create!(
          set_type: "CourseSection",
          set_id: course.default_section.id,
          due_at: 10.days.from_now,
          due_at_overridden: true
        )
        pr_override = peer_review_sub_assignment.assignment_overrides.create!(
          set_type: "CourseSection",
          set_id: course.default_section.id,
          due_at: 12.days.from_now,
          due_at_overridden: true,
          parent_override:
        )
        pr_override.update_columns(parent_override_id: nil)
      end

      it "skips the orphan and returns true" do
        result = described_class.call(peer_review_sub_assignment:)
        expect(result).to be(true)
      end
    end

    context "when peer_review_sub_assignment is nil" do
      it "raises InvalidParentAssignmentError" do
        expect do
          described_class.call(peer_review_sub_assignment: nil)
        end.to raise_error(PeerReview::InvalidParentAssignmentError)
      end
    end
  end
end
