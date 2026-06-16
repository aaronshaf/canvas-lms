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
  def page_size = 24
  # enough to fill 2 full pages and partially fill a 3rd, ensuring pagination controls appear
  def seed_note_count = (page_size * 2) + 2

  # Hardcoded highlight_data for test notes
  HIGHLIGHT_DATA_PAGE_A = {
    selectedText: "light",
    textPosition: { "end" => 56, "start" => 51 },
    range: { "endOffset" => 20, "startOffset" => 15, "endContainer" => "/p[1]", "startContainer" => "/p[1]" }
  }.freeze

  HIGHLIGHT_DATA_PAGE_B = {
    selectedText: "glucose",
    textPosition: { "end" => 66, "start" => 59 },
    range: { "endOffset" => 24, "startOffset" => 17, "endContainer" => "/p[1]", "startContainer" => "/p[1]" }
  }.freeze

  HIGHLIGHT_DATA_PAGE_A_NO_TEXT = {
    selectedText: "energy",
    textPosition: { "end" => 77, "start" => 71 },
    range: { "endOffset" => 41, "startOffset" => 35, "endContainer" => "/p[1]", "startContainer" => "/p[1]" }
  }.freeze

  LONG_PARA_TEXT = <<~TEXT
    The electromagnetic spectrum encompasses all forms of radiation propagating as oscillating electric and magnetic fields. At one extreme lie radio waves with wavelengths spanning kilometers, used in broadcasting, radar, and mobile communications. Microwaves overlap with radio at shorter wavelengths and drive molecular rotation in food heating and astronomical observations of cold interstellar clouds. Infrared radiation, perceived as heat, is emitted by all objects above absolute zero and forms the basis of thermal imaging, night vision, and remote sensing satellites monitoring land surface temperatures. The narrow visible band from roughly 380 to 700 nanometers represents the portion evolution tuned vertebrate eyes to detect, corresponding to peak solar emission at Earth's surface. Ultraviolet radiation spans three subregions: UV-A penetrates deep into skin causing tanning and long-term DNA damage; UV-B triggers vitamin D synthesis and acute sunburn; UV-C is almost entirely absorbed by stratospheric ozone and molecular oxygen before reaching the surface. X-rays penetrate soft tissue but are attenuated by denser bone and metal structures, enabling medical radiography, computed tomography, and materials inspection. Gamma rays, emitted during nuclear decay and some cosmic processes, carry sufficient energy to ionize matter and are used in cancer radiotherapy and positron emission tomography. Astronomers deploy telescopes sensitive to every spectral window, from kilometer-wavelength radio dishes to orbiting gamma-ray observatories, to assemble a complete picture of stellar lifecycles, black hole accretion, and the large-scale structure of the cosmos.
  TEXT

  def notebook_student_setup
    @course = course_factory(active_all: true, course_name: "Course 1")
    @student = user_factory(active_all: true, name: "Jane Brown")
    @course.enroll_student(@student, enrollment_state: "active")

    Account.default.enable_feature!(:notebook)
    @page_a = @course.wiki_pages.create!(
      title: "Photosynthesis",
      body: "<p>Plants convert light into chemical energy.</p>",
      workflow_state: "active",
      user: @teacher
    )
    @page_b = @course.wiki_pages.create!(
      title: "Cellular Respiration",
      body: "<p>Cells break down glucose to release energy.</p>",
      workflow_state: "active",
      user: @teacher
    )

    create_studynote_with_usertext(@student)
  end

  def notebook_empty_student_setup
    @student_no_note = user_factory(active_all: true, name: "Chris Green")
    @course.enroll_student(@student_no_note, enrollment_state: "active")

    Account.default.enable_feature!(:notebook)
  end

  def observer_setup
    @observer = user_factory(name: "Observer", active_all: true)
    @course.enroll_user(@observer, "ObserverEnrollment", { allow_multiple_enrollments: true, associated_user_id: @student })
  end

  # Optional reaction filter:
  #   create_studynote_with_usertext(@student)           # Important + Confusing
  #   create_studynote_with_usertext(@student, :important)  # 2x Important
  #   create_studynote_with_usertext(@student, :confusing)  # 2x Confusing
  def create_studynote_with_usertext(student, reaction_filter = nil)
    reactions = determine_reactions(reaction_filter)

    @studynote_a = create_study_note(student, @page_a, reactions[0], HIGHLIGHT_DATA_PAGE_A, user_text: "first note")
    @studynote_b = create_study_note(student, @page_b, reactions[1], HIGHLIGHT_DATA_PAGE_B, user_text: "second note")
  end

  def create_studynote_without_usertext
    @studynote_a_no_text = create_study_note(@student, @page_a, ["Confusing"], HIGHLIGHT_DATA_PAGE_A_NO_TEXT)
  end

  def notebook_pagination_setup
    long_wiki = create_long_wiki_page
    all_slots = build_selection_slots(LONG_PARA_TEXT, 17)
    seed_notes(long_wiki, all_slots)
  end

  def determine_reactions(reaction_filter)
    # DB stores reactions as: `Important` or `Confusing`
    # Note: UI displays `Confusing` as "Unclear"
    case reaction_filter
    when :important
      [["Important"], ["Important"]]
    when :unclear
      [["Confusing"], ["Confusing"]]
    else
      # Default: one Important, one Confusing
      [["Important"], ["Confusing"]]
    end
  end

  def create_study_note(student, page, reaction, highlight_data, user_text: nil)
    StudyNote.create!(
      user: student,
      course: @course,
      root_account: @course.root_account,
      learning_object: page,
      user_text:,
      reaction:,
      workflow_state: "active",
      highlight_data: highlight_data.merge(pageLastModifiedAt: page.updated_at.iso8601)
    )
  end

  def create_long_wiki_page
    @course.wiki_pages.create!(
      title: "longer wiki page with lots of studynotes",
      body: "<p>#{LONG_PARA_TEXT}</p>",
      workflow_state: "active",
      user: @teacher
    )
  end

  def build_selection_slots(text, selection_length)
    0.step(text.length - selection_length, selection_length).map do |offset|
      {
        selected_text: text[offset, selection_length],
        range: {
          startContainer: "/p[1]",
          endContainer: "/p[1]",
          startOffset: offset,
          endOffset: offset + selection_length
        },
        text_position: { start: offset, end: offset + selection_length }
      }
    end
  end

  def seed_notes(long_wiki, all_slots)
    reactions = [["Important"], ["Confusing"]]

    all_slots.first(seed_note_count).each_with_index do |slot, i|
      StudyNote.create!(
        user: @student,
        course: @course,
        root_account: @course.root_account,
        learning_object: long_wiki,
        user_text: "volume note #{i + 1}",
        reaction: reactions[i % 2],
        workflow_state: "active",
        highlight_data: {
          selectedText: slot[:selected_text],
          textPosition: slot[:text_position],
          range: slot[:range],
          pageLastModifiedAt: long_wiki.updated_at.iso8601
        }
      )
    end
  end
end
