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

class Mutations::StudyNoteMutationBase < Mutations::BaseMutation
  protected

  def find_record!(input)
    unless input[:id] || input[:redwood_uuid]
      raise GraphQL::ExecutionError, I18n.t("Must provide id or redwoodUuid")
    end

    scope = StudyNote.active.joins(:course).merge(Course.active).for_user(current_user)
    record = if input[:id]
               scope.find_by(id: input[:id])
             else
               scope.find_by(redwood_uuid: input[:redwood_uuid])
             end

    raise GraphQL::ExecutionError, I18n.t("Study note not found") if record.nil?

    record
  end

  def check_feature_access!(course)
    unless course.notebook_accessible?
      raise GraphQL::ExecutionError, I18n.t("notebook feature flag is not enabled")
    end
  end
end
