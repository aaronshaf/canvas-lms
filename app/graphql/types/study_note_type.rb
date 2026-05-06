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

module Types
  class StudyNoteType < ApplicationObjectType
    description "A student note attached to a learning object"

    implements GraphQL::Types::Relay::Node
    implements Interfaces::LegacyIDInterface
    implements Interfaces::TimestampInterface

    connection_type_class TotalCountConnection

    def self.authorized?(record, context)
      super && record.grants_right?(context[:current_principal], :read)
    end

    global_id_field :id

    field :course_id, ID, null: false
    field :highlight_data, GraphQL::Types::JSON, null: true
    field :learning_object_id, String, null: false
    field :learning_object_type, "Types::LearningObjectTypeType", null: false
    field :reactions, [String], null: false, method: :reaction
    # temporary field for dual-write phase; removed in LX-4105 cleanup
    field :redwood_uuid, String, null: true
    field :user_id, ID, null: false
    field :user_text, String, null: true

    def learning_object_type
      if object.wiki_page_id
        "WikiPage"
      elsif object.assignment_id
        "Assignment"
      elsif object.quiz_id
        "Quizzes::Quiz"
      end
    end

    def learning_object_id
      (object.wiki_page_id || object.assignment_id || object.quiz_id)&.to_s
    end
  end
end
