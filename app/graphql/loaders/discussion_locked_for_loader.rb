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
#

class Loaders::DiscussionLockedForLoader < GraphQL::Batch::Loader
  def initialize(current_user:)
    super()
    @current_user = current_user
  end

  def perform(topics)
    return if topics.empty?

    by_shard = topics.group_by(&:shard)

    by_shard.each do |shard, shard_topics|
      shard.activate do
        ActiveRecord::Associations::Preloader.new(
          records: shard_topics,
          associations: [{ assignment: [:quiz, :context] }, :context]
        ).call
        group_contexts = shard_topics.filter_map { |t| t.context if t.context.is_a?(Group) }
        if group_contexts.any?
          ActiveRecord::Associations::Preloader.new(
            records: group_contexts,
            associations: :context
          ).call
        end
        # Include assignments so override preloading reaches graded-discussion overrides that live on the assignment, not the topic.
        DatesOverridable.preload_override_data_for_objects(
          shard_topics + shard_topics.filter_map(&:assignment)
        )
      end
    end

    if @current_user
      courses = topics.filter_map do |t|
        case t.context
        when Course then t.context
        when Group then t.context.context if t.context.context.is_a?(Course)
        end
      end.uniq(&:global_id)
      Course.preload_active_enrollments_for_permissions(@current_user, courses)
    end

    by_shard.each do |shard, shard_topics|
      shard.activate do
        shard_topics.each { |t| fulfill(t, t.locked_for?(@current_user, check_policies: true)) }
      end
    end
  end
end
