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

describe DataFixup::BackfillLearningObjectives do
  let(:course) { course_model }

  before do
    # Avoid the llm-conversation network calls fired by AiExperience callbacks.
    allow_any_instance_of(AiExperiences::ConversationContextService).to receive(:create)
    allow_any_instance_of(AiExperiences::ConversationContextService).to receive(:update)
    allow_any_instance_of(AiExperiences::ConversationContextService).to receive(:delete)
  end

  # Creates an experience then forces it into the pre-backfill state
  # (legacy string populated, new array still at the default []) without
  # running validations or callbacks.
  def pre_backfill_experience(learning_objective)
    exp = AiExperience.create!(
      course:,
      title: "Test",
      pedagogical_guidance: "Guidance",
      learning_objectives: ["seed"]
    )
    exp.update_columns(learning_objective:, learning_objectives: [])
    exp
  end

  it "splits a multi-line learning_objective into array elements" do
    exp = pre_backfill_experience("First objective\nSecond objective\nThird objective")

    described_class.run

    expect(exp.reload.learning_objectives).to eq(["First objective", "Second objective", "Third objective"])
  end

  it "handles a single-line objective as a one-element array" do
    exp = pre_backfill_experience("Only one objective")

    described_class.run

    expect(exp.reload.learning_objectives).to eq(["Only one objective"])
  end

  it "strips surrounding whitespace and drops blank lines" do
    exp = pre_backfill_experience("  First  \n\n   \n  Second  ")

    described_class.run

    expect(exp.reload.learning_objectives).to eq(["First", "Second"])
  end

  it "handles carriage-return newlines" do
    exp = pre_backfill_experience("First\r\nSecond")

    described_class.run

    expect(exp.reload.learning_objectives).to eq(["First", "Second"])
  end

  it "leaves a whitespace-only legacy value at the empty default" do
    exp = pre_backfill_experience("   \n  \n ")

    described_class.run

    expect(exp.reload.learning_objectives).to eq([])
  end

  it "skips rows whose legacy column is nil" do
    exp = AiExperience.create!(
      course:,
      title: "Test",
      pedagogical_guidance: "Guidance",
      learning_objectives: ["seed"]
    )
    exp.update_columns(learning_objective: nil, learning_objectives: [])

    described_class.run

    expect(exp.reload.learning_objectives).to eq([])
  end

  it "does not touch rows that already have learning_objectives populated" do
    exp = AiExperience.create!(
      course:,
      title: "Test",
      pedagogical_guidance: "Guidance",
      learning_objectives: ["Already here"]
    )
    exp.update_column(:learning_objective, "Different legacy value")

    described_class.run

    expect(exp.reload.learning_objectives).to eq(["Already here"])
  end

  it "is idempotent — a second run changes nothing" do
    exp = pre_backfill_experience("First\nSecond")

    described_class.run
    first_pass = exp.reload.learning_objectives

    expect { described_class.run }.not_to change { exp.reload.learning_objectives }.from(first_pass)
  end

  it "backfills many rows in one pass" do
    experiences = Array.new(5) { |i| pre_backfill_experience("Objective #{i}") }

    described_class.run

    experiences.each_with_index do |exp, i|
      expect(exp.reload.learning_objectives).to eq(["Objective #{i}"])
    end
  end
end
