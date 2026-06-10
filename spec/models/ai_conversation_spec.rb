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
end
