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

class AiConversation < ApplicationRecord
  # Mirrors llma AddMessageDto.text @MaxLength(4000) from PR #259. The cap
  # applies to user-supplied chat messages (students and teacher-preview),
  # never persisted on this row — enforced at the controller boundary and
  # surfaced to the UI via js_env.
  USER_MESSAGE_MAX_LENGTH = 4_000

  belongs_to :root_account, class_name: "Account"
  belongs_to :account
  belongs_to :course
  belongs_to :user
  belongs_to :ai_experience

  validates :llm_conversation_id, presence: true, uniqueness: true
  validates :workflow_state, presence: true, inclusion: { in: %w[active ended completed deleted] }

  scope :for_user, ->(user_id) { where(user_id:) }
  scope :for_course, ->(course_id) { where(course_id:) }
  scope :for_account, ->(account_id) { where(account_id:) }
  scope :for_ai_experience, ->(ai_experience_id) { where(ai_experience_id:) }
  scope :active, -> { where(workflow_state: "active") }
  scope :ended, -> { where(workflow_state: "ended") }
  scope :deleted, -> { where(workflow_state: "deleted") }

  before_create :set_account_associations
  # An authorized but unenrolled user (e.g. a cross-shard Site Admin previewing)
  # can create a conversation without an enrollment ever running
  # associate_with_shard. When their home shard differs from the conversation's
  # shard (the course's shard), switchman stores the user's global id in
  # user_id, but no shadow users row exists there, so fk_rails_faada8ac9a fails.
  # Create the shadow row here — mirrors Enrollment's before_create in the
  # multiple_root_accounts plugin. Idempotent: a no-op for same-shard users and
  # for enrolled users (enrollment already associated them).
  before_create -> { user.associate_with_shard(shard) }

  def delete
    return false if deleted?

    update_column(:workflow_state, "deleted")
  end

  def end_session!
    return false if deleted?

    update_column(:workflow_state, "ended")
  end

  def mark_objectives_met!
    update_column(:all_objectives_met, true)
  end

  def active?
    workflow_state == "active"
  end

  def ended?
    workflow_state == "ended"
  end

  def completed?
    all_objectives_met?
  end

  def deleted?
    workflow_state == "deleted"
  end

  private

  def set_account_associations
    if course.present?
      self.root_account_id ||= course.root_account_id
      self.account_id ||= course.account_id
    end
  end
end
