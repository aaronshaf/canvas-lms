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
#

# @API AI Conversations
# API for managing conversations with AI Experiences.
class AiConversationsController < ApplicationController
  include Api::V1::AiExperience
  include LLMConversationErrorRendering

  # Lightweight duck-type for InstLLMHelper.with_rate_limit. The helper only reads
  # `#name` and `#rate_limit` — no template/model_id involved because llma owns the
  # prompt and model selection (we just need the daily-cap bookkeeping).
  RateLimitConfig = Struct.new(:name, :rate_limit, keyword_init: true)

  RATE_LIMIT_DEFAULTS = {
    "ai_experiences_create_conversation" => 100,
    "ai_experiences_post_message" => 1000,
    "ai_experiences_evaluation" => 1000
  }.freeze

  before_action :require_context
  before_action :check_ai_experiences_feature_flag
  before_action :require_access_right
  before_action :load_experience
  before_action :load_conversation, only: %i[post_message destroy show evaluation create_feedback delete_feedback]

  rescue_from InstLLMHelper::RateLimitExceededError do
    render json: llm_error_payload(t("You've hit the AI Experiences rate limit. Please try again later."), code: "rate_limited", retryable: true),
           status: :too_many_requests
  end

  # @API Show conversation
  #
  # Get a specific conversation by ID (for teachers viewing student conversations)
  #
  # @returns {Object} Hash with conversation details including messages
  def show
    # Teachers can view any student's conversation
    permissions = %i[manage_assignments_add manage_assignments_edit manage_assignments_delete]
    unless @context.grants_any_right?(current_principal, *permissions)
      return render_unauthorized_action
    end

    messages_and_progress = AiExperiences::ConversationMessagesService.new(account: @context.root_account).fetch_with_progress(
      conversation_id: @conversation.llm_conversation_id,
      requesting_user: @current_user
    )

    render json: {
      id: @conversation.id,
      user_id: @conversation.user_id.to_s,
      llm_conversation_id: @conversation.llm_conversation_id,
      workflow_state: @conversation.workflow_state,
      all_objectives_met: @conversation.all_objectives_met,
      created_at: @conversation.created_at,
      updated_at: @conversation.updated_at,
      messages: messages_and_progress[:messages],
      progress: messages_and_progress[:progress]
    }
  end

  # @API Get active conversation
  #
  # Get the active conversation for the current user and AI experience
  #
  # @returns {Object} Hash with id and messages array, or empty object if no active conversation
  def active_conversation
    existing_conversation = @experience.ai_conversations
                                       .active
                                       .for_user(@current_user.id)
                                       .first

    if existing_conversation
      messages_and_progress = AiExperiences::ConversationMessagesService.new(account: @context.root_account).fetch_with_progress(
        conversation_id: existing_conversation.llm_conversation_id,
        requesting_user: @current_user
      )
      render json: { id: existing_conversation.id, messages: messages_and_progress[:messages], progress: messages_and_progress[:progress] }
    else
      render json: {}
    end
  end

  # @API Create AI conversation
  #
  # Initialize a new conversation with the AI experience
  #
  # @returns {Object} Hash with conversation_id and initial messages array
  def create
    # Check if user has an existing active conversation for this experience
    existing_conversation = @experience.ai_conversations
                                       .active
                                       .for_user(@current_user.id)
                                       .first

    result = nil
    InstLLMHelper.with_rate_limit(user: @current_user, llm_config: rate_limit_config_for("ai_experiences_create_conversation")) do
      # If active conversation exists, end it before creating a new one
      existing_conversation&.end_session!

      result = AiExperiences::ConversationStartService.new(account: @context.root_account).start(
        current_user: @current_user,
        root_account_uuid: @context.root_account.uuid,
        conversation_context_id: @experience.llm_conversation_context_id,
        facts: @experience.facts,
        learning_objectives: @experience.learning_objectives,
        scenario: @experience.pedagogical_guidance
      )
    end

    # Save the conversation record
    conversation_record = nil
    if result[:conversation_id]
      conversation_record = @experience.ai_conversations.create!(
        llm_conversation_id: result[:conversation_id],
        user: @current_user,
        course: @context,
        root_account: @context.root_account,
        account: @context.root_account,
        workflow_state: "active"
      )
    end

    # Return only the Canvas conversation ID, messages, and progress
    render json: { id: conversation_record&.id, messages: result[:messages], progress: result[:progress] }, status: :created
  end

  # @API Post message to conversation
  #
  # Send a message to an existing conversation and get the AI response
  #
  # @argument message [Required, String]
  #   The user's message to send to the AI
  #
  # @returns {Object} Hash with id and updated messages array
  def post_message
    unless params[:message].present?
      return render json: { error: "message is required" }, status: :bad_request
    end

    if params[:message].length > AiConversation::USER_MESSAGE_MAX_LENGTH
      return render json: { error: "message must be #{AiConversation::USER_MESSAGE_MAX_LENGTH} characters or fewer" },
                    status: :unprocessable_content
    end

    result = nil
    InstLLMHelper.with_rate_limit(user: @current_user, llm_config: rate_limit_config_for("ai_experiences_post_message")) do
      result = AiExperiences::ConversationContinueService.new(account: @context.root_account).continue(
        conversation_id: @conversation.llm_conversation_id,
        new_user_message: params[:message],
        requesting_user: @current_user
      )
    end

    progress = result[:progress]
    if progress && progress[:total].to_i > 0 && progress[:current].to_i == progress[:total].to_i
      @conversation.mark_objectives_met!
    end

    # Return only the Canvas conversation ID, messages, and progress
    render json: { id: @conversation.id, messages: result[:messages], progress: }
  end

  # @API Delete AI conversation
  #
  # End the current conversation session
  #
  # @returns {Object} Success message
  def destroy
    @conversation.end_session!
    render json: { message: "Conversation ended successfully" }
  end

  # @API Get conversation evaluation
  #
  # Fetch evaluation data for a conversation from the llm-conversation service
  #
  # @returns {Object} Hash with evaluation metrics
  def evaluation
    # Only teachers can request evaluations
    permissions = %i[manage_assignments_add manage_assignments_edit manage_assignments_delete]
    unless @context.grants_any_right?(current_principal, *permissions)
      return render_unauthorized_action
    end

    evaluation_data = nil
    InstLLMHelper.with_rate_limit(user: @current_user, llm_config: rate_limit_config_for("ai_experiences_evaluation")) do
      evaluation_data = AiExperiences::ConversationEvaluationService.new(account: @context.root_account).evaluate(
        conversation_id: @conversation.llm_conversation_id
      )
    end

    render json: {
      id: @conversation.id,
      evaluation: evaluation_data
    }
  end

  # @API Create feedback on a conversation message
  #
  # Submit a like or dislike vote on an AI-generated message.
  #
  # Ownership: load_conversation gates this action — only the conversation owner
  # or a course manager reaches here. Sub-resource (message_id within the
  # conversation) scoping is delegated to llma.
  #
  # @argument vote [Required, String] "liked" or "disliked"
  # @argument message_id [Required, String] llm-conversation message UUID
  # @argument feedback_message [Optional, String] optional text for dislike
  #
  # @returns {Object} Hash with feedback record
  def create_feedback
    feedback = AiExperiences::ConversationMessageFeedbackService.new(account: @context.root_account).create(
      conversation_id: @conversation.llm_conversation_id,
      message_id: params[:message_id],
      user_id: @current_user.uuid,
      vote: params[:vote],
      feedback_message: params[:feedback_message]
    )
    render json: { feedback: }
  end

  # @API Delete feedback on a conversation message
  #
  # Remove a previously submitted vote (toggling off like/dislike).
  #
  # Ownership: load_conversation gates this action — only the conversation owner
  # or a course manager reaches here. Sub-resource (message_id, feedback_id within
  # the conversation) scoping is delegated to llma.
  #
  # @returns {Object} Success response
  def delete_feedback
    AiExperiences::ConversationMessageFeedbackService.new(account: @context.root_account).delete(
      conversation_id: @conversation.llm_conversation_id,
      message_id: params[:message_id],
      feedback_id: params[:feedback_id]
    )
    render json: { success: true }
  end

  private

  def check_ai_experiences_feature_flag
    unless @context&.feature_enabled?(:ai_experiences)
      render_404
      false
    end
  end

  def rate_limit_config_for(name)
    default = RATE_LIMIT_DEFAULTS.fetch(name)
    limit = Setting.get("ai_experiences.rate_limit.#{name}_daily", default.to_s).to_i
    RateLimitConfig.new(name:, rate_limit: { limit:, period: "day" })
  end

  def require_access_right
    permissions = %i[manage_assignments_add manage_assignments_edit manage_assignments_delete]
    can_manage = @context.grants_any_right?(current_principal, *permissions)

    # Allow if user can manage OR is enrolled in the course
    return if can_manage || @context.grants_right?(current_principal, :read_as_member)

    render_unauthorized_action
    false
  end

  def load_experience
    @experience = AiExperience.find_by(id: params[:ai_experience_id])
    render_404 unless @experience&.course == @context && !@experience.deleted?
  end

  # Security gate for every per-conversation action (show, post_message, destroy,
  # evaluation, create_feedback, delete_feedback). A non-owner non-manager student
  # passing another user's conversation id is rejected here with 404 before any
  # downstream service or controller logic runs — this is the only place the
  # ownership-or-manager rule is enforced for those actions, so changes here
  # affect M-2's IDOR posture. Lock-in tests live in the controller spec under
  # "feedback actor authorization (M-2)".
  def load_conversation
    permissions = %i[manage_assignments_add manage_assignments_edit manage_assignments_delete]
    @conversation = if @context.grants_any_right?(current_principal, *permissions)
                      # Teachers can view any conversation
                      @experience.ai_conversations.find_by(id: params[:id])
                    else
                      # Students can only view their own active conversations
                      @experience.ai_conversations
                                 .active
                                 .for_user(@current_user.id)
                                 .find_by(id: params[:id])
                    end
    render_404 unless @conversation
  end

  def render_404
    respond_to do |format|
      format.html { render status: :not_found, template: "shared/errors/404_message" }
      format.json { render json: { error: "Resource Not Found" }, status: :not_found }
    end
  end
end
