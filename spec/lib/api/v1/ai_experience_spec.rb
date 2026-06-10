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

describe Api::V1::AiExperience do
  before :once do
    course_with_teacher active_all: true
    @ai_experience = @course.ai_experiences.create!(
      title: "Customer Service Training",
      description: "Practice customer service scenarios",
      facts: "You are a customer service representative",
      learning_objectives: ["Learn customer service skills"],
      pedagogical_guidance: "Handle billing issues"
    )
  end

  let(:api) { Class.new { include Api::V1::AiExperience }.new }
  let(:session) { double }

  describe "ai_experience_json" do
    it "includes all specified attributes when can_manage is true" do
      json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: true)
      expected_fields = %w[id title description facts learning_objectives pedagogical_guidance workflow_state course_id context_index_status created_at updated_at]

      expected_fields.each do |field|
        expect(json).to have_key(field)
      end
    end

    it "returns correct attribute values when can_manage is true" do
      json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: true)

      expect(json["id"]).to eq @ai_experience.id
      expect(json["title"]).to eq @ai_experience.title
      expect(json["description"]).to eq @ai_experience.description
      expect(json["facts"]).to eq @ai_experience.facts
      expect(json["learning_objectives"]).to eq @ai_experience.learning_objectives
      expect(json["pedagogical_guidance"]).to eq @ai_experience.pedagogical_guidance
      expect(json["workflow_state"]).to eq @ai_experience.workflow_state
      expect(json["course_id"]).to eq @ai_experience.course_id
    end

    context "when can_manage is false" do
      it "excludes facts and pedagogical_guidance from JSON" do
        json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: false)

        expect(json).not_to have_key("facts")
        expect(json).not_to have_key(:facts)
        expect(json).not_to have_key("pedagogical_guidance")
        expect(json).not_to have_key(:pedagogical_guidance)
      end

      it "includes learning_objectives in JSON" do
        json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: false)

        expect(json).to have_key("learning_objectives")
        expect(json["learning_objectives"]).to eq @ai_experience.learning_objectives
      end

      it "includes basic fields in JSON" do
        json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: false)

        expect(json).to have_key("id")
        expect(json).to have_key("title")
        expect(json).to have_key("description")
        expect(json).to have_key("workflow_state")
        expect(json).to have_key("course_id")
      end
    end

    context "when can_manage is not specified" do
      it "excludes facts and pedagogical_guidance by default for safety" do
        json = api.ai_experience_json(@ai_experience, @teacher, session)

        expect(json).not_to have_key("facts")
        expect(json).not_to have_key("pedagogical_guidance")
      end

      it "still includes learning_objectives by default" do
        json = api.ai_experience_json(@ai_experience, @teacher, session)

        expect(json).to have_key("learning_objectives")
      end
    end

    it "includes submission_status with not_started value when provided" do
      json = api.ai_experience_json(@ai_experience, @teacher, session, { submission_status: "not_started" })
      expect(json).to have_key(:submission_status)
      expect(json[:submission_status]).to eq("not_started")
    end

    it "does not include submission_status when not provided in opts" do
      json = api.ai_experience_json(@ai_experience, @teacher, session)
      expect(json).not_to have_key(:submission_status)
    end

    it "includes can_unpublish when can_manage is true" do
      json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: true)
      expect(json).to have_key(:can_unpublish)
      expect(json[:can_unpublish]).to be_in([true, false])
    end

    it "does not include can_unpublish when can_manage is false" do
      json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: false)
      expect(json).not_to have_key(:can_unpublish)
    end

    context "context_ready" do
      it "includes context_ready when can_manage is true" do
        json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: true)
        expect(json).to have_key(:context_ready)
      end

      it "does not include context_ready when can_manage is false" do
        json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: false)
        expect(json).not_to have_key(:context_ready)
      end

      it "is true when no context files are attached" do
        json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: true)
        expect(json[:context_ready]).to be true
      end

      it "is true when context files are attached and indexing is completed" do
        attachment = attachment_model(context: @course)
        AiExperienceContextFile.create!(ai_experience: @ai_experience, attachment:)
        @ai_experience.update_column(:context_index_status, "completed")

        json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: true)
        expect(json[:context_ready]).to be true
      end

      it "is false when context files are attached and indexing is in_progress" do
        attachment = attachment_model(context: @course)
        AiExperienceContextFile.create!(ai_experience: @ai_experience, attachment:)
        @ai_experience.update_column(:context_index_status, "in_progress")

        json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: true)
        expect(json[:context_ready]).to be false
      end

      it "is false when context files are attached and indexing has failed" do
        attachment = attachment_model(context: @course)
        AiExperienceContextFile.create!(ai_experience: @ai_experience, attachment:)
        @ai_experience.update_column(:context_index_status, "failed")

        json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: true)
        expect(json[:context_ready]).to be false
      end
    end

    context "context_files" do
      it "includes context_files array with correct ContextFile shape" do
        attachment = attachment_model(context: @course, size: 1.megabyte, filename: "test.pdf")
        AiExperienceContextFile.create!(ai_experience: @ai_experience, attachment:)

        json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: true)

        expect(json).to have_key(:context_files)
        expect(json[:context_files]).to be_an(Array)
        expect(json[:context_files].length).to eq(1)

        file_json = json[:context_files].first
        expect(file_json[:id]).to eq(attachment.id.to_s)
        expect(file_json[:display_name]).to eq(attachment.display_name)
        expect(file_json).to have_key(:size)
        expect(file_json).to have_key(:content_type)
        expect(file_json).to have_key(:url)
        expect(file_json).not_to have_key(:filename)
        expect(file_json).not_to have_key(:position)
      end

      it "excludes context_files when can_manage is false" do
        attachment = attachment_model(context: @course, size: 1.megabyte, filename: "test.pdf")
        AiExperienceContextFile.create!(ai_experience: @ai_experience, attachment:)

        json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: false)

        expect(json).not_to have_key(:context_files)
      end

      it "excludes context_files by default when can_manage is not specified" do
        attachment = attachment_model(context: @course, size: 1.megabyte, filename: "test.pdf")
        AiExperienceContextFile.create!(ai_experience: @ai_experience, attachment:)

        json = api.ai_experience_json(@ai_experience, @teacher, session)

        expect(json).not_to have_key(:context_files)
      end

      it "excludes deleted attachments from context_files" do
        active = attachment_model(context: @course, size: 1.megabyte, filename: "active.pdf")
        deleted = attachment_model(context: @course, size: 1.megabyte, filename: "deleted.pdf")
        deleted.update_column(:file_state, "deleted")
        AiExperienceContextFile.create!(ai_experience: @ai_experience, attachment: active)
        AiExperienceContextFile.create!(ai_experience: @ai_experience, attachment: deleted)

        json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: true)

        expect(json[:context_files].length).to eq(1)
        expect(json[:context_files].first[:id]).to eq(active.id.to_s)
      end

      it "returns context_files ordered by position" do
        att1 = attachment_model(context: @course, size: 1.megabyte, filename: "first.pdf")
        att2 = attachment_model(context: @course, size: 1.megabyte, filename: "second.pdf")
        # Create in reverse order to ensure ordering is by position, not insertion
        cf2 = AiExperienceContextFile.create!(ai_experience: @ai_experience, attachment: att2)
        cf1 = AiExperienceContextFile.create!(ai_experience: @ai_experience, attachment: att1)
        cf1.update_column(:position, 1)
        cf2.update_column(:position, 2)

        json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: true)

        expect(json[:context_files].pluck(:id)).to eq([att1.id.to_s, att2.id.to_s])
      end
    end

    context "completed_count and total_students" do
      it "includes completed_count when can_manage and opt is provided" do
        json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: true, completed_count: 7)
        expect(json[:completed_count]).to eq(7)
      end

      it "includes total_students when can_manage and opt is provided" do
        json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: true, total_students: 20)
        expect(json[:total_students]).to eq(20)
      end

      it "excludes completed_count when opt is not provided" do
        json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: true)
        expect(json).not_to have_key(:completed_count)
      end

      it "excludes completed_count when can_manage is false" do
        json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: false, completed_count: 5)
        expect(json).not_to have_key(:completed_count)
      end

      it "excludes total_students when can_manage is false" do
        json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: false, total_students: 20)
        expect(json).not_to have_key(:total_students)
      end
    end

    describe "failed_context_file_names" do
      it "includes failed_context_file_names when can_manage and value is present" do
        json = api.ai_experience_json(@ai_experience,
                                      @teacher,
                                      session,
                                      can_manage: true,
                                      failed_context_file_names: ["poison.pdf"])
        expect(json["failed_context_file_names"]).to eq(["poison.pdf"])
      end

      it "omits failed_context_file_names when the value is empty" do
        json = api.ai_experience_json(@ai_experience,
                                      @teacher,
                                      session,
                                      can_manage: true,
                                      failed_context_file_names: [])
        expect(json).not_to have_key("failed_context_file_names")
      end

      it "omits failed_context_file_names when can_manage is false" do
        json = api.ai_experience_json(@ai_experience,
                                      @teacher,
                                      session,
                                      can_manage: false,
                                      failed_context_file_names: ["poison.pdf"])
        expect(json).not_to have_key("failed_context_file_names")
      end
    end
  end

  context "evaluation_metrics" do
    it "includes evaluation_metrics when can_manage is true" do
      AiExperienceEvaluationMetric.create!(
        ai_experience: @ai_experience,
        name: "Summary",
        description: "An overall summary of the learner's conversation.",
        enabled: true,
        visible_to_learners: false
      )

      json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: true)

      expect(json).to have_key(:evaluation_metrics)
      expect(json[:evaluation_metrics]).to eq([{ "name" => "Summary", "description" => "An overall summary of the learner's conversation.", "enabled" => true, "visible_to_learners" => false }])
    end

    it "excludes evaluation_metrics when can_manage is false" do
      AiExperienceEvaluationMetric.create!(
        ai_experience: @ai_experience,
        name: "Summary",
        description: "An overall summary of the learner's conversation.",
        enabled: true,
        visible_to_learners: false
      )

      json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: false)

      expect(json).not_to have_key(:evaluation_metrics)
    end

    it "returns an empty array when no metrics exist" do
      json = api.ai_experience_json(@ai_experience, @teacher, session, can_manage: true)

      expect(json[:evaluation_metrics]).to eq([])
    end
  end

  describe "ai_experiences_json" do
    it "returns array of ai experience json objects" do
      experiences = [@ai_experience]
      json = api.ai_experiences_json(experiences, @teacher, session)

      expect(json).to be_an(Array)
      expect(json.length).to eq 1
      expect(json.first["id"]).to eq @ai_experience.id
    end
  end
end
