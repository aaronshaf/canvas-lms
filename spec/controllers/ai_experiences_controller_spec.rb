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

require_relative "../support/request_helper"

describe AiExperiencesController, type: :request do
  before :once do
    course_with_teacher(active_all: true)
    student_in_course(active_all: true)
    @course.root_account.enable_feature!(:ai_experiences)
    @ai_experience = @course.ai_experiences.create!(
      title: "Customer Service Training",
      description: "Practice customer service scenarios",
      facts: "You are a customer service representative helping customers with billing issues.",
      learning_objective: "Students will learn to handle customer complaints professionally",
      pedagogical_guidance: "A customer calls about incorrect billing"
    )
  end

  describe "GET #index" do
    context "as teacher" do
      before { user_session(@teacher) }

      it "returns http success" do
        get "/courses/#{@course.id}/ai_experiences.json"
        expect(response).to be_successful
      end

      it "returns all experiences for teachers" do
        published_experience = @course.ai_experiences.create!(
          title: "Published Experience",
          facts: "Test prompt",
          learning_objective: "Test objective",
          pedagogical_guidance: "Test pedagogical guidance",
          workflow_state: "published"
        )

        get "/courses/#{@course.id}/ai_experiences.json"
        json_response = json_parse(response.body)
        experiences = json_response["experiences"]
        expect(experiences.length).to eq 2
        experience_ids = experiences.pluck("id")
        expect(experience_ids).to include(@ai_experience.id)
        expect(experience_ids).to include(published_experience.id)
      end

      it "filters by workflow_state" do
        published_experience = @course.ai_experiences.create!(
          title: "Published Experience",
          facts: "Test prompt",
          learning_objective: "Test objective",
          pedagogical_guidance: "Test pedagogical guidance",
          workflow_state: "published"
        )

        get "/courses/#{@course.id}/ai_experiences.json", params: { workflow_state: "published" }
        json_response = json_parse(response.body)
        experiences = json_response["experiences"]
        expect(experiences.length).to eq 1
        expect(experiences.first["id"]).to eq published_experience.id
      end

      it "sets COURSE_ID in js_env for HTML format" do
        get "/courses/#{@course.id}/ai_experiences"
        expect(js_env_from_response(response)["COURSE_ID"].to_i).to eq(@course.id)
        parsed_html_body = Nokogiri.parse(response.body)
        expect(parsed_html_body.css("title").first.inner_html).to eq("AI Experiences")
      end

      it "sets the active tab" do
        get "/courses/#{@course.id}/ai_experiences"
        parsed_html_body = Nokogiri.parse(response.body)
        expect(parsed_html_body.css("body").first.classes).to include("ai_experiences")
      end

      it "returns can_manage true for teachers" do
        get "/courses/#{@course.id}/ai_experiences.json"
        json_response = json_parse(response.body)
        expect(json_response["can_manage"]).to be true
      end

      it "does not include submission_status for teachers" do
        get "/courses/#{@course.id}/ai_experiences.json"
        json_response = json_parse(response.body)
        experiences = json_response["experiences"]

        experiences.each do |exp|
          expect(exp).not_to have_key("submission_status")
        end
      end

      it "includes facts and pedagogical_guidance for teachers" do
        published_experience = @course.ai_experiences.create!(
          title: "Published Experience",
          facts: "Teacher facts",
          learning_objective: "Test objective",
          pedagogical_guidance: "Teacher guidance",
          workflow_state: "published"
        )

        get "/courses/#{@course.id}/ai_experiences.json"
        json_response = json_parse(response.body)
        experiences = json_response["experiences"]

        published_exp = experiences.find { |e| e["id"] == published_experience.id }
        expect(published_exp["facts"]).to eq("Teacher facts")
        expect(published_exp["pedagogical_guidance"]).to eq("Teacher guidance")
        expect(published_exp["learning_objective"]).to eq("Test objective")
      end

      context "completion counts" do
        it "includes completed_count and total_students in each experience" do
          @ai_experience.update_column(:workflow_state, "published")
          @ai_experience.ai_conversations.create!(
            llm_conversation_id: SecureRandom.uuid,
            user: @student,
            course: @course,
            root_account: @course.root_account,
            account: @course.root_account,
            workflow_state: "active",
            all_objectives_met: true
          )

          get "/courses/#{@course.id}/ai_experiences.json"
          json_response = json_parse(response.body)
          exp = json_response["experiences"].find { |e| e["id"] == @ai_experience.id }

          expect(exp["completed_count"]).to eq(1)
          expect(json_response["total_students"]).to eq(1)
        end

        it "returns 0 completed_count when no students have completed" do
          @ai_experience.update_column(:workflow_state, "published")

          get "/courses/#{@course.id}/ai_experiences.json"
          json_response = json_parse(response.body)
          exp = json_response["experiences"].find { |e| e["id"] == @ai_experience.id }

          expect(exp["completed_count"]).to eq(0)
        end
      end

      context "pagination" do
        it "includes total_pages and current_page in the response" do
          get "/courses/#{@course.id}/ai_experiences.json"
          json_response = json_parse(response.body)

          expect(json_response).to have_key("total_pages")
          expect(json_response).to have_key("current_page")
          expect(json_response["current_page"]).to eq(1)
        end

        it "paginates results with per_page param" do
          16.times do |i|
            @course.ai_experiences.create!(
              title: "Experience #{i}",
              facts: "Facts",
              learning_objective: "Objective",
              pedagogical_guidance: "Guidance"
            )
          end

          get "/courses/#{@course.id}/ai_experiences.json", params: { per_page: 15 }
          json_response = json_parse(response.body)

          expect(json_response["experiences"].length).to eq(15)
          expect(json_response["total_pages"]).to be >= 2
        end

        it "returns page 2 when requested" do
          16.times do |i|
            @course.ai_experiences.create!(
              title: "Experience #{i}",
              facts: "Facts",
              learning_objective: "Objective",
              pedagogical_guidance: "Guidance"
            )
          end

          get "/courses/#{@course.id}/ai_experiences.json", params: { page: 2, per_page: 15 }
          json_response = json_parse(response.body)

          expect(json_response["current_page"]).to eq(2)
          expect(json_response["experiences"].length).to be >= 1
        end
      end

      context "when experiences have in_progress index status" do
        before do
          @ai_experience.update_columns(
            llm_conversation_context_id: "context-uuid",
            context_index_status: "in_progress"
          )
        end

        it "syncs index status for in_progress experiences" do
          service_double = instance_double(AiExperiences::ConversationContextDocumentsService)
          allow(AiExperiences::ConversationContextDocumentsService).to receive(:new).and_return(service_double)
          expect(service_double).to receive(:sync_index_status).with(ai_experience: @ai_experience)
          get "/courses/#{@course.id}/ai_experiences.json"
        end
      end

      context "when experiences have completed status" do
        before do
          @ai_experience.update_columns(
            llm_conversation_context_id: "context-uuid",
            context_index_status: "completed"
          )
        end

        it "does not sync index status for completed experiences" do
          expect_any_instance_of(AiExperiences::ConversationContextDocumentsService).not_to receive(:sync_index_status)
          get "/courses/#{@course.id}/ai_experiences.json"
        end
      end

      context "when experiences have failed status" do
        before do
          @ai_experience.update_columns(
            llm_conversation_context_id: "context-uuid",
            context_index_status: "failed"
          )
        end

        it "does not sync index status for failed experiences" do
          expect_any_instance_of(AiExperiences::ConversationContextDocumentsService).not_to receive(:sync_index_status)
          get "/courses/#{@course.id}/ai_experiences.json"
        end
      end

      context "when experiences have not_started status" do
        before do
          @ai_experience.update_columns(
            llm_conversation_context_id: "context-uuid",
            context_index_status: "not_started"
          )
        end

        it "does not sync index status for not_started experiences" do
          expect_any_instance_of(AiExperiences::ConversationContextDocumentsService).not_to receive(:sync_index_status)
          get "/courses/#{@course.id}/ai_experiences.json"
        end
      end

      context "when context_id is not present" do
        before do
          @ai_experience.update_columns(
            llm_conversation_context_id: nil,
            context_index_status: "in_progress"
          )
        end

        it "does not sync index status" do
          expect_any_instance_of(AiExperiences::ConversationContextDocumentsService).not_to receive(:sync_index_status)
          get "/courses/#{@course.id}/ai_experiences.json"
        end
      end
    end

    context "as student" do
      before { user_session(@student) }

      it "returns http success" do
        get "/courses/#{@course.id}/ai_experiences.json"
        expect(response).to be_successful
      end

      it "returns only published experiences for students" do
        unpublished_experience = @course.ai_experiences.create!(
          title: "Unpublished Experience",
          facts: "Test prompt",
          learning_objective: "Test objective",
          pedagogical_guidance: "Test pedagogical guidance",
          workflow_state: "unpublished"
        )
        published_experience = @course.ai_experiences.create!(
          title: "Published Experience",
          facts: "Test prompt",
          learning_objective: "Test objective",
          pedagogical_guidance: "Test pedagogical guidance",
          workflow_state: "published"
        )

        get "/courses/#{@course.id}/ai_experiences.json"
        json_response = json_parse(response.body)
        experiences = json_response["experiences"]
        experience_ids = experiences.pluck("id")
        expect(experience_ids).to include(published_experience.id)
        expect(experience_ids).not_to include(unpublished_experience.id)
      end

      it "returns can_manage false for students" do
        get "/courses/#{@course.id}/ai_experiences.json"
        json_response = json_parse(response.body)
        expect(json_response["can_manage"]).to be false
      end

      it "does not include facts and pedagogical_guidance for students" do
        published_experience = @course.ai_experiences.create!(
          title: "Published Experience",
          facts: "Secret teacher facts",
          learning_objective: "Student objective",
          pedagogical_guidance: "Secret teacher guidance",
          workflow_state: "published"
        )

        get "/courses/#{@course.id}/ai_experiences.json"
        json_response = json_parse(response.body)
        experiences = json_response["experiences"]

        published_exp = experiences.find { |e| e["id"] == published_experience.id }
        expect(published_exp).not_to have_key("facts")
        expect(published_exp).not_to have_key("pedagogical_guidance")
      end

      it "includes learning_objective for students" do
        published_experience = @course.ai_experiences.create!(
          title: "Published Experience",
          facts: "Secret teacher facts",
          learning_objective: "Student can see this",
          pedagogical_guidance: "Secret teacher guidance",
          workflow_state: "published"
        )

        get "/courses/#{@course.id}/ai_experiences.json"
        json_response = json_parse(response.body)
        experiences = json_response["experiences"]

        published_exp = experiences.find { |e| e["id"] == published_experience.id }
        expect(published_exp["learning_objective"]).to eq("Student can see this")
      end

      context "with submission status" do
        it "includes submission_status as not_started when no conversation exists" do
          published_experience = @course.ai_experiences.create!(
            title: "Published Experience",
            facts: "Test prompt",
            learning_objective: "Test objective",
            pedagogical_guidance: "Test guidance",
            workflow_state: "published"
          )

          get "/courses/#{@course.id}/ai_experiences.json"
          json_response = json_parse(response.body)
          experiences = json_response["experiences"]

          experience = experiences.find { |e| e["id"] == published_experience.id }
          expect(experience["submission_status"]).to eq("not_started")
        end

        it "includes submission_status as in_progress when active conversation exists" do
          published_experience = @course.ai_experiences.create!(
            title: "Published Experience",
            facts: "Test prompt",
            learning_objective: "Test objective",
            pedagogical_guidance: "Test guidance",
            workflow_state: "published"
          )

          # Create an active conversation for the student
          published_experience.ai_conversations.create!(
            llm_conversation_id: "test-conversation-id",
            user: @student,
            course: @course,
            root_account: @course.root_account,
            account: @course.account,
            workflow_state: "active"
          )

          get "/courses/#{@course.id}/ai_experiences.json"
          json_response = json_parse(response.body)
          experiences = json_response["experiences"]

          experience = experiences.find { |e| e["id"] == published_experience.id }
          expect(experience["submission_status"]).to eq("in_progress")
        end

        it "includes submission_status as completed when all_objectives_met is true" do
          published_experience = @course.ai_experiences.create!(
            title: "Published Experience",
            facts: "Test prompt",
            learning_objective: "Test objective",
            pedagogical_guidance: "Test guidance",
            workflow_state: "published"
          )

          published_experience.ai_conversations.create!(
            llm_conversation_id: "test-conversation-id",
            user: @student,
            course: @course,
            root_account: @course.root_account,
            account: @course.account,
            workflow_state: "active",
            all_objectives_met: true
          )

          get "/courses/#{@course.id}/ai_experiences.json"
          json_response = json_parse(response.body)
          experiences = json_response["experiences"]

          experience = experiences.find { |e| e["id"] == published_experience.id }
          expect(experience["submission_status"]).to eq("completed")
        end

        it "includes submission_status as completed when conversation is ended and all_objectives_met is true" do
          published_experience = @course.ai_experiences.create!(
            title: "Published Experience",
            facts: "Test prompt",
            learning_objective: "Test objective",
            pedagogical_guidance: "Test guidance",
            workflow_state: "published"
          )

          published_experience.ai_conversations.create!(
            llm_conversation_id: "test-conversation-id",
            user: @student,
            course: @course,
            root_account: @course.root_account,
            account: @course.account,
            workflow_state: "ended",
            all_objectives_met: true
          )

          get "/courses/#{@course.id}/ai_experiences.json"
          json_response = json_parse(response.body)
          experiences = json_response["experiences"]

          experience = experiences.find { |e| e["id"] == published_experience.id }
          expect(experience["submission_status"]).to eq("completed")
        end

        it "includes submission_status as not_started when conversation is ended without objectives met" do
          published_experience = @course.ai_experiences.create!(
            title: "Published Experience",
            facts: "Test prompt",
            learning_objective: "Test objective",
            pedagogical_guidance: "Test guidance",
            workflow_state: "published"
          )

          published_experience.ai_conversations.create!(
            llm_conversation_id: "test-conversation-id",
            user: @student,
            course: @course,
            root_account: @course.root_account,
            account: @course.account,
            workflow_state: "ended"
          )

          get "/courses/#{@course.id}/ai_experiences.json"
          json_response = json_parse(response.body)
          experiences = json_response["experiences"]

          experience = experiences.find { |e| e["id"] == published_experience.id }
          expect(experience["submission_status"]).to eq("not_started")
        end

        it "uses the latest conversation when multiple exist" do
          published_experience = @course.ai_experiences.create!(
            title: "Published Experience",
            facts: "Test prompt",
            learning_objective: "Test objective",
            pedagogical_guidance: "Test guidance",
            workflow_state: "published"
          )

          # Create an older ended conversation
          published_experience.ai_conversations.create!(
            llm_conversation_id: "old-conversation-id",
            user: @student,
            course: @course,
            root_account: @course.root_account,
            account: @course.account,
            workflow_state: "ended",
            created_at: 2.days.ago,
            updated_at: 2.days.ago
          )

          # Create a newer active conversation
          published_experience.ai_conversations.create!(
            llm_conversation_id: "new-conversation-id",
            user: @student,
            course: @course,
            root_account: @course.root_account,
            account: @course.account,
            workflow_state: "active",
            created_at: 1.day.ago,
            updated_at: 1.day.ago
          )

          get "/courses/#{@course.id}/ai_experiences.json"
          json_response = json_parse(response.body)
          experiences = json_response["experiences"]

          experience = experiences.find { |e| e["id"] == published_experience.id }
          # Should use the newer active conversation
          expect(experience["submission_status"]).to eq("in_progress")
        end

        it "ignores deleted conversations" do
          published_experience = @course.ai_experiences.create!(
            title: "Published Experience",
            facts: "Test prompt",
            learning_objective: "Test objective",
            pedagogical_guidance: "Test guidance",
            workflow_state: "published"
          )

          # Create a deleted conversation
          published_experience.ai_conversations.create!(
            llm_conversation_id: "deleted-conversation-id",
            user: @student,
            course: @course,
            root_account: @course.root_account,
            account: @course.account,
            workflow_state: "deleted"
          )

          get "/courses/#{@course.id}/ai_experiences.json"
          json_response = json_parse(response.body)
          experiences = json_response["experiences"]

          experience = experiences.find { |e| e["id"] == published_experience.id }
          # Should show not_started since deleted conversations are ignored
          expect(experience["submission_status"]).to eq("not_started")
        end
      end
    end

    context "as teacher from different course" do
      before do
        @original_course = @course
        @original_teacher = @teacher
        course_with_teacher(active_all: true, user: user_factory, course_name: "Other Course")
        @other_teacher = @teacher
        @other_course = @course
        @course = @original_course
        @teacher = @original_teacher
        user_session(@other_teacher)
      end

      it "returns forbidden for teachers not enrolled in this course" do
        get "/courses/#{@course.id}/ai_experiences.json"
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "as unenrolled user" do
      before :once do
        @unenrolled_user = user_factory(active_all: true)
      end

      before { user_session(@unenrolled_user) }

      it "returns forbidden for unenrolled users" do
        get "/courses/#{@course.id}/ai_experiences.json"
        expect(response).to have_http_status(:forbidden)
      end

      it "renders unauthorized page for HTML requests" do
        get "/courses/#{@course.id}/ai_experiences"
        expect(response).to have_http_status(:unauthorized)
        expect(response.body).to include('id="unauthorized_message"')
      end
    end
  end

  describe "GET #show" do
    context "as teacher" do
      before { user_session(@teacher) }

      it "returns success for HTML format" do
        get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}"
        expect(response).to be_successful
      end

      it "returns JSON for JSON format" do
        get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json"
        expect(response).to be_successful
        experience = json_parse(response.body)
        expect(experience["id"]).to eq(@ai_experience.id)
        expect(experience["title"]).to eq(@ai_experience.title)
      end

      it "returns can_manage true in JSON response" do
        get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json"
        json_response = json_parse(response.body)
        expect(json_response["can_manage"]).to be true
      end

      it "sets the active tab and page title" do
        get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}"
        parsed_html_body = Nokogiri.parse(response.body)
        expect(parsed_html_body.css("body").first.classes).to include("ai_experiences")
        expect(parsed_html_body.css("title").first.inner_html).to eq(@ai_experience.title)
      end

      it "sets AI_EXPERIENCES_MESSAGE_MAX_LENGTH in js_env" do
        get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}"
        expect(js_env_from_response(response)["AI_EXPERIENCES_MESSAGE_MAX_LENGTH"]).to eq(AiConversation::USER_MESSAGE_MAX_LENGTH)
      end

      it "includes facts and pedagogical_guidance in JSON response for teachers" do
        get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json"
        json_response = json_parse(response.body)
        expect(json_response["facts"]).to eq(@ai_experience.facts)
        expect(json_response["pedagogical_guidance"]).to eq(@ai_experience.pedagogical_guidance)
        expect(json_response["learning_objective"]).to eq(@ai_experience.learning_objective)
      end

      context "when context_id is present" do
        before do
          @ai_experience.update_column(:llm_conversation_context_id, "context-uuid")
        end

        it "calls sync_index_status before rendering" do
          service_double = instance_double(AiExperiences::ConversationContextDocumentsService)
          allow(AiExperiences::ConversationContextDocumentsService).to receive(:new).and_return(service_double)
          expect(service_double).to receive(:sync_index_status).with(ai_experience: @ai_experience)
          get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json"
        end
      end

      context "when context_id is not present" do
        before do
          @ai_experience.update_column(:llm_conversation_context_id, nil)
        end

        it "does not call sync_index_status" do
          expect_any_instance_of(AiExperiences::ConversationContextDocumentsService).not_to receive(:sync_index_status)
          get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json"
        end
      end
    end

    context "as student" do
      before { user_session(@student) }

      it "returns success for published experiences" do
        @ai_experience.update!(workflow_state: "published")
        get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json"
        expect(response).to be_successful
      end

      it "returns can_manage false in JSON response" do
        @ai_experience.update!(workflow_state: "published")
        get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json"
        json_response = json_parse(response.body)
        expect(json_response["can_manage"]).to be false
      end

      it "does not include facts and pedagogical_guidance in JSON response for students" do
        @ai_experience.update!(workflow_state: "published")
        get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json"
        json_response = json_parse(response.body)
        expect(json_response).not_to have_key("facts")
        expect(json_response).not_to have_key("pedagogical_guidance")
      end

      it "includes learning_objective in JSON response for students" do
        @ai_experience.update!(workflow_state: "published")
        get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json"
        json_response = json_parse(response.body)
        expect(json_response["learning_objective"]).to eq(@ai_experience.learning_objective)
      end

      it "returns forbidden for unpublished experiences" do
        @ai_experience.update!(workflow_state: "unpublished")
        get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json"
        expect(response).to have_http_status(:forbidden)
      end

      it "renders unauthorized page for unpublished experiences in HTML format" do
        @ai_experience.update!(workflow_state: "unpublished")
        get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}"
        expect(response).to have_http_status(:unauthorized)
        expect(response.body).to include('id="unauthorized_message"')
      end
    end

    context "as teacher from different course" do
      before do
        @original_course = @course
        @original_teacher = @teacher
        course_with_teacher(active_all: true, user: user_factory, course_name: "Other Course")
        @other_teacher = @teacher
        @other_course = @course
        @course = @original_course
        @teacher = @original_teacher
        user_session(@other_teacher)
      end

      it "returns forbidden for teachers not enrolled in this course" do
        @ai_experience.update!(workflow_state: "published")
        get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json"
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "as unenrolled user" do
      before :once do
        @unenrolled_user = user_factory(active_all: true)
      end

      before { user_session(@unenrolled_user) }

      it "returns forbidden for published experiences when unenrolled" do
        @ai_experience.update!(workflow_state: "published")
        get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json"
        expect(response).to have_http_status(:forbidden)
      end

      it "returns forbidden for unpublished experiences when unenrolled" do
        @ai_experience.update!(workflow_state: "unpublished")
        get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json"
        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  describe "POST #create" do
    context "as teacher from different course" do
      before do
        @original_course = @course
        @original_teacher = @teacher
        course_with_teacher(active_all: true, user: user_factory, course_name: "Other Course")
        @other_teacher = @teacher
        @other_course = @course
        @course = @original_course
        @teacher = @original_teacher
        user_session(@other_teacher)
      end

      it "returns forbidden for teachers not enrolled in this course" do
        post "/courses/#{@course.id}/ai_experiences.json",
             params: {
               ai_experience: {
                 title: "New Experience",
                 learning_objective: "Test objective",
                 pedagogical_guidance: "Test guidance"
               }
             }

        expect(response).to have_http_status(:forbidden)
      end
    end

    context "as teacher" do
      before { user_session(@teacher) }

      it "creates a new AI experience with valid params" do
        experience_params = {
          title: "New Experience",
          description: "A test experience",
          facts: "Test prompt",
          learning_objective: "Test objective",
          pedagogical_guidance: "Test pedagogical guidance"
        }

        initial_count = AiExperience.count
        post "/courses/#{@course.id}/ai_experiences.json", params: { ai_experience: experience_params }
        expect(AiExperience.count).to eq(initial_count + 1)

        expect(response).to have_http_status(:created)

        created_experience = AiExperience.last
        expect(created_experience.title).to eq("New Experience")
        expect(created_experience.description).to eq("A test experience")
        expect(created_experience.facts).to eq("Test prompt")
        expect(created_experience.learning_objective).to eq("Test objective")
        expect(created_experience.pedagogical_guidance).to eq("Test pedagogical guidance")
      end

      it "returns bad request with invalid params" do
        invalid_params = {
          title: "", # title is required
          learning_objective: "", # learning_objective is required
          pedagogical_guidance: "" # pedagogical_guidance is required
        }

        initial_count = AiExperience.count
        post "/courses/#{@course.id}/ai_experiences.json", params: { ai_experience: invalid_params }
        expect(AiExperience.count).to eq(initial_count)

        expect(response).to have_http_status(:bad_request)
      end

      it "creates a new AI experience without facts (facts is optional)" do
        experience_params = {
          title: "New Experience Without Facts",
          learning_objective: "Test objective",
          pedagogical_guidance: "Test pedagogical guidance"
        }

        initial_count = AiExperience.count
        post "/courses/#{@course.id}/ai_experiences.json", params: { ai_experience: experience_params }
        expect(AiExperience.count).to eq(initial_count + 1)

        expect(response).to have_http_status(:created)

        created_experience = AiExperience.last
        expect(created_experience.title).to eq("New Experience Without Facts")
        expect(created_experience.facts).to be_nil
        expect(created_experience.learning_objective).to eq("Test objective")
        expect(created_experience.pedagogical_guidance).to eq("Test pedagogical guidance")
      end

      it "sets the correct associations for course, account, and root_account" do
        experience_params = {
          title: "New Experience",
          learning_objective: "Test objective",
          pedagogical_guidance: "Test pedagogical guidance"
        }

        post "/courses/#{@course.id}/ai_experiences.json", params: { ai_experience: experience_params }

        created_experience = AiExperience.last
        expect(created_experience.course).to eq(@course)
        expect(created_experience.root_account).to eq(@course.root_account)
        expect(created_experience.account).to eq(@course.account)
      end

      it "accepts context_file_ids parameter" do
        attachment = attachment_model(context: @course, size: 1.megabyte)
        experience_params = {
          title: "New Experience with Files",
          learning_objective: "Test objective",
          pedagogical_guidance: "Test pedagogical guidance",
          context_file_ids: [attachment.id]
        }

        post "/courses/#{@course.id}/ai_experiences.json", params: { ai_experience: experience_params }
        expect(response).to have_http_status(:created)

        created_experience = AiExperience.last
        expect(created_experience.context_files).to include(attachment)
      end

      it "rejects context_file_ids referencing attachments from another course" do
        other_course = Course.create!(name: "Other Course", account: Account.default)
        other_course_attachment = attachment_model(context: other_course, size: 1.megabyte)
        experience_params = {
          title: "Cross-tenant attempt",
          learning_objective: "Test objective",
          pedagogical_guidance: "Test pedagogical guidance",
          context_file_ids: [other_course_attachment.id]
        }

        expect do
          post "/courses/#{@course.id}/ai_experiences.json", params: { ai_experience: experience_params }
        end.not_to change(AiExperience, :count)

        expect(response).to have_http_status(:unprocessable_content)
        expect(json_parse(response.body)["errors"]).to have_key("context_file_ids")
      end

      it "rejects context_file_ids referencing soft-deleted attachments" do
        attachment = attachment_model(context: @course, size: 1.megabyte)
        attachment.destroy # soft delete (file_state = 'deleted')
        experience_params = {
          title: "Deleted attachment attempt",
          learning_objective: "Test objective",
          pedagogical_guidance: "Test pedagogical guidance",
          context_file_ids: [attachment.id]
        }

        expect do
          post "/courses/#{@course.id}/ai_experiences.json", params: { ai_experience: experience_params }
        end.not_to change(AiExperience, :count)

        expect(response).to have_http_status(:unprocessable_content)
      end

      it "rejects when any submitted id is unauthorized, even if others are valid" do
        good_attachment = attachment_model(context: @course, size: 1.megabyte)
        other_course = Course.create!(name: "Other Course", account: Account.default)
        bad_attachment = attachment_model(context: other_course, size: 1.megabyte)
        experience_params = {
          title: "Mixed",
          learning_objective: "Test objective",
          pedagogical_guidance: "Test pedagogical guidance",
          context_file_ids: [good_attachment.id, bad_attachment.id]
        }

        expect do
          post "/courses/#{@course.id}/ai_experiences.json", params: { ai_experience: experience_params }
        end.not_to change(AiExperience, :count)

        expect(response).to have_http_status(:unprocessable_content)
        expect(json_parse(response.body)["errors"]).to have_key("context_file_ids")
      end

      # Personal (User-context) files are rejected even when the current user
      # owns them: AI Experiences belong to the course, so source materials
      # must be discoverable/auditable under /courses/:id/files.
      it "rejects context_file_ids referencing the current user's personal files" do
        personal_attachment = attachment_model(context: @teacher, size: 1.megabyte)
        experience_params = {
          title: "Personal file attempt",
          learning_objective: "Test objective",
          pedagogical_guidance: "Test pedagogical guidance",
          context_file_ids: [personal_attachment.id]
        }

        expect do
          post "/courses/#{@course.id}/ai_experiences.json", params: { ai_experience: experience_params }
        end.not_to change(AiExperience, :count)

        expect(response).to have_http_status(:unprocessable_content)
        expect(json_parse(response.body)["errors"]).to have_key("context_file_ids")
      end
    end

    context "metrics" do
      before { user_session(@teacher) }

      let(:expected_tags) do
        { aws_region: Canvas.region, root_account_id: @course.root_account.uuid, course_id: @course.id }
      end

      it "increments total_created on success" do
        expect(InstStatsd::Statsd).to receive(:increment).with("ai_experiences.total_created", tags: expected_tags)
        allow(InstStatsd::Statsd).to receive(:increment)
        post "/courses/#{@course.id}/ai_experiences.json",
             params: { ai_experience: { title: "New", learning_objective: "obj", pedagogical_guidance: "guidance" } }
      end

      it "increments total_published when created as published" do
        expect(InstStatsd::Statsd).to receive(:increment).with("ai_experiences.total_published", tags: expected_tags)
        allow(InstStatsd::Statsd).to receive(:increment)
        post "/courses/#{@course.id}/ai_experiences.json",
             params: { ai_experience: { title: "New", learning_objective: "obj", pedagogical_guidance: "guidance", workflow_state: "published" } }
      end

      it "does not increment total_published when created as unpublished" do
        expect(InstStatsd::Statsd).not_to receive(:increment).with("ai_experiences.total_published", anything)
        allow(InstStatsd::Statsd).to receive(:increment)
        post "/courses/#{@course.id}/ai_experiences.json",
             params: { ai_experience: { title: "New", learning_objective: "obj", pedagogical_guidance: "guidance" } }
      end

      it "increments total_with_source_files when created with files" do
        attachment = attachment_model(context: @course, size: 1.megabyte)
        expect(InstStatsd::Statsd).to receive(:increment).with("ai_experiences.total_with_source_files", tags: expected_tags)
        allow(InstStatsd::Statsd).to receive(:increment)
        post "/courses/#{@course.id}/ai_experiences.json",
             params: { ai_experience: { title: "New", learning_objective: "obj", pedagogical_guidance: "guidance", context_file_ids: [attachment.id] } }
      end

      it "does not increment total_with_source_files when created without files" do
        expect(InstStatsd::Statsd).not_to receive(:increment).with("ai_experiences.total_with_source_files", anything)
        allow(InstStatsd::Statsd).to receive(:increment)
        post "/courses/#{@course.id}/ai_experiences.json",
             params: { ai_experience: { title: "New", learning_objective: "obj", pedagogical_guidance: "guidance" } }
      end

      it "does not emit metrics on failure" do
        expect(InstStatsd::Statsd).not_to receive(:increment)
        post "/courses/#{@course.id}/ai_experiences.json",
             params: { ai_experience: { title: "" } }
      end

      it "does not emit metrics when context is not a Course" do
        expect(InstStatsd::Statsd).not_to receive(:increment)
        allow_any_instance_of(Api).to receive(:api_find).and_return(Account.default)
        post "/courses/#{@course.id}/ai_experiences.json",
             params: { ai_experience: { title: "New", learning_objective: "obj", pedagogical_guidance: "guidance" } }
      end
    end

    context "as student" do
      before { user_session(@student) }

      it "returns forbidden" do
        experience_params = {
          title: "New Experience",
          learning_objective: "Test objective",
          pedagogical_guidance: "Test pedagogical guidance"
        }

        post "/courses/#{@course.id}/ai_experiences.json", params: { ai_experience: experience_params }
        assert_forbidden
      end
    end
  end

  describe "PUT #update" do
    context "as teacher from different course" do
      before do
        @original_course = @course
        @original_teacher = @teacher
        course_with_teacher(active_all: true, user: user_factory, course_name: "Other Course")
        @other_teacher = @teacher
        @other_course = @course
        @course = @original_course
        @teacher = @original_teacher
        user_session(@other_teacher)
      end

      it "returns forbidden for teachers not enrolled in this course" do
        put "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json",
            params: { ai_experience: { title: "Updated Title" } }

        expect(response).to have_http_status(:forbidden)
      end
    end

    context "as teacher" do
      before { user_session(@teacher) }

      it "updates an AI experience with valid params" do
        update_params = {
          title: "Updated Experience",
          description: "Updated description",
          facts: "Updated prompt",
          learning_objective: "Updated objective",
          pedagogical_guidance: "Updated pedagogical guidance"
        }

        put "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json", params: { ai_experience: update_params }

        expect(response).to have_http_status(:ok)

        @ai_experience.reload
        expect(@ai_experience.title).to eq("Updated Experience")
        expect(@ai_experience.description).to eq("Updated description")
        expect(@ai_experience.facts).to eq("Updated prompt")
        expect(@ai_experience.learning_objective).to eq("Updated objective")
        expect(@ai_experience.pedagogical_guidance).to eq("Updated pedagogical guidance")
      end

      it "returns bad request with invalid params" do
        invalid_params = {
          title: "", # title is required
          learning_objective: "", # learning_objective is required
          pedagogical_guidance: "" # pedagogical_guidance is required
        }

        put "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json", params: { ai_experience: invalid_params }

        expect(response).to have_http_status(:bad_request)

        @ai_experience.reload
        expect(@ai_experience.title).to eq("Customer Service Training") # unchanged
      end

      it "accepts context_file_ids parameter" do
        attachment = attachment_model(context: @course, size: 1.megabyte)
        update_params = {
          title: "Updated Experience",
          context_file_ids: [attachment.id]
        }

        put "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json", params: { ai_experience: update_params }
        expect(response).to have_http_status(:ok)

        @ai_experience.reload
        expect(@ai_experience.context_files).to include(attachment)
      end

      it "rejects context_file_ids referencing attachments from another course" do
        other_course = Course.create!(name: "Other Course", account: Account.default)
        other_course_attachment = attachment_model(context: other_course, size: 1.megabyte)
        update_params = {
          title: "Cross-tenant attempt",
          context_file_ids: [other_course_attachment.id]
        }

        put "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json", params: { ai_experience: update_params }

        expect(response).to have_http_status(:unprocessable_content)
        expect(json_parse(response.body)["errors"]).to have_key("context_file_ids")
        @ai_experience.reload
        expect(@ai_experience.title).to eq("Customer Service Training") # unchanged
        expect(@ai_experience.context_files).to be_empty
      end

      it "rejects update when any submitted id is unauthorized, even if others are valid" do
        good_attachment = attachment_model(context: @course, size: 1.megabyte)
        other_course = Course.create!(name: "Other Course", account: Account.default)
        bad_attachment = attachment_model(context: other_course, size: 1.megabyte)
        update_params = {
          title: "Mixed update",
          context_file_ids: [good_attachment.id, bad_attachment.id]
        }

        put "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json", params: { ai_experience: update_params }

        expect(response).to have_http_status(:unprocessable_content)
        expect(json_parse(response.body)["errors"]).to have_key("context_file_ids")
        @ai_experience.reload
        expect(@ai_experience.title).to eq("Customer Service Training")
        expect(@ai_experience.context_files).to be_empty
      end

      it "rejects update with context_file_ids referencing the current user's personal files" do
        personal_attachment = attachment_model(context: @teacher, size: 1.megabyte)
        update_params = {
          title: "Personal file attempt",
          context_file_ids: [personal_attachment.id]
        }

        put "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json", params: { ai_experience: update_params }

        expect(response).to have_http_status(:unprocessable_content)
        expect(json_parse(response.body)["errors"]).to have_key("context_file_ids")
        @ai_experience.reload
        expect(@ai_experience.title).to eq("Customer Service Training")
        expect(@ai_experience.context_files).to be_empty
      end
    end

    context "metrics" do
      before { user_session(@teacher) }

      let(:expected_tags) do
        { aws_region: Canvas.region, root_account_id: @course.root_account.uuid, course_id: @course.id }
      end

      it "increments total_published when transitioning to published" do
        expect(InstStatsd::Statsd).to receive(:increment).with("ai_experiences.total_published", tags: expected_tags)
        allow(InstStatsd::Statsd).to receive(:increment)
        put "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json",
            params: { ai_experience: { workflow_state: "published" } }
      end

      it "decrements total_published when transitioning away from published" do
        @ai_experience.update!(workflow_state: "published")
        expect(InstStatsd::Statsd).to receive(:decrement).with("ai_experiences.total_published", tags: expected_tags)
        allow(InstStatsd::Statsd).to receive(:decrement)
        put "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json",
            params: { ai_experience: { workflow_state: "unpublished" } }
      end

      it "does not emit publish metrics when workflow_state is unchanged" do
        expect(InstStatsd::Statsd).not_to receive(:increment).with("ai_experiences.total_published", anything)
        expect(InstStatsd::Statsd).not_to receive(:decrement).with("ai_experiences.total_published", anything)
        allow(InstStatsd::Statsd).to receive(:increment)
        allow(InstStatsd::Statsd).to receive(:decrement)
        put "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json",
            params: { ai_experience: { title: "New Title" } }
      end

      it "does not emit metrics on failure" do
        expect(InstStatsd::Statsd).not_to receive(:increment)
        expect(InstStatsd::Statsd).not_to receive(:decrement)
        put "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json",
            params: { ai_experience: { title: "" } }
      end
    end

    context "evaluation_metrics" do
      before { user_session(@teacher) }

      it "saves evaluation_metrics when submitted" do
        allow_any_instance_of(AiExperiences::ConversationContextService).to receive(:update)

        put "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json",
            params: {
              ai_experience: {
                evaluation_metrics: [
                  { name: "Summary", description: "An overall summary.", enabled: true, visible_to_learners: true },
                  { name: "Areas for improvement", description: "Guidance for improvement.", enabled: false, visible_to_learners: false }
                ]
              }
            }

        expect(response).to have_http_status(:ok)
        metrics = @ai_experience.reload.ai_experience_evaluation_metrics.order(:position)
        expect(metrics.map(&:name)).to eq(["Summary", "Areas for improvement"])
        expect(metrics.map(&:enabled)).to eq([true, false])
      end

      it "includes evaluation_metrics in the GET show response after saving" do
        allow_any_instance_of(AiExperiences::ConversationContextService).to receive(:update)

        put "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json",
            params: {
              ai_experience: {
                evaluation_metrics: [{ name: "Summary", description: "An overall summary.", enabled: true, visible_to_learners: false }]
              }
            }

        expect(response).to have_http_status(:ok)

        get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json"

        json_response = json_parse(response.body)
        expect(json_response).to have_key("evaluation_metrics")
        expect(json_response["evaluation_metrics"].first["name"]).to eq("Summary")
      end

      it "rejects metric names with newlines" do
        allow_any_instance_of(AiExperiences::ConversationContextService).to receive(:update)

        put "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json",
            params: {
              ai_experience: {
                evaluation_metrics: [{ name: "bad\ninjection", enabled: true, visible_to_learners: false }]
              }
            }

        expect(response).to have_http_status(:bad_request)
      end
    end

    context "as student" do
      before { user_session(@student) }

      it "returns forbidden" do
        update_params = {
          title: "Student Updated Experience"
        }

        put "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json", params: { ai_experience: update_params }
        assert_forbidden
      end
    end
  end

  describe "DELETE #destroy" do
    context "as teacher from different course" do
      before do
        @original_course = @course
        @original_teacher = @teacher
        course_with_teacher(active_all: true, user: user_factory, course_name: "Other Course")
        @other_teacher = @teacher
        @other_course = @course
        @course = @original_course
        @teacher = @original_teacher
        user_session(@other_teacher)
      end

      it "returns forbidden for teachers not enrolled in this course" do
        delete "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json"

        expect(response).to have_http_status(:forbidden)
      end
    end

    context "as teacher" do
      before { user_session(@teacher) }

      it "soft deletes an AI experience" do
        delete "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json"

        expect(response).to have_http_status(:ok)

        @ai_experience.reload
        expect(@ai_experience.workflow_state).to eq("deleted")
      end
    end

    context "metrics" do
      before { user_session(@teacher) }

      let(:expected_tags) do
        { aws_region: Canvas.region, root_account_id: @course.root_account.uuid, course_id: @course.id }
      end

      it "decrements total_created on success" do
        expect(InstStatsd::Statsd).to receive(:decrement).with("ai_experiences.total_created", tags: expected_tags)
        allow(InstStatsd::Statsd).to receive(:decrement)
        delete "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json"
      end

      it "decrements total_published when destroying a published experience" do
        @ai_experience.update!(workflow_state: "published")
        expect(InstStatsd::Statsd).to receive(:decrement).with("ai_experiences.total_published", tags: expected_tags)
        allow(InstStatsd::Statsd).to receive(:decrement)
        delete "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json"
      end

      it "does not decrement total_published when destroying an unpublished experience" do
        expect(InstStatsd::Statsd).not_to receive(:decrement).with("ai_experiences.total_published", anything)
        allow(InstStatsd::Statsd).to receive(:decrement)
        delete "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json"
      end

      it "decrements total_with_source_files when destroying an experience with files" do
        attachment = attachment_model(context: @course, size: 1.megabyte)
        @ai_experience.update!(context_file_ids: [attachment.id])
        expect(InstStatsd::Statsd).to receive(:decrement).with("ai_experiences.total_with_source_files", tags: expected_tags)
        allow(InstStatsd::Statsd).to receive(:decrement)
        delete "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json"
      end

      it "does not decrement total_with_source_files when destroying an experience without files" do
        expect(InstStatsd::Statsd).not_to receive(:decrement).with("ai_experiences.total_with_source_files", anything)
        allow(InstStatsd::Statsd).to receive(:decrement)
        delete "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json"
      end
    end

    context "as student" do
      before { user_session(@student) }

      it "returns forbidden" do
        delete "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json"
        assert_forbidden

        @ai_experience.reload
        expect(@ai_experience.workflow_state).not_to eq("deleted")
      end
    end
  end

  describe "GET #new" do
    context "as teacher" do
      before { user_session(@teacher) }

      it "sets COURSE_ID in js_env" do
        get "/courses/#{@course.id}/ai_experiences/new"
        expect(js_env_from_response(response)["COURSE_ID"].to_i).to eq(@course.id)
        parsed_html_body = Nokogiri.parse(response.body)
        expect(parsed_html_body.css("title").first.inner_html).to eq("New AI Experience")
      end

      it "sets the active tab" do
        get "/courses/#{@course.id}/ai_experiences/new"
        parsed_html_body = Nokogiri.parse(response.body)
        expect(parsed_html_body.css("body").first.classes).to include("ai_experiences")
      end

      it "sets CONTEXT_FILE_MAX_SIZE_MB in js_env" do
        get "/courses/#{@course.id}/ai_experiences/new"
        expect(js_env_from_response(response)["CONTEXT_FILE_MAX_SIZE_MB"]).to eq(AiExperienceContextFile::MAX_FILE_SIZE / 1.megabyte)
      end

      it "sets AI_EXPERIENCES_FIELD_MAX_LENGTH in js_env" do
        get "/courses/#{@course.id}/ai_experiences/new"
        expect(js_env_from_response(response)["AI_EXPERIENCES_FIELD_MAX_LENGTH"]).to eq(AiExperience::TEACHER_AUTHORED_FIELD_MAX)
      end
    end

    context "as student" do
      before { user_session(@student) }

      it "returns unauthorized" do
        get "/courses/#{@course.id}/ai_experiences/new"
        assert_unauthorized
      end
    end
  end

  describe "GET #edit" do
    context "as teacher" do
      before { user_session(@teacher) }

      it "sets COURSE_ID and AI_EXPERIENCE_ID in js_env" do
        get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}/edit"
        env = js_env_from_response(response)
        expect(env["COURSE_ID"].to_i).to eq(@course.id)
        expect(env["AI_EXPERIENCE_ID"]).to eq(@ai_experience.id.to_s)
        parsed_html_body = Nokogiri.parse(response.body)
        expect(parsed_html_body.css("title").first.inner_html).to eq("Edit #{@ai_experience.title}")
      end

      it "sets the active tab" do
        get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}/edit"
        parsed_html_body = Nokogiri.parse(response.body)
        expect(parsed_html_body.css("body").first.classes).to include("ai_experiences")
      end

      it "sets CONTEXT_FILE_MAX_SIZE_MB in js_env" do
        get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}/edit"
        expect(js_env_from_response(response)["CONTEXT_FILE_MAX_SIZE_MB"]).to eq(AiExperienceContextFile::MAX_FILE_SIZE / 1.megabyte)
      end

      it "sets AI_EXPERIENCES_FIELD_MAX_LENGTH in js_env" do
        get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}/edit"
        expect(js_env_from_response(response)["AI_EXPERIENCES_FIELD_MAX_LENGTH"]).to eq(AiExperience::TEACHER_AUTHORED_FIELD_MAX)
      end
    end

    context "as student" do
      before { user_session(@student) }

      it "returns unauthorized" do
        get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}/edit"
        assert_unauthorized
      end
    end
  end

  describe "ai_experiences feature flag" do
    context "when feature flag is disabled" do
      before do
        @course.root_account.disable_feature!(:ai_experiences)
      end

      context "as teacher" do
        before { user_session(@teacher) }

        it "returns 404 for index" do
          get "/courses/#{@course.id}/ai_experiences.json"
          expect(response).to have_http_status(:not_found)
        end

        it "returns 404 for show" do
          get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json"
          expect(response).to have_http_status(:not_found)
        end

        it "returns 404 for create" do
          post "/courses/#{@course.id}/ai_experiences.json", params: { ai_experience: { title: "Test", facts: "Test", learning_objective: "Test", pedagogical_guidance: "Test" } }
          expect(response).to have_http_status(:not_found)
        end

        it "returns 404 for update" do
          put "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json", params: { ai_experience: { title: "Updated" } }
          expect(response).to have_http_status(:not_found)
        end

        it "returns 404 for destroy" do
          delete "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}.json"
          expect(response).to have_http_status(:not_found)
        end

        it "returns 404 for new" do
          get "/courses/#{@course.id}/ai_experiences/new.json"
          expect(response).to have_http_status(:not_found)
        end

        it "returns 404 for edit" do
          get "/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}/edit.json"
          expect(response).to have_http_status(:not_found)
        end

        it "renders proper 404 template for HTML requests" do
          get "/courses/#{@course.id}/ai_experiences"
          expect(response).to have_http_status(:not_found)
          expect(response.body).to include('id="not_found_root"')
        end

        it "returns JSON error for JSON requests" do
          get "/courses/#{@course.id}/ai_experiences.json"
          expect(response).to have_http_status(:not_found)
          json_response = json_parse(response.body)
          expect(json_response["error"]).to eq("Resource Not Found")
        end
      end
    end
  end

  describe "GET #ai_conversations_index" do
    before :once do
      @student1 = @student
      @student2 = student_in_course(active_all: true, course: @course).user
      @student3 = student_in_course(active_all: true, course: @course).user

      # Create conversations for students
      @conversation1 = @ai_experience.ai_conversations.create!(
        llm_conversation_id: "conv-student1",
        user: @student1,
        course: @course,
        root_account: @course.root_account,
        account: @course.account,
        workflow_state: "active"
      )

      @conversation2 = @ai_experience.ai_conversations.create!(
        llm_conversation_id: "conv-student2",
        user: @student2,
        course: @course,
        root_account: @course.root_account,
        account: @course.account,
        workflow_state: "ended"
      )

      # Student 3 has no conversation
    end

    context "as teacher" do
      before { user_session(@teacher) }

      it "returns all students including those without conversations" do
        get "/api/v1/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}/ai_conversations.json"
        expect(response).to be_successful

        json_response = json_parse(response.body)
        conversations = json_response["conversations"]
        expect(conversations.length).to eq(3) # All 3 students

        # Check that students with conversations have IDs
        students_with_convs = conversations.select { |c| c["id"].present? }
        expect(students_with_convs.length).to eq(2)

        conversation_ids = students_with_convs.pluck("id")
        expect(conversation_ids).to include(@conversation1.id, @conversation2.id)

        # Check that student without conversation is included with nil ID
        student_without_conv = conversations.find { |c| c["user_id"] == @student3.id.to_s }
        expect(student_without_conv).to be_present
        expect(student_without_conv["id"]).to be_nil
        expect(student_without_conv["has_conversation"]).to be(false)
      end

      it "includes student information in each conversation" do
        get "/api/v1/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}/ai_conversations.json"

        json_response = json_parse(response.body)
        conversations = json_response["conversations"]

        conversations.each do |conv|
          expect(conv).to have_key("student")
          expect(conv["student"]).to have_key("id")
          expect(conv["student"]).to have_key("name")
        end
      end

      it "excludes deleted conversations but includes student without conversation" do
        @conversation1.update_column(:workflow_state, "deleted")

        get "/api/v1/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}/ai_conversations.json"

        json_response = json_parse(response.body)
        conversations = json_response["conversations"]
        expect(conversations.length).to eq(3) # All 3 students

        # Only conversation2 should have an ID
        students_with_convs = conversations.select { |c| c["id"].present? }
        expect(students_with_convs.length).to eq(1)
        expect(students_with_convs.first["id"]).to eq(@conversation2.id)

        # Student1 should now appear without conversation (since theirs was deleted)
        student1_entry = conversations.find { |c| c["user_id"] == @student1.id.to_s }
        expect(student1_entry["id"]).to be_nil
        expect(student1_entry["has_conversation"]).to be(false)
      end

      it "returns the latest conversation for each student" do
        # Create an older conversation for student1
        @ai_experience.ai_conversations.create!(
          llm_conversation_id: "conv-student1-old",
          user: @student1,
          course: @course,
          root_account: @course.root_account,
          account: @course.account,
          workflow_state: "ended",
          created_at: 2.days.ago,
          updated_at: 2.days.ago
        )

        get "/api/v1/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}/ai_conversations.json"

        json_response = json_parse(response.body)
        conversations = json_response["conversations"]

        student1_conversations = conversations.select { |c| c["user_id"] == @student1.id }
        expect(student1_conversations.length).to eq(1)
        expect(student1_conversations.first["id"]).to eq(@conversation1.id)
      end

      context "snapshot" do
        let(:stats_service) { instance_double(AiExperiences::ConversationContextStatsService) }

        before do
          allow(AiExperiences::ConversationContextStatsService).to receive(:new).and_return(stats_service)
          allow(stats_service).to receive(:total_objectives).and_return(2)
        end

        it "includes snapshot in response" do
          get "/api/v1/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}/ai_conversations.json"
          json_response = json_parse(response.body)
          expect(json_response).to have_key("snapshot")
          snapshot = json_response["snapshot"]
          expect(snapshot.keys).to include("completed", "in_progress", "not_started", "total_objectives")
        end

        it "counts completed, in_progress, and not_started correctly" do
          # student1: active, not completed → in_progress
          # student2: ended, not completed → neither
          # student3: no conversation → not_started
          get "/api/v1/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}/ai_conversations.json"
          snapshot = json_parse(response.body)["snapshot"]
          expect(snapshot["completed"]).to eq(0)
          expect(snapshot["in_progress"]).to eq(1)
          expect(snapshot["not_started"]).to eq(1)
        end

        it "counts completed when all_objectives_met is true" do
          @conversation1.update_column(:all_objectives_met, true)
          get "/api/v1/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}/ai_conversations.json"
          snapshot = json_parse(response.body)["snapshot"]
          expect(snapshot["completed"]).to eq(1)
          expect(snapshot["in_progress"]).to eq(0)
        end

        it "returns total_objectives from LLMA" do
          get "/api/v1/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}/ai_conversations.json"
          expect(json_parse(response.body)["snapshot"]["total_objectives"]).to eq(2)
        end

        it "returns total_objectives: 0 when LLMA call fails" do
          allow(stats_service).to receive(:total_objectives)
            .and_raise(LlmConversation::Errors::ConversationError.new("LLMA unavailable"))
          get "/api/v1/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}/ai_conversations.json"
          expect(response).to be_successful
          expect(json_parse(response.body)["snapshot"]["total_objectives"]).to eq(0)
        end
      end
    end

    context "as student" do
      before { user_session(@student1) }

      it "returns unauthorized" do
        get "/api/v1/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}/ai_conversations.json"
        assert_forbidden
      end
    end

    context "with invalid experience" do
      before { user_session(@teacher) }

      it "returns 404 for non-existent experience" do
        get "/api/v1/courses/#{@course.id}/ai_experiences/99999/ai_conversations.json"
        expect(response).to have_http_status(:not_found)
      end
    end
  end

  describe "GET #ai_conversation_show" do
    before :once do
      @student1 = @student
      @conversation = @ai_experience.ai_conversations.create!(
        llm_conversation_id: "conv-123",
        user: @student1,
        course: @course,
        root_account: @course.root_account,
        account: @course.account,
        workflow_state: "active"
      )
    end

    context "as teacher" do
      before do
        user_session(@teacher)
        mock_service = instance_double(AiExperiences::ConversationMessagesService)
        allow(AiExperiences::ConversationMessagesService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:fetch_with_progress).and_return({
                                                                          messages: [
                                                                            { role: "assistant", content: "Hello!" },
                                                                            { role: "user", content: "Hi there!" }
                                                                          ],
                                                                          progress: { status: "in_progress" }
                                                                        })
      end

      it "returns conversation with messages" do
        get "/api/v1/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}/ai_conversations/#{@conversation.id}.json"
        expect(response).to be_successful

        json_response = json_parse(response.body)
        expect(json_response["id"]).to eq(@conversation.id)
        expect(json_response).to have_key("messages")
        expect(json_response["messages"].length).to eq(2)
      end

      it "includes student information" do
        get "/api/v1/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}/ai_conversations/#{@conversation.id}.json"

        json_response = json_parse(response.body)
        expect(json_response).to have_key("student")
        expect(json_response["student"]["id"]).to eq(@student1.id)
      end

      it "includes progress information" do
        get "/api/v1/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}/ai_conversations/#{@conversation.id}.json"

        json_response = json_parse(response.body)
        expect(json_response).to have_key("progress")
        expect(json_response["progress"]["status"]).to eq("in_progress")
      end

      it "returns 404 for conversation from different experience" do
        other_experience = @course.ai_experiences.create!(
          title: "Other Experience",
          learning_objective: "Test",
          pedagogical_guidance: "Test"
        )

        get "/api/v1/courses/#{@course.id}/ai_experiences/#{other_experience.id}/ai_conversations/#{@conversation.id}.json"
        expect(response).to have_http_status(:not_found)
      end

      it "returns 404 for non-existent conversation" do
        get "/api/v1/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}/ai_conversations/99999.json"
        expect(response).to have_http_status(:not_found)
      end

      it "returns service unavailable with a generic user-safe error when LLM service fails" do
        mock_service = instance_double(AiExperiences::ConversationMessagesService)
        allow(AiExperiences::ConversationMessagesService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:fetch_with_progress)
          .and_raise(LlmConversation::Errors::ConversationError.new("internal llma stack trace"))

        get "/api/v1/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}/ai_conversations/#{@conversation.id}.json"
        expect(response).to have_http_status(:service_unavailable)

        json_response = json_parse(response.body)
        expect(json_response["error"]).to eq(LlmConversation::Errors::ConversationError::DEFAULT_USER_MESSAGE)
        expect(json_response["error"]).not_to include("stack trace")
      end
    end

    context "as student" do
      before { user_session(@student1) }

      it "returns unauthorized" do
        get "/api/v1/courses/#{@course.id}/ai_experiences/#{@ai_experience.id}/ai_conversations/#{@conversation.id}.json"
        assert_forbidden
      end
    end
  end
end
