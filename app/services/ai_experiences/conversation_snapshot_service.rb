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

module AiExperiences
  class ConversationSnapshotService
    # Snapshot counts from a pre-queried array of latest conversations (one row
    # per student) plus the total student count. Callers scope the conversations
    # to the student set, so students without a conversation are simply
    # student_count minus the rows present.
    def self.counts_from_conversations(latest_conversations, student_count)
      {
        completed: latest_conversations.count(&:completed?),
        in_progress: latest_conversations.count { |c| c.active? && !c.completed? },
        not_started: student_count - latest_conversations.length
      }
    end

    # One batched query across all experience IDs.
    # Returns { experience_id => { completed:, in_progress:, not_started: } }
    def self.batch_snapshots(experience_ids:, student_ids:)
      return {} if experience_ids.empty? || student_ids.empty?

      latest_convs = AiConversation
                     .where(ai_experience_id: experience_ids, user_id: student_ids)
                     .where.not(workflow_state: "deleted")
                     .select("DISTINCT ON (ai_experience_id, user_id) *")
                     .order(:ai_experience_id, :user_id, updated_at: :desc)
                     .to_a

      by_experience = latest_convs.group_by(&:ai_experience_id)
      experience_ids.index_with do |exp_id|
        counts_from_conversations(by_experience[exp_id] || [], student_ids.size)
      end
    end
  end
end
