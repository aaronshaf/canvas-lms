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

class AiExperience < ApplicationRecord
  belongs_to :root_account, class_name: "Account"
  belongs_to :account
  belongs_to :course

  has_many :ai_conversations, dependent: :destroy
  has_many :ai_experience_context_files, dependent: :destroy
  has_many :ai_experience_evaluation_metrics, -> { order(:position) }, dependent: :destroy
  # Excludes soft-deleted attachments. Note: if an attachment is deleted in Canvas
  # after being associated, the join record remains but the file is silently omitted
  # from context_data. The llm-conversation service JSONB will contain stale data
  # until the next explicit save of this AiExperience — this is intentional to avoid
  # synchronous service calls in destroy callbacks.
  has_many :context_files,
           -> { where.not(attachments: { file_state: "deleted" }) },
           through: :ai_experience_context_files,
           source: :attachment,
           class_name: "Attachment"

  # Set by AiExperiencesController before save so authorize_context_file_ids
  # can verify pending attachments against the acting user. Service-layer callers
  # that legitimately bypass user auth (jobs, fixtures) leave this nil.
  attr_accessor :current_user, :current_session

  # Set by the controller when evaluation_metrics are submitted. Each element is
  # a hash with keys: key (string), enabled (bool), visible_to_learners (bool).
  attr_reader :pending_evaluation_metrics

  # Length caps mirror llma's DTO limits (PR #259) so oversized payloads are
  # rejected at save time, before any upstream call. See AIEXP-004 / M-8.
  TEACHER_AUTHORED_FIELD_MAX = 10_000

  validates :title, presence: true, length: { maximum: 255 }
  validates :description, length: { maximum: TEACHER_AUTHORED_FIELD_MAX }, allow_nil: true
  validates :learning_objective, presence: true, length: { maximum: TEACHER_AUTHORED_FIELD_MAX }
  validates :pedagogical_guidance, presence: true, length: { maximum: TEACHER_AUTHORED_FIELD_MAX }
  validates :facts, length: { maximum: TEACHER_AUTHORED_FIELD_MAX }, allow_nil: true
  validates :workflow_state, presence: true, inclusion: { in: %w[unpublished published deleted] }
  validates :context_index_status, presence: true, inclusion: { in: %w[not_started in_progress completed failed] }
  validate :unpublish_ok?, if: -> { will_save_change_to_workflow_state?(to: "unpublished") }
  validate :publish_ok?, if: -> { will_save_change_to_workflow_state?(to: "published") }
  validate :authorize_context_file_ids, if: :pending_context_file_ids?
  validate :evaluation_metrics_count_within_limit, if: :pending_evaluation_metrics?

  scope :published, -> { where(workflow_state: "published") }
  scope :unpublished, -> { where(workflow_state: "unpublished") }
  scope :active, -> { where.not(workflow_state: "deleted") }
  scope :for_course, ->(course_id) { where(course_id:) }

  set_policy do
    # Students can read published experiences if they're enrolled in the course
    given do |user, session|
      published? && course.grants_right?(user, session, :read_as_member)
    end
    can :read

    # Teachers/TAs/admins can read any experience (published or unpublished)
    given do |user, session|
      course.grants_any_right?(user, session, :manage_assignments_add, :manage_assignments_edit, :manage_assignments_delete)
    end
    can :read and can :create and can :update and can :delete

    # Only teachers/TAs/admins can manage experiences
    given do |user, session|
      course.grants_any_right?(user, session, :manage_assignments_add, :manage_assignments_edit, :manage_assignments_delete)
    end
    can :manage
  end

  # Manage conversation_context lifecycle in llm-conversation service
  before_create :set_account_associations
  after_create :create_conversation_context
  before_destroy :delete_conversation_context
  # sync_context_files must run before update_conversation_context so
  # files are persisted before the service is notified of changes.
  after_save :sync_context_files, if: :pending_context_file_ids?
  after_save :sync_evaluation_metrics, if: :pending_evaluation_metrics?
  after_save :update_conversation_context

  def context_file_ids=(ids)
    @pending_context_file_ids = Array(ids).map(&:to_s)
  end

  def evaluation_metrics=(metrics)
    @pending_evaluation_metrics = Array(metrics)
  end

  def delete
    return false if deleted?

    update_column(:workflow_state, "deleted")
  end

  def publish!
    return false if deleted?

    update_column(:workflow_state, "published")
  end

  def unpublish!
    return false if deleted?

    update_column(:workflow_state, "unpublished")
  end

  def published?
    workflow_state == "published"
  end

  def unpublished?
    workflow_state == "unpublished"
  end

  def deleted?
    workflow_state == "deleted"
  end

  def can_unpublish?
    return true if new_record?
    return @can_unpublish unless @can_unpublish.nil?

    @can_unpublish = !student_conversations? && indexing_allows_publish_changes?
  end

  def can_publish?
    return true if new_record?
    return @can_publish unless @can_publish.nil?

    # Publishing is only restricted by indexing status, not by student conversations
    @can_publish = indexing_allows_publish_changes?
  end

  attr_writer :can_unpublish, :can_publish

  def indexing_allows_publish_changes?
    return true if ai_experience_context_files.empty?

    context_index_status == "completed"
  end

  def student_conversations?
    # Single efficient query - checks if any conversations exist from students
    AiConversation
      .joins("INNER JOIN #{Enrollment.quoted_table_name} ON enrollments.user_id = ai_conversations.user_id")
      .where(ai_conversations: { ai_experience_id: id })
      .where.not(ai_conversations: { workflow_state: "deleted" })
      .where(enrollments: {
               course_id:,
               type: ["StudentEnrollment", "StudentViewEnrollment"]
             })
      .where.not(enrollments: { workflow_state: ["deleted", "rejected"] })
      .exists?
  end

  MAX_EVALUATION_METRICS = 5

  private

  def set_account_associations
    if course.present?
      self.root_account_id ||= course.root_account_id
      self.account_id ||= course.account_id
    end
  end

  def create_conversation_context
    AiExperiences::ConversationContextService.new(account: course.root_account).create(ai_experience: self)
  rescue LlmConversation::Errors::ConversationError => e
    Rails.logger.error("Failed to create conversation context for AiExperience #{id}: #{e.message}")
    # Don't fail the AiExperience creation if context creation fails
  end

  def pending_context_file_ids?
    !@pending_context_file_ids.nil?
  end

  def pending_evaluation_metrics?
    !@pending_evaluation_metrics.nil?
  end

  def evaluation_metrics_count_within_limit
    return if @pending_evaluation_metrics.length <= MAX_EVALUATION_METRICS

    errors.add(:evaluation_metrics, "cannot exceed #{MAX_EVALUATION_METRICS}")
  end

  def sync_evaluation_metrics
    incoming = @pending_evaluation_metrics.each_with_index.map do |m, i|
      { name: m[:name] || m["name"],
        description: m[:description] || m["description"],
        enabled: m.fetch(:enabled, m.fetch("enabled", true)),
        visible_to_learners: m.fetch(:visible_to_learners, m.fetch("visible_to_learners", false)),
        position: i + 1 }
    end

    ai_experience_evaluation_metrics.delete_all
    incoming.each { |attrs| ai_experience_evaluation_metrics.create!(attrs.merge(root_account_id:)) }
    @evaluation_metrics_changed = true
    @pending_evaluation_metrics = nil
  end

  # Belt-and-suspenders for the controller's authorize_context_file_ids! check.
  # Skips when current_user is nil (preserves service/job/fixture callers that do
  # not have a user context). When the controller sets current_user, every pending
  # attachment must belong to this experience's course (and not be soft-deleted).
  # Per-attachment :read is intentionally not checked here — the controller's
  # require_manage_rights already gates the request, and re-checking would also
  # iterate hydrated AR objects (one grants_right? call per row).
  def authorize_context_file_ids
    return if current_user.nil?

    submitted_ids = @pending_context_file_ids.map(&:to_i).reject(&:zero?).uniq
    return if submitted_ids.empty?

    authorized_ids = course.attachments
                           .not_deleted
                           .where(id: submitted_ids)
                           .pluck(:id)

    return if (submitted_ids - authorized_ids).empty?

    errors.add(:context_file_ids, I18n.t("One or more selected files cannot be accessed"))
  end

  def sync_context_files
    incoming_ids = @pending_context_file_ids.map(&:to_i)
    current_ids = ai_experience_context_files.order(:position).pluck(:attachment_id)

    @context_files_changed = incoming_ids != current_ids

    if @context_files_changed
      removed_ids = current_ids - incoming_ids
      added_ids = incoming_ids - current_ids

      if removed_ids.any?
        removed_context_files = ai_experience_context_files.where(attachment_id: removed_ids).to_a
        remove_documents_from_llm_service(removed_context_files)
        ai_experience_context_files.where(attachment_id: removed_ids).destroy_all
      end

      added_context_file_ids = added_ids.map { |attachment_id| ai_experience_context_files.create!(attachment_id:).id }

      # Re-sync positions to match the incoming order
      incoming_ids.each_with_index do |attachment_id, idx|
        ai_experience_context_files.find_by(attachment_id:)&.update_column(:position, idx + 1)
      end

      index_new_context_files(added_context_file_ids)
    end
  rescue LlmConversation::Errors::ConversationError => e
    errors.add(:base, e.user_message)
    raise ActiveRecord::RecordInvalid, self
  ensure
    @pending_context_file_ids = nil
  end

  def index_new_context_files(added_context_file_ids)
    return if added_context_file_ids.blank?
    return unless llm_conversation_context_id.present?

    AiExperiences::ConversationContextDocumentsService.new(account: course.root_account).trigger_indexing(ai_experience: self, context_file_ids: added_context_file_ids)
  end

  def update_conversation_context
    return if previously_new_record? && !@context_files_changed
    return unless should_update_context?

    AiExperiences::ConversationContextService.new(account: course.root_account).update(ai_experience: self)
  rescue LlmConversation::Errors::ConversationError => e
    Rails.logger.error("Failed to update conversation context for AiExperience #{id}: #{e.message}")
  end

  def should_update_context?
    return false unless llm_conversation_context_id.present?

    context_changed = saved_change_to_pedagogical_guidance? || saved_change_to_facts? || saved_change_to_learning_objective?
    context_changed ||= @context_files_changed.present?
    context_changed ||= @evaluation_metrics_changed.present?
    @context_files_changed = nil
    @evaluation_metrics_changed = nil

    context_changed
  end

  def delete_conversation_context
    AiExperiences::ConversationContextService.new(account: course.root_account).delete(ai_experience: self)
  rescue LlmConversation::Errors::ConversationError => e
    Rails.logger.error("Failed to delete conversation context for AiExperience #{id}: #{e.message}")
    # Don't fail the AiExperience deletion if context deletion fails
  end

  def remove_documents_from_llm_service(context_files)
    return unless llm_conversation_context_id.present?

    AiExperiences::ConversationContextDocumentsService.new(account: course.root_account).remove_documents(ai_experience: self, context_files:)
  end

  def unpublish_ok?
    return true if can_unpublish?

    if !indexing_allows_publish_changes?
      errors.add :workflow_state, I18n.t("Cannot unpublish while source files are still processing")
    elsif student_conversations?
      errors.add :workflow_state, I18n.t("Cannot unpublish if students have started conversations")
    end
    false
  end

  def publish_ok?
    return true if can_publish?

    errors.add :workflow_state, I18n.t("Cannot publish while source files are still processing")
    false
  end
end
