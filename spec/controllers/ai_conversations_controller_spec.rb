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

describe AiConversationsController do
  before :once do
    course_with_teacher(active_all: true)
    student_in_course(active_all: true)
    @course.root_account.enable_feature!(:ai_experiences)
    @ai_experience = @course.ai_experiences.create!(
      title: "Customer Service Training",
      description: "Practice customer service scenarios",
      facts: "You are a customer service representative helping customers with billing issues.",
      learning_objectives: ["Students will learn to handle customer complaints professionally"],
      pedagogical_guidance: "A customer calls about incorrect billing"
    )
  end

  before do
    # By default, bypass the InstLLMHelper.with_rate_limit so action specs aren't sensitive to
    # per-user daily counters bleeding across examples. The dedicated "rate limiting" describe
    # overrides this to assert the real behavior.
    allow(InstLLMHelper).to receive(:with_rate_limit).and_yield
  end

  describe "GET #active_conversation" do
    context "as teacher" do
      before { user_session(@teacher) }

      it "returns existing active conversation with progress" do
        conversation = @ai_experience.ai_conversations.create!(
          llm_conversation_id: "existing-llm-conv-id",
          user: @teacher,
          course: @course,
          root_account: @course.root_account,
          account: @course.account,
          workflow_state: "active"
        )

        mock_service = instance_double(AiExperiences::ConversationMessagesService)
        allow(AiExperiences::ConversationMessagesService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:fetch_with_progress).and_return({
                                                                          messages: [
                                                                            { role: "User", text: "Hello" },
                                                                            { role: "Assistant", text: "Hi there!" }
                                                                          ],
                                                                          progress: {
                                                                            current: 1,
                                                                            total: 3,
                                                                            percentage: 33,
                                                                            objectives: [
                                                                              { objective: "Objective 1", status: "covered" },
                                                                              { objective: "Objective 2", status: "" },
                                                                              { objective: "Objective 3", status: "" }
                                                                            ]
                                                                          }
                                                                        })

        get :active_conversation,
            params: { course_id: @course.id, ai_experience_id: @ai_experience.id },
            format: :json

        expect(response).to be_successful
        json_response = json_parse(response.body)
        expect(json_response["id"]).to eq(conversation.id)
        expect(json_response["messages"]).to be_an(Array)
        expect(json_response["progress"]).to be_present
        expect(json_response["progress"]["percentage"]).to eq(33)
        expect(json_response["progress"]["current"]).to eq(1)
        expect(json_response["progress"]["total"]).to eq(3)
      end

      it "returns empty object when no active conversation" do
        get :active_conversation,
            params: { course_id: @course.id, ai_experience_id: @ai_experience.id },
            format: :json

        expect(response).to be_successful
        json_response = json_parse(response.body)
        expect(json_response).to eq({})
      end
    end

    context "as unenrolled user" do
      before :once do
        @unenrolled_user = user_factory(active_all: true)
      end

      before { user_session(@unenrolled_user) }

      it "returns forbidden for unenrolled users" do
        get :active_conversation,
            params: { course_id: @course.id, ai_experience_id: @ai_experience.id },
            format: :json

        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  describe "GET #show" do
    before :once do
      @student2 = student_in_course(active_all: true, course: @course).user
      @conversation = @ai_experience.ai_conversations.create!(
        llm_conversation_id: "student-conv-123",
        user: @student2,
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
                                                                            { role: "User", text: "Hello" },
                                                                            { role: "Assistant", text: "Hi there!" }
                                                                          ],
                                                                          progress: {
                                                                            current: 1,
                                                                            total: 2,
                                                                            percentage: 50,
                                                                            objectives: []
                                                                          }
                                                                        })
      end

      it "returns student conversation with messages" do
        get :show,
            params: { course_id: @course.id, ai_experience_id: @ai_experience.id, id: @conversation.id },
            format: :json

        expect(response).to be_successful
        json_response = json_parse(response.body)
        expect(json_response["id"]).to eq(@conversation.id)
        expect(json_response["user_id"]).to eq(@student2.id.to_s)
        expect(json_response["messages"]).to be_an(Array)
        expect(json_response["messages"].length).to eq(2)
        expect(json_response["progress"]).to be_present
      end

      it "includes all_objectives_met: false when objectives not yet met" do
        get :show,
            params: { course_id: @course.id, ai_experience_id: @ai_experience.id, id: @conversation.id },
            format: :json

        expect(response).to be_successful
        expect(json_parse(response.body)["all_objectives_met"]).to be false
      end

      it "includes all_objectives_met: true when objectives are met" do
        @conversation.update!(all_objectives_met: true)

        get :show,
            params: { course_id: @course.id, ai_experience_id: @ai_experience.id, id: @conversation.id },
            format: :json

        expect(response).to be_successful
        expect(json_parse(response.body)["all_objectives_met"]).to be true
      end

      it "returns 404 for non-existent conversation" do
        get :show,
            params: { course_id: @course.id, ai_experience_id: @ai_experience.id, id: 99_999 },
            format: :json

        expect(response).to have_http_status(:not_found)
      end
    end

    context "as student" do
      before { user_session(@student) }

      it "returns unauthorized when viewing another student's conversation" do
        get :show,
            params: { course_id: @course.id, ai_experience_id: @ai_experience.id, id: @conversation.id },
            format: :json

        assert_forbidden
      end
    end
  end

  describe "POST #create" do
    context "as teacher" do
      before { user_session(@teacher) }

      it "creates a new conversation and returns initial messages with progress" do
        mock_service = instance_double(AiExperiences::ConversationStartService)
        allow(AiExperiences::ConversationStartService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:start).and_return({
                                                            conversation_id: "llm-conv-id",
                                                            messages: [
                                                              { role: "User", text: "Hello" },
                                                              { role: "Assistant", text: "Hi there!" }
                                                            ],
                                                            progress: {
                                                              current: 0,
                                                              total: 2,
                                                              percentage: 0,
                                                              objectives: [
                                                                { objective: "Objective 1", status: "" },
                                                                { objective: "Objective 2", status: "" }
                                                              ]
                                                            }
                                                          })

        post :create,
             params: { course_id: @course.id, ai_experience_id: @ai_experience.id },
             format: :json

        expect(response).to have_http_status(:created)
        json_response = json_parse(response.body)
        expect(json_response["id"]).to be_present
        expect(json_response["messages"]).to be_an(Array)
        expect(json_response["messages"].length).to eq(2)
        expect(json_response["conversation_id"]).to be_nil # Should not expose LLM conversation ID
        expect(json_response["progress"]).to be_present
        expect(json_response["progress"]["percentage"]).to eq(0)
        expect(json_response["progress"]["objectives"]).to be_an(Array)
      end

      it "creates an AiConversation record" do
        mock_service = instance_double(AiExperiences::ConversationStartService)
        allow(AiExperiences::ConversationStartService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:start).and_return({
                                                            conversation_id: "llm-conv-id",
                                                            messages: []
                                                          })

        expect do
          post :create,
               params: { course_id: @course.id, ai_experience_id: @ai_experience.id },
               format: :json
        end.to change(AiConversation, :count).by(1)

        conversation = AiConversation.last
        expect(conversation.user).to eq(@teacher)
        expect(conversation.ai_experience).to eq(@ai_experience)
        expect(conversation.workflow_state).to eq("active")
      end

      it "ends existing active conversation and creates a new one" do
        existing_conversation = @ai_experience.ai_conversations.create!(
          llm_conversation_id: "existing-id",
          user: @teacher,
          course: @course,
          root_account: @course.root_account,
          account: @course.account,
          workflow_state: "active"
        )

        mock_service = instance_double(AiExperiences::ConversationStartService)
        allow(AiExperiences::ConversationStartService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:start).and_return({
                                                            conversation_id: "new-llm-conv-id",
                                                            messages: []
                                                          })

        post :create,
             params: { course_id: @course.id, ai_experience_id: @ai_experience.id },
             format: :json

        expect(response).to have_http_status(:created)

        existing_conversation.reload
        expect(existing_conversation.workflow_state).to eq("ended")

        # Check that new conversation was created
        new_conversation = AiConversation.active.for_user(@teacher.id).first
        expect(new_conversation).to be_present
        expect(new_conversation.id).not_to eq(existing_conversation.id)
      end

      it "returns service unavailable with a generic user-safe error on conversation error" do
        mock_service = instance_double(AiExperiences::ConversationStartService)
        allow(AiExperiences::ConversationStartService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:start)
          .and_raise(LlmConversation::Errors::ConversationError, "internal stack trace from llma")

        post :create,
             params: { course_id: @course.id, ai_experience_id: @ai_experience.id },
             format: :json

        expect(response).to have_http_status(:service_unavailable)
        json_response = json_parse(response.body)
        expect(json_response["error"]).to eq(LlmConversation::Errors::ConversationError::DEFAULT_USER_MESSAGE)
        expect(json_response["error"]).not_to include("internal stack trace")
      end

      it "includes a reference_id on the error response for support correlation" do
        allow(RequestContext::Generator).to receive(:request_id).and_return("req-create-123")
        mock_service = instance_double(AiExperiences::ConversationStartService)
        allow(AiExperiences::ConversationStartService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:start)
          .and_raise(LlmConversation::Errors::ConversationError, "internal stack trace from llma")

        post :create,
             params: { course_id: @course.id, ai_experience_id: @ai_experience.id },
             format: :json

        json_response = json_parse(response.body)
        expect(json_response["reference_id"]).to eq("req-create-123")
      end

      it "surfaces the llma error code and a retryable flag on the error response" do
        mock_service = instance_double(AiExperiences::ConversationStartService)
        allow(AiExperiences::ConversationStartService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:start)
          .and_raise(LlmConversation::Errors::ConversationError.new("boom", code: "evaluation_parse_failed"))

        post :create,
             params: { course_id: @course.id, ai_experience_id: @ai_experience.id },
             format: :json

        json_response = json_parse(response.body)
        expect(json_response["code"]).to eq("evaluation_parse_failed")
        expect(json_response["retryable"]).to be true
      end

      it "marks a deterministic failure as not retryable" do
        mock_service = instance_double(AiExperiences::ConversationStartService)
        allow(AiExperiences::ConversationStartService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:start)
          .and_raise(LlmConversation::Errors::ConversationError.new("bad", code: "context_invalid"))

        post :create,
             params: { course_id: @course.id, ai_experience_id: @ai_experience.id },
             format: :json

        json_response = json_parse(response.body)
        expect(json_response["code"]).to eq("context_invalid")
        expect(json_response["retryable"]).to be false
      end
    end

    context "as student" do
      before { user_session(@student) }

      it "allows students to create conversations" do
        mock_service = instance_double(AiExperiences::ConversationStartService)
        allow(AiExperiences::ConversationStartService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:start).and_return({
                                                            conversation_id: "llm-conv-id",
                                                            messages: []
                                                          })

        post :create,
             params: { course_id: @course.id, ai_experience_id: @ai_experience.id },
             format: :json

        expect(response).to have_http_status(:created)
      end
    end

    context "as unenrolled user" do
      before :once do
        @unenrolled_user = user_factory(active_all: true)
      end

      before { user_session(@unenrolled_user) }

      it "returns forbidden for unenrolled users" do
        post :create,
             params: { course_id: @course.id, ai_experience_id: @ai_experience.id },
             format: :json

        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  describe "POST #post_message" do
    before do
      @conversation = @ai_experience.ai_conversations.create!(
        llm_conversation_id: "llm-conv-id",
        user: @teacher,
        course: @course,
        root_account: @course.root_account,
        account: @course.account,
        workflow_state: "active"
      )
    end

    context "as teacher" do
      before { user_session(@teacher) }

      it "posts a message and returns updated messages with progress" do
        mock_service = instance_double(AiExperiences::ConversationContinueService)
        allow(AiExperiences::ConversationContinueService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:continue).and_return({
                                                               conversation_id: "llm-conv-id",
                                                               messages: [
                                                                 { role: "User", text: "Hello" },
                                                                 { role: "User", text: "How are you?" },
                                                                 { role: "Assistant", text: "I'm doing well!" }
                                                               ],
                                                               progress: {
                                                                 current: 1,
                                                                 total: 2,
                                                                 percentage: 50,
                                                                 objectives: [
                                                                   { objective: "Objective 1", status: "covered" },
                                                                   { objective: "Objective 2", status: "" }
                                                                 ]
                                                               }
                                                             })

        post :post_message,
             params: {
               course_id: @course.id,
               ai_experience_id: @ai_experience.id,
               id: @conversation.id,
               message: "How are you?"
             },
             format: :json

        expect(response).to be_successful
        json_response = json_parse(response.body)
        expect(json_response["id"]).to eq(@conversation.id)
        expect(json_response["messages"]).to be_an(Array)
        expect(json_response["messages"].length).to eq(3)
        expect(json_response["conversation_id"]).to be_nil # Should not expose LLM conversation ID
        expect(json_response["progress"]).to be_present
        expect(json_response["progress"]["percentage"]).to eq(50)
      end

      it "returns bad request when message is missing" do
        post :post_message,
             params: { course_id: @course.id, ai_experience_id: @ai_experience.id, id: @conversation.id },
             format: :json

        expect(response).to have_http_status(:bad_request)
        json_response = json_parse(response.body)
        expect(json_response["error"]).to eq("message is required")
      end

      describe "student message length cap (M-8, mirrors llma AddMessageDto.text @MaxLength(4000))" do
        let(:max) { AiConversation::USER_MESSAGE_MAX_LENGTH }

        it "accepts a message at the cap" do
          mock_service = instance_double(AiExperiences::ConversationContinueService)
          allow(AiExperiences::ConversationContinueService).to receive(:new).and_return(mock_service)
          allow(mock_service).to receive(:continue).and_return({ messages: [], progress: nil })

          post :post_message,
               params: {
                 course_id: @course.id,
                 ai_experience_id: @ai_experience.id,
                 id: @conversation.id,
                 message: "a" * max
               },
               format: :json

          expect(response).to be_successful
        end

        it "rejects a message one character over the cap without calling llma" do
          expect(AiExperiences::ConversationContinueService).not_to receive(:new)

          post :post_message,
               params: {
                 course_id: @course.id,
                 ai_experience_id: @ai_experience.id,
                 id: @conversation.id,
                 message: "a" * (max + 1)
               },
               format: :json

          expect(response).to have_http_status(:unprocessable_content)
          json_response = json_parse(response.body)
          expect(json_response["error"]).to eq("message must be #{max} characters or fewer")
        end
      end

      it "returns service unavailable on conversation error" do
        mock_service = instance_double(AiExperiences::ConversationContinueService)
        allow(AiExperiences::ConversationContinueService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:continue)
          .and_raise(LlmConversation::Errors::ConversationError, "Failed to send")

        post :post_message,
             params: {
               course_id: @course.id,
               ai_experience_id: @ai_experience.id,
               id: @conversation.id,
               message: "Test"
             },
             format: :json

        expect(response).to have_http_status(:service_unavailable)
      end
    end

    context "as student" do
      before do
        user_session(@student)
        @student_conversation = @ai_experience.ai_conversations.create!(
          llm_conversation_id: "student-llm-conv-id",
          user: @student,
          course: @course,
          root_account: @course.root_account,
          account: @course.account,
          workflow_state: "active"
        )
      end

      it "allows students to post messages to their own conversations" do
        mock_service = instance_double(AiExperiences::ConversationContinueService)
        allow(AiExperiences::ConversationContinueService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:continue).and_return({
                                                               conversation_id: "student-llm-conv-id",
                                                               messages: [],
                                                               progress: nil
                                                             })

        post :post_message,
             params: {
               course_id: @course.id,
               ai_experience_id: @ai_experience.id,
               id: @student_conversation.id,
               message: "Test"
             },
             format: :json

        expect(response).to be_successful
      end

      it "sets all_objectives_met when progress is complete" do
        mock_service = instance_double(AiExperiences::ConversationContinueService)
        allow(AiExperiences::ConversationContinueService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:continue).and_return({
                                                               messages: [],
                                                               progress: { current: 3, total: 3, percentage: 100 }
                                                             })

        expect do
          post :post_message,
               params: {
                 course_id: @course.id,
                 ai_experience_id: @ai_experience.id,
                 id: @student_conversation.id,
                 message: "Test"
               },
               format: :json
        end.to change { @student_conversation.reload.all_objectives_met }.from(false).to(true)
      end

      it "does not set all_objectives_met when progress is incomplete" do
        mock_service = instance_double(AiExperiences::ConversationContinueService)
        allow(AiExperiences::ConversationContinueService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:continue).and_return({
                                                               messages: [],
                                                               progress: { current: 2, total: 3, percentage: 66 }
                                                             })

        expect do
          post :post_message,
               params: {
                 course_id: @course.id,
                 ai_experience_id: @ai_experience.id,
                 id: @student_conversation.id,
                 message: "Test"
               },
               format: :json
        end.not_to change { @student_conversation.reload.all_objectives_met }
      end

      it "does not set all_objectives_met when progress is nil" do
        mock_service = instance_double(AiExperiences::ConversationContinueService)
        allow(AiExperiences::ConversationContinueService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:continue).and_return({ messages: [], progress: nil })

        expect do
          post :post_message,
               params: {
                 course_id: @course.id,
                 ai_experience_id: @ai_experience.id,
                 id: @student_conversation.id,
                 message: "Test"
               },
               format: :json
        end.not_to change { @student_conversation.reload.all_objectives_met }

        expect(response).to be_successful
      end

      it "does not set all_objectives_met when current and total are both zero" do
        mock_service = instance_double(AiExperiences::ConversationContinueService)
        allow(AiExperiences::ConversationContinueService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:continue).and_return({
                                                               messages: [],
                                                               progress: { current: 0, total: 0, percentage: 0 }
                                                             })

        expect do
          post :post_message,
               params: {
                 course_id: @course.id,
                 ai_experience_id: @ai_experience.id,
                 id: @student_conversation.id,
                 message: "Test"
               },
               format: :json
        end.not_to change { @student_conversation.reload.all_objectives_met }
      end
    end
  end

  describe "DELETE #destroy" do
    before do
      @conversation = @ai_experience.ai_conversations.create!(
        llm_conversation_id: "llm-conv-id",
        user: @teacher,
        course: @course,
        root_account: @course.root_account,
        account: @course.account,
        workflow_state: "active"
      )
    end

    context "as teacher" do
      before { user_session(@teacher) }

      it "ends the conversation" do
        delete :destroy,
               params: { course_id: @course.id, ai_experience_id: @ai_experience.id, id: @conversation.id },
               format: :json

        expect(response).to be_successful
        json_response = json_parse(response.body)
        expect(json_response["message"]).to eq("Conversation ended successfully")

        @conversation.reload
        expect(@conversation.workflow_state).to eq("ended")
      end
    end

    context "as student" do
      before do
        user_session(@student)
        @student_conversation = @ai_experience.ai_conversations.create!(
          llm_conversation_id: "student-llm-conv-id",
          user: @student,
          course: @course,
          root_account: @course.root_account,
          account: @course.account,
          workflow_state: "active"
        )
      end

      it "allows students to delete their own conversations" do
        delete :destroy,
               params: { course_id: @course.id, ai_experience_id: @ai_experience.id, id: @student_conversation.id },
               format: :json

        expect(response).to be_successful
      end
    end
  end

  describe "GET #evaluation" do
    before :once do
      @student2 = student_in_course(active_all: true, course: @course).user
      @conversation = @ai_experience.ai_conversations.create!(
        llm_conversation_id: "student-conv-123",
        user: @student2,
        course: @course,
        root_account: @course.root_account,
        account: @course.account,
        workflow_state: "active"
      )
    end

    context "as teacher" do
      before do
        user_session(@teacher)
        @evaluation_data = {
          "overall_assessment" => "Student demonstrated strong analytical skills.",
          "key_moments" => [
            {
              "learning_objective" => "Critical thinking",
              "evidence" => "Student analyzed the problem systematically",
              "message_number" => 3
            }
          ],
          "learning_objectives_evaluation" => [
            {
              "objective" => "Critical thinking",
              "met" => true,
              "score" => 85,
              "explanation" => "Student showed excellent analytical skills"
            }
          ],
          "strengths" => [
            "Clear communication",
            "Systematic approach"
          ],
          "areas_for_improvement" => [
            "Historical context analysis"
          ],
          "overall_score" => 85
        }
        mock_service = instance_double(AiExperiences::ConversationEvaluationService)
        allow(AiExperiences::ConversationEvaluationService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:evaluate).and_return(@evaluation_data)
      end

      it "returns evaluation data for a student conversation" do
        get :evaluation,
            params: { course_id: @course.id, ai_experience_id: @ai_experience.id, id: @conversation.id },
            format: :json

        expect(response).to be_successful
        json_response = json_parse(response.body)
        expect(json_response["id"]).to eq(@conversation.id)
        expect(json_response["evaluation"]).to be_present
        expect(json_response["evaluation"]["overall_score"]).to eq(85)
        expect(json_response["evaluation"]["overall_assessment"]).to be_present
        expect(json_response["evaluation"]["learning_objectives_evaluation"]).to be_an(Array)
        expect(json_response["evaluation"]["strengths"]).to be_an(Array)
        expect(json_response["evaluation"]["areas_for_improvement"]).to be_an(Array)
      end

      it "returns 404 for non-existent conversation" do
        get :evaluation,
            params: { course_id: @course.id, ai_experience_id: @ai_experience.id, id: 99_999 },
            format: :json

        expect(response).to have_http_status(:not_found)
      end

      it "returns service unavailable with a generic user-safe error on conversation error" do
        mock_service = instance_double(AiExperiences::ConversationEvaluationService)
        allow(AiExperiences::ConversationEvaluationService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:evaluate)
          .and_raise(LlmConversation::Errors::ConversationError, "Evaluation service unavailable")

        get :evaluation,
            params: { course_id: @course.id, ai_experience_id: @ai_experience.id, id: @conversation.id },
            format: :json

        expect(response).to have_http_status(:service_unavailable)
        json_response = json_parse(response.body)
        expect(json_response["error"]).to eq(LlmConversation::Errors::ConversationError::DEFAULT_USER_MESSAGE)
      end
    end

    context "as student" do
      before { user_session(@student) }

      it "returns unauthorized when requesting evaluation" do
        get :evaluation,
            params: { course_id: @course.id, ai_experience_id: @ai_experience.id, id: @conversation.id },
            format: :json

        assert_forbidden
      end
    end

    context "as unenrolled user" do
      before :once do
        @unenrolled_user = user_factory(active_all: true)
      end

      before { user_session(@unenrolled_user) }

      it "returns forbidden for unenrolled users" do
        get :evaluation,
            params: { course_id: @course.id, ai_experience_id: @ai_experience.id, id: @conversation.id },
            format: :json

        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  describe "POST #create_feedback" do
    before do
      @conversation = @ai_experience.ai_conversations.create!(
        llm_conversation_id: "llm-conv-id",
        user: @teacher,
        course: @course,
        root_account: @course.root_account,
        account: @course.account,
        workflow_state: "active"
      )
    end

    context "as teacher" do
      before { user_session(@teacher) }

      it "creates feedback and returns it" do
        feedback_data = { "id" => "fb-1", "vote" => "liked", "user_id" => @teacher.uuid }
        mock_service = instance_double(AiExperiences::ConversationMessageFeedbackService)
        allow(AiExperiences::ConversationMessageFeedbackService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:create).and_return(feedback_data)

        post :create_feedback,
             params: {
               course_id: @course.id,
               ai_experience_id: @ai_experience.id,
               id: @conversation.id,
               message_id: "msg-123",
               vote: "liked"
             },
             format: :json

        expect(response).to be_successful
        json_response = json_parse(response.body)
        expect(json_response["feedback"]["id"]).to eq("fb-1")
        expect(json_response["feedback"]["vote"]).to eq("liked")
      end

      it "returns service unavailable with a generic user-safe error on conversation error" do
        mock_service = instance_double(AiExperiences::ConversationMessageFeedbackService)
        allow(AiExperiences::ConversationMessageFeedbackService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:create)
          .and_raise(LlmConversation::Errors::ConversationError, "Feedback service error")

        post :create_feedback,
             params: {
               course_id: @course.id,
               ai_experience_id: @ai_experience.id,
               id: @conversation.id,
               message_id: "msg-123",
               vote: "liked"
             },
             format: :json

        expect(response).to have_http_status(:service_unavailable)
        json_response = json_parse(response.body)
        expect(json_response["error"]).to eq(LlmConversation::Errors::ConversationError::DEFAULT_USER_MESSAGE)
      end
    end

    context "as student" do
      before do
        user_session(@student)
        @student_conversation = @ai_experience.ai_conversations.create!(
          llm_conversation_id: "student-llm-conv-id",
          user: @student,
          course: @course,
          root_account: @course.root_account,
          account: @course.account,
          workflow_state: "active"
        )
      end

      it "allows students to create feedback on their own conversations" do
        feedback_data = { "id" => "fb-2", "vote" => "disliked", "user_id" => @student.uuid }
        mock_service = instance_double(AiExperiences::ConversationMessageFeedbackService)
        allow(AiExperiences::ConversationMessageFeedbackService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:create).and_return(feedback_data)

        post :create_feedback,
             params: {
               course_id: @course.id,
               ai_experience_id: @ai_experience.id,
               id: @student_conversation.id,
               message_id: "msg-456",
               vote: "disliked",
               feedback_message: "Irrelevant"
             },
             format: :json

        expect(response).to be_successful
        json_response = json_parse(response.body)
        expect(json_response["feedback"]["vote"]).to eq("disliked")
      end
    end
  end

  describe "DELETE #delete_feedback" do
    before do
      @conversation = @ai_experience.ai_conversations.create!(
        llm_conversation_id: "llm-conv-id",
        user: @teacher,
        course: @course,
        root_account: @course.root_account,
        account: @course.account,
        workflow_state: "active"
      )
    end

    context "as teacher" do
      before { user_session(@teacher) }

      it "deletes feedback and returns success" do
        mock_service = instance_double(AiExperiences::ConversationMessageFeedbackService)
        allow(AiExperiences::ConversationMessageFeedbackService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:delete)

        delete :delete_feedback,
               params: {
                 course_id: @course.id,
                 ai_experience_id: @ai_experience.id,
                 id: @conversation.id,
                 message_id: "msg-123",
                 feedback_id: "fb-1"
               },
               format: :json

        expect(response).to be_successful
        json_response = json_parse(response.body)
        expect(json_response["success"]).to be true
      end

      it "returns service unavailable with a generic user-safe error on conversation error" do
        mock_service = instance_double(AiExperiences::ConversationMessageFeedbackService)
        allow(AiExperiences::ConversationMessageFeedbackService).to receive(:new).and_return(mock_service)
        allow(mock_service).to receive(:delete)
          .and_raise(LlmConversation::Errors::ConversationError, "Delete feedback error")

        delete :delete_feedback,
               params: {
                 course_id: @course.id,
                 ai_experience_id: @ai_experience.id,
                 id: @conversation.id,
                 message_id: "msg-123",
                 feedback_id: "fb-1"
               },
               format: :json

        expect(response).to have_http_status(:service_unavailable)
        json_response = json_parse(response.body)
        expect(json_response["error"]).to eq(LlmConversation::Errors::ConversationError::DEFAULT_USER_MESSAGE)
      end
    end
  end

  describe "feedback actor authorization (M-2)" do
    # Lock-in: load_conversation is the security gate that prevents a student
    # from leaving (or deleting) feedback on another user's conversation. These
    # specs assert that contract from the feedback action's perspective so a
    # regression to load_conversation's scoping is caught at the M-2 surface.
    before :once do
      @other_student = user_factory(active_all: true)
      @course.enroll_student(@other_student, enrollment_state: "active")
      @owners_conversation = @ai_experience.ai_conversations.create!(
        llm_conversation_id: "owner-conv",
        user: @student,
        course: @course,
        root_account: @course.root_account,
        account: @course.account,
        workflow_state: "active"
      )
    end

    before do
      @feedback_service = instance_double(AiExperiences::ConversationMessageFeedbackService)
      allow(AiExperiences::ConversationMessageFeedbackService).to receive(:new).and_return(@feedback_service)
      allow(@feedback_service).to receive(:create).and_return({ "id" => "fb-x" })
      allow(@feedback_service).to receive(:delete)
    end

    context "as another student (not the conversation owner)" do
      before { user_session(@other_student) }

      it "create_feedback returns 404 and does not call llma" do
        post :create_feedback,
             params: { course_id: @course.id,
                       ai_experience_id: @ai_experience.id,
                       id: @owners_conversation.id,
                       message_id: "msg-123",
                       vote: "liked" },
             format: :json

        expect(response).to have_http_status(:not_found)
        expect(@feedback_service).not_to have_received(:create)
      end

      it "delete_feedback returns 404 and does not call llma" do
        delete :delete_feedback,
               params: { course_id: @course.id,
                         ai_experience_id: @ai_experience.id,
                         id: @owners_conversation.id,
                         message_id: "msg-123",
                         feedback_id: "fb-1" },
               format: :json

        expect(response).to have_http_status(:not_found)
        expect(@feedback_service).not_to have_received(:delete)
      end
    end

    context "as the conversation owner" do
      before { user_session(@student) }

      it "create_feedback forwards to llma" do
        post :create_feedback,
             params: { course_id: @course.id,
                       ai_experience_id: @ai_experience.id,
                       id: @owners_conversation.id,
                       message_id: "msg-123",
                       vote: "liked" },
             format: :json

        expect(response).to be_successful
        expect(@feedback_service).to have_received(:create)
      end

      it "delete_feedback forwards to llma" do
        delete :delete_feedback,
               params: { course_id: @course.id,
                         ai_experience_id: @ai_experience.id,
                         id: @owners_conversation.id,
                         message_id: "msg-123",
                         feedback_id: "fb-1" },
               format: :json

        expect(response).to be_successful
        expect(@feedback_service).to have_received(:delete)
      end
    end

    context "as a course manager (teacher) operating on someone else's conversation" do
      before { user_session(@teacher) }

      it "create_feedback forwards to llma" do
        post :create_feedback,
             params: { course_id: @course.id,
                       ai_experience_id: @ai_experience.id,
                       id: @owners_conversation.id,
                       message_id: "msg-123",
                       vote: "liked" },
             format: :json

        expect(response).to be_successful
        expect(@feedback_service).to have_received(:create)
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

        it "returns 404 for create" do
          post :create,
               params: { course_id: @course.id, ai_experience_id: @ai_experience.id },
               format: :json

          expect(response).to have_http_status(:not_found)
        end

        it "renders proper 404 template for HTML requests" do
          post :create,
               params: { course_id: @course.id, ai_experience_id: @ai_experience.id }

          expect(response).to have_http_status(:not_found)
          expect(response).to render_template("shared/errors/404_message")
        end

        it "returns JSON error for JSON requests" do
          post :create,
               params: { course_id: @course.id, ai_experience_id: @ai_experience.id },
               format: :json

          expect(response).to have_http_status(:not_found)
          json_response = json_parse(response.body)
          expect(json_response["error"]).to eq("Resource Not Found")
        end
      end
    end
  end

  describe "rate limiting (InstLLMHelper.with_rate_limit)" do
    before do
      user_session(@teacher)
      @rl_conversation = @ai_experience.ai_conversations.create!(
        llm_conversation_id: "rl-conv",
        user: @teacher,
        course: @course,
        root_account: @course.root_account,
        account: @course.account,
        workflow_state: "active"
      )
    end

    def stub_over_limit(config_name, limit:)
      allow(InstLLMHelper).to receive(:with_rate_limit) do |llm_config:, **, &block|
        if llm_config.name == config_name
          raise InstLLMHelper::RateLimitExceededError.new(limit:)
        else
          block.call
        end
      end
    end

    it "renders 429 when #create is over the daily limit, without leaking the limit number" do
      stub_over_limit("ai_experiences_create_conversation", limit: 100)

      post :create,
           params: { course_id: @course.id, ai_experience_id: @ai_experience.id },
           format: :json

      expect(response).to have_http_status(:too_many_requests)
      body = json_parse(response.body)["error"]
      expect(body).to include("rate limit")
      expect(body).not_to include("100")
    end

    it "renders 429 when #post_message is over the daily limit, without leaking the limit number" do
      stub_over_limit("ai_experiences_post_message", limit: 1000)

      post :post_message,
           params: { course_id: @course.id, ai_experience_id: @ai_experience.id, id: @rl_conversation.id, message: "hi" },
           format: :json

      expect(response).to have_http_status(:too_many_requests)
      body = json_parse(response.body)["error"]
      expect(body).to include("rate limit")
      expect(body).not_to include("1,000")
      expect(body).not_to include("1000")
    end

    it "renders 429 when #evaluation is over the daily limit, without leaking the limit number" do
      stub_over_limit("ai_experiences_evaluation", limit: 1000)

      get :evaluation,
          params: { course_id: @course.id, ai_experience_id: @ai_experience.id, id: @rl_conversation.id },
          format: :json

      expect(response).to have_http_status(:too_many_requests)
      body = json_parse(response.body)["error"]
      expect(body).to include("rate limit")
      expect(body).not_to include("1,000")
      expect(body).not_to include("1000")
    end

    it "passes Setting-tunable limits to InstLLMHelper for #create" do
      Setting.set("ai_experiences.rate_limit.ai_experiences_create_conversation_daily", "42")

      received = nil
      allow(InstLLMHelper).to receive(:with_rate_limit) do |llm_config:, **, &block|
        received = llm_config
        block.call
      end
      mock_service = instance_double(AiExperiences::ConversationStartService)
      allow(AiExperiences::ConversationStartService).to receive(:new).and_return(mock_service)
      allow(mock_service).to receive(:start).and_return({ conversation_id: "x", messages: [] })

      post :create,
           params: { course_id: @course.id, ai_experience_id: @ai_experience.id },
           format: :json

      expect(received.name).to eq("ai_experiences_create_conversation")
      expect(received.rate_limit).to eq({ limit: 42, period: "day" })
    end

    it "does not throttle #destroy, #show, #active_conversation, or feedback actions" do
      expect(InstLLMHelper).not_to receive(:with_rate_limit)
      delete :destroy,
             params: { course_id: @course.id, ai_experience_id: @ai_experience.id, id: @rl_conversation.id },
             format: :json
      expect(response).to have_http_status(:ok)
    end
  end
end
