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

describe AiConversation do
  let(:course) { course_factory }
  let(:user) { user_factory }
  let(:ai_experience) do
    AiExperience.create!(
      title: "Test Experience",
      learning_objectives: ["Test learning objective"],
      pedagogical_guidance: "Test pedagogical guidance",
      course:
    )
  end

  let(:valid_attributes) do
    {
      llm_conversation_id: "test-123",
      user:,
      ai_experience:,
      course:
    }
  end

  describe "validations" do
    it "requires llm_conversation_id" do
      conversation = AiConversation.new(valid_attributes.except(:llm_conversation_id))
      expect(conversation).not_to be_valid
      expect(conversation.errors[:llm_conversation_id]).to include("can't be blank")
    end

    it "validates workflow_state inclusion" do
      conversation = AiConversation.new(valid_attributes.merge(workflow_state: "invalid_state"))
      expect(conversation).not_to be_valid
      expect(conversation.errors[:workflow_state]).to include("is not included in the list")
    end
  end

  describe "workflow state management" do
    let(:conversation) { AiConversation.create!(valid_attributes) }

    describe "#ended?" do
      it "returns true when workflow_state is ended" do
        conversation.end_session!
        expect(conversation.reload).to be_ended
      end

      it "returns false when workflow_state is active" do
        expect(conversation).not_to be_ended
      end
    end

    describe "#end_session!" do
      it "transitions active conversation to ended" do
        expect(conversation.end_session!).to be true
        expect(conversation.reload).to be_ended
      end

      it "returns false and does not change state when already deleted" do
        conversation.delete
        expect(conversation.end_session!).to be false
        expect(conversation.reload).to be_deleted
      end
    end

    describe "#delete" do
      it "transitions active conversation to deleted" do
        expect(conversation.delete).to be true
        expect(conversation.reload).to be_deleted
      end

      it "returns false when already deleted" do
        conversation.delete
        expect(conversation.delete).to be false
      end
    end

    describe "#mark_objectives_met!" do
      it "sets all_objectives_met to true" do
        expect { conversation.mark_objectives_met! }
          .to change { conversation.reload.all_objectives_met }.from(false).to(true)
      end
    end
  end

  describe "#completed?" do
    let(:conversation) { AiConversation.create!(valid_attributes) }

    it "returns false when all_objectives_met is false" do
      expect(conversation).not_to be_completed
    end

    it "returns true when all_objectives_met is true" do
      conversation.mark_objectives_met!
      expect(conversation.reload).to be_completed
    end

    it "is independent of workflow_state — an ended conversation with objectives met is still completed" do
      conversation.mark_objectives_met!
      conversation.end_session!
      expect(conversation.reload).to be_completed
    end
  end

  describe "scopes" do
    let!(:active_conversation) { AiConversation.create!(valid_attributes.merge(llm_conversation_id: "active-123")) }
    let!(:ended_conversation) { AiConversation.create!(valid_attributes.merge(llm_conversation_id: "ended-123", workflow_state: "ended")) }

    it "filters by workflow state" do
      expect(AiConversation.active).to contain_exactly(active_conversation)
      expect(AiConversation.ended).to contain_exactly(ended_conversation)
    end
  end

  describe "cross-shard user" do
    specs_require_sharding

    it "creates the conversation without an fk_rails_faada8ac9a violation when the user lives on another shard" do
      course = course_factory
      experience = AiExperience.create!(
        title: "Cross-shard Experience",
        learning_objectives: ["Test learning objective"],
        pedagogical_guidance: "Test pedagogical guidance",
        course:
      )
      cross_shard_user = @shard2.activate { user_factory }
      expect(cross_shard_user.shard).not_to eq(course.shard)

      conversation = nil
      expect do
        conversation = AiConversation.create!(
          llm_conversation_id: "cross-shard-123",
          user: cross_shard_user,
          ai_experience: experience,
          course:
        )
      end.not_to raise_error

      expect(conversation.shard).to eq(course.shard)
      # user_id is stored as the user's global id relative to the course shard...
      expect(conversation.user_id).to eq(cross_shard_user.global_id)
      # ...and the association still resolves back to the canonical user.
      expect(conversation.reload.user).to eq(cross_shard_user)
    end

    it "writes a shadow users row on the conversation's shard so the FK resolves" do
      course = course_factory
      experience = AiExperience.create!(
        title: "Cross-shard Experience",
        learning_objectives: ["Test learning objective"],
        pedagogical_guidance: "Test pedagogical guidance",
        course:
      )
      cross_shard_user = @shard2.activate { user_factory }

      AiConversation.create!(
        llm_conversation_id: "cross-shard-456",
        user: cross_shard_user,
        ai_experience: experience,
        course:
      )

      # associate_with_shard upserts a shadow row keyed by the global id on the
      # course's shard — the referent fk_rails_faada8ac9a needs.
      course.shard.activate do
        expect(User.where(id: cross_shard_user.global_id)).to exist
      end
    end

    it "associates the user with the conversation's shard on create" do
      course = course_factory
      experience = AiExperience.create!(
        title: "Cross-shard Experience",
        learning_objectives: ["Test learning objective"],
        pedagogical_guidance: "Test pedagogical guidance",
        course:
      )
      cross_shard_user = @shard2.activate { user_factory }

      expect(cross_shard_user).to receive(:associate_with_shard).with(course.shard).and_call_original

      AiConversation.create!(
        llm_conversation_id: "cross-shard-789",
        user: cross_shard_user,
        ai_experience: experience,
        course:
      )
    end

    it "still creates conversations for same-shard users" do
      same_shard_user = user_factory
      expect(same_shard_user.shard).to eq(course.shard)

      conversation = AiConversation.create!(valid_attributes.merge(user: same_shard_user, llm_conversation_id: "same-shard-123"))

      expect(conversation.user_id).to eq(same_shard_user.id)
      expect(conversation.reload.user).to eq(same_shard_user)
    end
  end
end
