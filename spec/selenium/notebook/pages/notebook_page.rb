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

require_relative "../../common"

module NotebookPage
  #------------------------------ Selectors -----------------------------
  def wiki_page_content_selector
    "#wiki_page_show"
  end

  def notebook_button_selector
    '#notebook_mount_point [data-testid="notebook-button"]'
  end

  def wiki_page_highlight_content_selector(note_id)
    "span.highlight-content[data-highlight-id='#{note_id}']"
  end

  def notebook_panel_selector
    '[data-testid="notebook-panel"]'
  end

  def notes_grid_selector
    '[data-testid="notes-grid"]'
  end

  def all_note_cards_selector
    'div[data-testid^="note-card-"]'
  end

  def note_card_selector(note_id)
    "div[data-testid='note-card-#{note_id}']"
  end

  def note_card_edit_button_selector(note_id)
    "button[data-testid='note-card-#{note_id}-edit']"
  end

  def note_card_text_area_selector(note_id)
    "div[data-testid='note-card-#{note_id}'] textarea"
  end

  def note_card_text_save_button_selector(note_id)
    "button[data-testid='note-card-#{note_id}-save']"
  end

  def note_card_text_cancel_button_selector(note_id)
    "button[data-testid='note-card-#{note_id}-cancel']"
  end

  def note_card_delete_button_selector(note_id)
    "button[data-testid='note-card-#{note_id}-delete']"
  end

  def note_card_confirm_delete_button_selector(note_id)
    "button[data-testid='note-card-#{note_id}-confirm-delete']"
  end

  def note_card_link_selector(note_id)
    # Anchor with $= (ends-with), not *= (contains) — note_id=2 would otherwise
    # match note_id=20, note_id=215, etc., and f() returns the first hit.
    %(a[href$="note_id=#{note_id}"])
  end

  def notebook_index_filter_selector
    "#notebook_index_mount_point input[role='combobox']"
  end

  # `notes-pagination` testid and `data-direction` attr are produced by the
  # upstream @instructure/platform-notebook package, not Canvas source — a
  # package rename would break these selectors with no in-repo signal.
  def notebook_index_pagination_selector
    "span[data-testid='notes-pagination']"
  end

  def notebook_index_pagination_button_selector(direction)
    "#{notebook_index_pagination_selector} button[data-direction='#{direction}']"
  end

  def left_nav_container_selector
    "div#sticky-container ul#section-tabs"
  end

  def access_denied_message_selector
    "#unauthorized_message"
  end

  def observed_student_label_selector
    "div[data-testid='observed-student-label']"
  end

  def notebook_index_heading_selector
    "#notebook_index_mount_point h3"
  end

  def notebook_total_notes_count_selector
    "#notebook_index_mount_point [data-testid='notebook-total-results']"
  end

  #------------------------------ Elements ------------------------------
  def wiki_page_content
    f(wiki_page_content_selector)
  end

  def notebook_button
    f(notebook_button_selector)
  end

  def wiki_page_highlight_content(note_id)
    f(wiki_page_highlight_content_selector(note_id))
  end

  def notebook_panel
    f(notebook_panel_selector)
  end

  def notes_grid
    f(notes_grid_selector)
  end

  def all_note_cards
    ff(all_note_cards_selector)
  end

  def note_card(note_id)
    f(note_card_selector(note_id))
  end

  def note_card_edit_button(note_id)
    f(note_card_edit_button_selector(note_id))
  end

  def note_card_text_area(note_id)
    f(note_card_text_area_selector(note_id))
  end

  def note_card_text_save_button(note_id)
    f(note_card_text_save_button_selector(note_id))
  end

  def note_card_text_cancel_button(note_id)
    f(note_card_text_cancel_button_selector(note_id))
  end

  def note_card_delete_button(note_id)
    f(note_card_delete_button_selector(note_id))
  end

  def note_card_confirm_delete_button(note_id)
    f(note_card_confirm_delete_button_selector(note_id))
  end

  def note_card_link(note_id)
    f(note_card_link_selector(note_id))
  end

  def notebook_index_filter
    f(notebook_index_filter_selector)
  end

  def notebook_index_pagination
    f(notebook_index_pagination_selector)
  end

  def notebook_index_pagination_button(direction)
    f(notebook_index_pagination_button_selector(direction))
  end

  def left_nav_container
    f(left_nav_container_selector)
  end

  def access_denied_message
    f(access_denied_message_selector)
  end

  def observed_student_label
    f(observed_student_label_selector)
  end

  def notebook_index_heading
    f(notebook_index_heading_selector)
  end

  def notebook_total_notes_count
    f(notebook_total_notes_count_selector)
  end

  #------------------------------ Actions -------------------------------
  def visit_wiki_page(course, wiki_page)
    get "/courses/#{course.id}/pages/#{wiki_page.url}"
  end

  def visit_notebook_index(course)
    get "/courses/#{course.id}/notebook"
  end

  def open_notebook_panel
    expect(notebook_button).to be_displayed
    notebook_button.click
    expect(notebook_panel).to be_displayed
  end

  def click_edit_user_text_button(study_note)
    expect(note_card_edit_button(study_note.id)).to be_displayed
    note_card_edit_button(study_note.id).click
  end

  def fill_in_user_text(study_note, text)
    expect(note_card_text_area(study_note.id)).to be_displayed
    note_card_text_area(study_note.id).send_keys(text)
  end

  def click_save_user_text_button(study_note)
    expect(note_card_text_save_button(study_note.id)).to be_displayed
    note_card_text_save_button(study_note.id).click
  end

  def click_cancel_edit_user_text_button(study_note)
    expect(note_card_text_cancel_button(study_note.id)).to be_displayed
    note_card_text_cancel_button(study_note.id).click
  end

  def delete_study_note(study_note)
    expect(note_card_delete_button(study_note.id)).to be_displayed
    note_card_delete_button(study_note.id).click
    expect(note_card_confirm_delete_button(study_note.id)).to be_displayed
    note_card_confirm_delete_button(study_note.id).click
  end

  def filter_notes_by(reaction)
    expect(notebook_index_filter).to be_displayed
    case reaction
    when :all
      click_INSTUI_Select_option(notebook_index_filter_selector, "All notes")
    when :important
      click_INSTUI_Select_option(notebook_index_filter_selector, "Important")
    when :unclear
      click_INSTUI_Select_option(notebook_index_filter_selector, "Unclear")
    else
      raise ArgumentError, "Unsupported filter option: #{reaction}"
    end
    wait_for_ajaximations
  end

  def assert_note_card_count(expected_count)
    expect(notes_grid).to be_displayed
    expect(all_note_cards.size).to eq(expected_count)
  end

  def control_pagination(direction)
    expect(notebook_index_pagination_button(direction)).to be_displayed
    notebook_index_pagination_button(direction).click
    wait_for_ajaximations
  end

  def verify_observer_session(student)
    get "/"
    wait_for_ajaximations
    expect(observed_student_label).to be_displayed
    expect(observed_student_label.text).to include(student.name)
  end
end
