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

class Mutations::UpdateStudyNote < Mutations::StudyNoteMutationBase
  argument :highlight_data, GraphQL::Types::JSON, required: false
  argument :id, ID, required: false, prepare: GraphQLHelpers.relay_or_legacy_id_prepare_func("StudyNote")
  argument :reactions, [String], required: false
  argument :redwood_uuid, String, required: false
  argument :user_text, String, required: false

  field :study_note, Types::StudyNoteType, null: true

  def resolve(input:)
    record = find_record!(input)
    check_feature_access!(record.course)

    record.user_text = input[:user_text] if input.key?(:user_text)
    record.reaction = input[:reactions] if input.key?(:reactions)
    record.highlight_data = input[:highlight_data] if input.key?(:highlight_data)

    return errors_for(record) unless record.save

    { study_note: record }
  end
end
