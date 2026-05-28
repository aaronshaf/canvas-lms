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

module NotebookCommon
  def notebook_student_setup
    @course = course_factory(active_all: true, course_name: "Course 1")
    @student = user_factory(active_all: true, name: "Jane Brown")
    @course.enroll_student(@student, enrollment_state: "active")

    Account.default.enable_feature!(:notebook)
    @page_a = @course.wiki_pages.create!(
      title: "Photosynthesis",
      body: "<p>Plants convert light into chemical energy.</p>"
    )
    @page_b = @course.wiki_pages.create!(
      title: "Cellular Respiration",
      body: "<p>Cells break down glucose to release energy.</p>"
    )
  end

  # Reaction values are the upstream REACTION_TYPE enum strings stored in the DB
  # (`Important`, `Confusing`). The widget renders `Confusing` as the "Unclear"
  # pill via I18n.t('Unclear') in ui/shared/notebook/react/notebookTranslations.ts.
  def create_studynote_with_usertext
    @studynote_a = StudyNote.create!(
      user: @student,
      course: @course,
      root_account: @course.root_account,
      learning_object: @page_a,
      user_text: "first note",
      reaction: ["Important"],
      workflow_state: "active",
      highlight_data: {
        selectedText: "light",
        textPosition: { "end" => 56, "start" => 51 },
        range: { "endOffset" => 20, "startOffset" => 15, "endContainer" => "/p[1]", "startContainer" => "/p[1]" },
        pageLastModifiedAt: @page_a.updated_at.iso8601
      }
    )
    @studynote_b = StudyNote.create!(
      user: @student,
      course: @course,
      root_account: @course.root_account,
      learning_object: @page_b,
      user_text: "second note",
      reaction: ["Confusing"],
      workflow_state: "active",
      highlight_data: {
        selectedText: "glucose",
        textPosition: { "end" => 66, "start" => 59 },
        range: { "endOffset" => 24, "startOffset" => 17, "endContainer" => "/p[1]", "startContainer" => "/p[1]" },
        pageLastModifiedAt: @page_b.updated_at.iso8601
      }
    )
  end
end
