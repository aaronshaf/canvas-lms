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

class Mutations::CreateStudyNote < Mutations::StudyNoteMutationBase
  argument :course_id, ID, required: true, prepare: GraphQLHelpers.relay_or_legacy_id_prepare_func("Course")
  argument :highlight_data, GraphQL::Types::JSON, required: false
  argument :learning_object_id, String, required: true
  argument :learning_object_type, -> { Types::LearningObjectTypeType }, required: true
  argument :reactions, [String], required: false
  argument :redwood_uuid, String, required: false
  argument :user_text, String, required: false

  field :study_note, Types::StudyNoteType, null: true

  def resolve(input:)
    course = Course.active.find_by(id: input[:course_id])
    raise GraphQL::ExecutionError, I18n.t("Course not found") unless course

    check_feature_access!(course)
    raise GraphQL::ExecutionError, I18n.t("User is not a student of this course") unless course.user_is_student?(current_user)

    record = StudyNote.new(
      course:,
      user: current_user,
      root_account: course.root_account,
      **learning_object_attrs(course, input[:learning_object_type], input[:learning_object_id]),
      user_text: input[:user_text],
      reaction: input[:reactions] || [],
      highlight_data: input[:highlight_data] || {},
      redwood_uuid: input[:redwood_uuid]
    )

    return errors_for(record) unless record.save

    { study_note: record }
  end

  private

  def learning_object_attrs(course, type, id)
    lo = case type
         when "WikiPage" then course.wiki_pages.active.find_by(id:)
         when "Assignment" then course.assignments.active.find_by(id:)
         when "Quizzes::Quiz" then course.quizzes.active.find_by(id:)
         end
    raise GraphQL::ExecutionError, I18n.t("Learning object not found") unless lo

    verify_authorized_action!(lo, :read)
    case type
    when "WikiPage" then { wiki_page_id: lo.id }
    when "Assignment" then { assignment_id: lo.id }
    when "Quizzes::Quiz" then { quiz_id: lo.id }
    end
  end
end
