# frozen_string_literal: true

#
# Copyright (C) 2024 - present Instructure, Inc.
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

class Checkpoints::DiscussionCheckpointDeleterService < ApplicationService
  def initialize(discussion_topic:)
    super()
    @discussion_topic = discussion_topic
    @assignment = discussion_topic.assignment
  end

  def call
    # no need to validate the flag here, we will always allow checkpoint deletion
    checkpoints = find_checkpoints
    checkpoints.each do |checkpoint|
      checkpoint.active_assignment_overrides.destroy_all
    end

    @assignment.active_assignment_overrides.destroy_all

    checkpoints.destroy_all

    update_assignment_and_discussion
    mark_downstream_changes

    true
  end

  private

  def find_checkpoints
    checkpoints = @assignment.sub_assignments

    raise Checkpoints::NoCheckpointsFoundError, "Checkpoints not found" unless checkpoints.any?

    checkpoints
  end

  def update_assignment_and_discussion
    @assignment.update!(has_sub_assignments: false)
    @discussion_topic.update!(reply_to_entry_required_count: 0)
  end

  def mark_downstream_changes
    return unless @discussion_topic.is_child_content?

    MasterCourses::ChildContentTag.transaction do
      child_tag = MasterCourses::ChildContentTag.where(content: @discussion_topic).lock.first
      return unless child_tag

      unless child_tag.downstream_changes.include?("has_sub_assignments")
        child_tag.downstream_changes << "has_sub_assignments"
        child_tag.save!
      end
    end
  end
end
