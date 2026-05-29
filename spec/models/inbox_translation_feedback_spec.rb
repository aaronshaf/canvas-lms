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

describe InboxTranslationFeedback do
  before :once do
    user_model
  end

  let(:feedback) do
    described_class.create!(
      user: @user,
      root_account: Account.default,
      target_language: "es"
    )
  end

  describe "validations" do
    it "requires target_language" do
      record = described_class.new(user: @user, root_account: Account.default)
      expect(record).not_to be_valid
      expect(record.errors[:target_language]).to include("can't be blank")
    end

    it "rejects liked and disliked being true at once" do
      expect do
        described_class.create!(
          user: @user,
          root_account: Account.default,
          target_language: "es",
          liked: true,
          disliked: true
        )
      end.to raise_error(ActiveRecord::StatementInvalid)
    end
  end

  describe "#like" do
    it "sets liked to true" do
      feedback.like
      feedback.reload
      expect(feedback.liked).to be true
      expect(feedback.disliked).to be false
    end

    it "toggles from disliked to liked" do
      feedback.dislike
      feedback.like
      feedback.reload
      expect(feedback.liked).to be true
      expect(feedback.disliked).to be false
    end
  end

  describe "#dislike" do
    it "sets disliked to true" do
      feedback.dislike
      feedback.reload
      expect(feedback.liked).to be false
      expect(feedback.disliked).to be true
    end

    it "stores feedback notes" do
      feedback.dislike(notes: "Bad translation")
      feedback.reload
      expect(feedback.feedback_notes).to eq("Bad translation")
    end
  end

  describe "#reset_like" do
    it "clears liked, disliked, and feedback_notes" do
      feedback.dislike(notes: "Bad translation")
      feedback.reset_like
      feedback.reload
      expect(feedback.liked).to be false
      expect(feedback.disliked).to be false
      expect(feedback.feedback_notes).to be_nil
    end
  end
end
