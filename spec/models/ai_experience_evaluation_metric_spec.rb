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

describe AiExperienceEvaluationMetric do
  let(:root_account) { Account.default }
  let(:course) { course_factory(account: root_account) }
  let(:ai_experience) do
    AiExperience.create!(
      title: "Test Experience",
      description: "Test description",
      facts: "Test facts",
      learning_objective: "Test objective",
      pedagogical_guidance: "Test guidance",
      course:
    )
  end

  describe "validations" do
    it "is valid with name, description, enabled, and visible_to_learners" do
      metric = AiExperienceEvaluationMetric.new(ai_experience:, name: "summary", description: "An overall summary.", enabled: true, visible_to_learners: false)
      expect(metric).to be_valid
    end

    it "requires name" do
      metric = AiExperienceEvaluationMetric.new(ai_experience:, name: "", description: "A description.", enabled: true, visible_to_learners: false)
      expect(metric).not_to be_valid
      expect(metric.errors[:name]).to be_present
    end

    it "requires description" do
      metric = AiExperienceEvaluationMetric.new(ai_experience:, name: "summary", description: "", enabled: true, visible_to_learners: false)
      expect(metric).not_to be_valid
      expect(metric.errors[:description]).to be_present
    end

    it "rejects description shorter than 10 characters" do
      metric = AiExperienceEvaluationMetric.new(ai_experience:, name: "summary", description: "Too short", enabled: true, visible_to_learners: false)
      expect(metric).not_to be_valid
      expect(metric.errors[:description]).to be_present
    end

    it "rejects description longer than 1000 characters" do
      metric = AiExperienceEvaluationMetric.new(ai_experience:, name: "summary", description: "a" * 1001, enabled: true, visible_to_learners: false)
      expect(metric).not_to be_valid
      expect(metric.errors[:description]).to be_present
    end

    it "rejects name longer than 255 characters" do
      metric = AiExperienceEvaluationMetric.new(ai_experience:, name: "a" * 256, description: "A description.", enabled: true, visible_to_learners: false)
      expect(metric).not_to be_valid
      expect(metric.errors[:name]).to be_present
    end

    it "accepts name with spaces" do
      metric = AiExperienceEvaluationMetric.new(ai_experience:, name: "Student engagement", description: "How engaged the student was.", enabled: true, visible_to_learners: false)
      expect(metric).to be_valid
    end

    it "rejects name containing a newline" do
      metric = AiExperienceEvaluationMetric.new(ai_experience:, name: "summary\ninjection", description: "A description.", enabled: true, visible_to_learners: false)
      expect(metric).not_to be_valid
      expect(metric.errors[:name]).to be_present
    end

    it "rejects name containing a tab" do
      metric = AiExperienceEvaluationMetric.new(ai_experience:, name: "summary\tinjection", description: "A description.", enabled: true, visible_to_learners: false)
      expect(metric).not_to be_valid
      expect(metric.errors[:name]).to be_present
    end

    it "validates uniqueness of name scoped to ai_experience" do
      AiExperienceEvaluationMetric.create!(ai_experience:, name: "summary", description: "An overall summary.", enabled: true, visible_to_learners: false)
      duplicate = AiExperienceEvaluationMetric.new(ai_experience:, name: "summary", description: "Another description.", enabled: false, visible_to_learners: true)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:name]).to be_present
    end

    it "allows the same name on a different ai_experience" do
      other_experience = AiExperience.create!(
        title: "Other Experience",
        facts: "Other facts",
        learning_objective: "Other objective",
        pedagogical_guidance: "Other guidance",
        course:
      )
      AiExperienceEvaluationMetric.create!(ai_experience:, name: "summary", description: "An overall summary.", enabled: true, visible_to_learners: false)
      metric = AiExperienceEvaluationMetric.new(ai_experience: other_experience, name: "summary", description: "An overall summary.", enabled: true, visible_to_learners: false)
      expect(metric).to be_valid
    end
  end

  describe "acts_as_list" do
    it "assigns sequential positions scoped to ai_experience" do
      m1 = AiExperienceEvaluationMetric.create!(ai_experience:, name: "summary", description: "An overall summary.", enabled: true, visible_to_learners: false)
      m2 = AiExperienceEvaluationMetric.create!(ai_experience:, name: "areas_for_improvement", description: "Guidance for improvement.", enabled: true, visible_to_learners: false)

      expect(m1.position).to eq(1)
      expect(m2.position).to eq(2)
    end
  end
end
