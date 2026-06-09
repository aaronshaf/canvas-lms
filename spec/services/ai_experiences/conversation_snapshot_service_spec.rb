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

describe AiExperiences::ConversationSnapshotService do
  before :once do
    course_with_teacher(active_all: true)
    @students = Array.new(3) { student_in_course(active_all: true).user }
    @course.root_account.enable_feature!(:ai_experiences)
    @experience = @course.ai_experiences.create!(
      title: "Test Experience",
      facts: "Facts",
      learning_objective: "Objective",
      pedagogical_guidance: "Guidance",
      workflow_state: "published"
    )
  end

  let(:student_ids) { @students.map(&:id) }

  def create_conversation(experience, user, workflow_state: "active", all_objectives_met: false)
    experience.ai_conversations.create!(
      llm_conversation_id: SecureRandom.uuid,
      user:,
      course: @course,
      root_account: @course.root_account,
      account: @course.root_account,
      workflow_state:,
      all_objectives_met:
    )
  end

  describe ".counts_from_conversations" do
    it "returns zero counts when no conversations exist" do
      counts = described_class.counts_from_conversations([], student_ids)
      expect(counts).to eq(completed: 0, in_progress: 0, not_started: 3)
    end

    it "counts completed conversations" do
      conv = create_conversation(@experience, @students[0], all_objectives_met: true)
      counts = described_class.counts_from_conversations([conv], student_ids)
      expect(counts[:completed]).to eq(1)
      expect(counts[:not_started]).to eq(2)
    end

    it "counts in_progress conversations" do
      conv = create_conversation(@experience, @students[0], workflow_state: "active", all_objectives_met: false)
      counts = described_class.counts_from_conversations([conv], student_ids)
      expect(counts[:in_progress]).to eq(1)
      expect(counts[:not_started]).to eq(2)
    end

    it "counts ended conversations as not in_progress" do
      conv = create_conversation(@experience, @students[0], workflow_state: "ended", all_objectives_met: false)
      counts = described_class.counts_from_conversations([conv], student_ids)
      expect(counts[:in_progress]).to eq(0)
      expect(counts[:not_started]).to eq(2)
    end

    it "counts all three states correctly" do
      completed = create_conversation(@experience, @students[0], all_objectives_met: true)
      in_progress = create_conversation(@experience, @students[1], workflow_state: "active", all_objectives_met: false)
      counts = described_class.counts_from_conversations([completed, in_progress], student_ids)
      expect(counts).to eq(completed: 1, in_progress: 1, not_started: 1)
    end
  end

  describe ".batch_snapshots" do
    it "returns empty hash when experience_ids is empty" do
      expect(described_class.batch_snapshots(experience_ids: [], student_ids:)).to eq({})
    end

    it "returns empty hash when student_ids is empty" do
      result = described_class.batch_snapshots(experience_ids: [@experience.id], student_ids: [])
      expect(result).to eq({})
    end

    it "returns a key for each experience id" do
      exp2 = @course.ai_experiences.create!(
        title: "Second Experience",
        facts: "Facts",
        learning_objective: "Objective",
        pedagogical_guidance: "Guidance",
        workflow_state: "published"
      )
      result = described_class.batch_snapshots(
        experience_ids: [@experience.id, exp2.id],
        student_ids:
      )
      expect(result.keys).to contain_exactly(@experience.id, exp2.id)
    end

    it "counts completions per experience independently" do
      exp2 = @course.ai_experiences.create!(
        title: "Second Experience",
        facts: "Facts",
        learning_objective: "Objective",
        pedagogical_guidance: "Guidance",
        workflow_state: "published"
      )
      create_conversation(@experience, @students[0], all_objectives_met: true)
      create_conversation(@experience, @students[1], all_objectives_met: true)
      create_conversation(exp2, @students[0], all_objectives_met: false)

      result = described_class.batch_snapshots(
        experience_ids: [@experience.id, exp2.id],
        student_ids:
      )

      expect(result[@experience.id][:completed]).to eq(2)
      expect(result[exp2.id][:completed]).to eq(0)
      expect(result[exp2.id][:in_progress]).to eq(1)
    end

    it "uses the latest conversation per student when multiple exist" do
      # Student resets: old ended conv, new active conv
      old_conv = create_conversation(@experience, @students[0], workflow_state: "ended", all_objectives_met: true)
      old_conv.update_column(:updated_at, 1.hour.ago)
      create_conversation(@experience, @students[0], workflow_state: "active", all_objectives_met: false)

      result = described_class.batch_snapshots(
        experience_ids: [@experience.id],
        student_ids:
      )

      # Latest conv is active (not completed), so completed count is 0
      expect(result[@experience.id][:completed]).to eq(0)
      expect(result[@experience.id][:in_progress]).to eq(1)
    end

    it "excludes deleted conversations" do
      create_conversation(@experience, @students[0], workflow_state: "deleted", all_objectives_met: true)

      result = described_class.batch_snapshots(
        experience_ids: [@experience.id],
        student_ids:
      )

      expect(result[@experience.id][:completed]).to eq(0)
      expect(result[@experience.id][:not_started]).to eq(3)
    end
  end
end
