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
class StudyNote < ApplicationRecord
  include Canvas::SoftDeletable

  NOTES_PER_COURSE_LIMIT = 1000
  NOTES_PER_OBJECT_LIMIT = 100

  belongs_to :user
  belongs_to :course
  belongs_to :root_account, class_name: "Account"
  belongs_to :learning_object,
             polymorphic: [:wiki_page, :assignment, { quiz: "Quizzes::Quiz" }],
             separate_columns: true,
             optional: false

  validates :user_id, presence: true
  validates :course_id, presence: true
  validates :root_account_id, presence: true
  validates :workflow_state, presence: true
  validates :reaction, length: { maximum: 20 }, allow_nil: true
  validates :redwood_uuid, uniqueness: true, allow_nil: true
  validates :user_text, length: { maximum: maximum_text_length, too_long: ->(_object, data) { t("Note text is too long (%{count} character maximum)", count: data[:count]) } }, allow_nil: true
  validate :highlight_data_size
  validate :note_limit_not_exceeded, on: :create
  validate :note_limit_per_object_not_exceeded, on: :create

  scope :for_user, ->(user) { where(user:) }
  scope :for_course, ->(course) { where(course:) }
  scope :for_object, lambda { |type, id|
    case type
    when "WikiPage" then where(wiki_page_id: id)
    when "Assignment" then where(assignment_id: id)
    when "Quizzes::Quiz" then where(quiz_id: id)
    else none
    end
  }
  scope :with_reactions, ->(reactions) { where("reaction && ARRAY[?]::varchar[]", reactions) }

  set_policy do
    given { |principal| user == principal&.user }
    can :read and can :update and can :delete
  end

  private

  def highlight_data_size
    return if highlight_data.blank?

    if highlight_data.to_json.bytesize > self.class.maximum_text_length
      errors.add(:base, t("The selected text is too large to highlight"))
    end
  end

  def note_limit_not_exceeded
    return unless user_id && course_id

    count = StudyNote.active.where(user_id:, course_id:).count
    errors.add(:base, t("Note limit of %{count} per course reached", count: NOTES_PER_COURSE_LIMIT)) if count >= NOTES_PER_COURSE_LIMIT
  end

  def note_limit_per_object_not_exceeded
    return unless user_id && (wiki_page_id || assignment_id || quiz_id)
    # Notes migrated from Redwood carry a redwood_uuid and predate this cap;
    # Redwood allowed up to 1000 notes per object, so exempt them to migrate intact.
    return if redwood_uuid.present?

    count = StudyNote.active.where(user_id:, wiki_page_id:, assignment_id:, quiz_id:).count
    errors.add(:base, t("Note limit of %{count} per page reached", count: NOTES_PER_OBJECT_LIMIT)) if count >= NOTES_PER_OBJECT_LIMIT
  end
end
