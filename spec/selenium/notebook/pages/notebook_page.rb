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
    '[data-testid="notebook-button"]'
  end

  def notebook_panel_selector
    '[data-testid="notebook-panel"]'
  end

  def notes_grid_selector
    '[data-testid="notes-grid"]'
  end

  def note_card_selector
    '[data-testid="note-card"]'
  end

  def note_card_link_selector(note_id)
    # Anchor with $= (ends-with), not *= (contains) — note_id=2 would otherwise
    # match note_id=20, note_id=215, etc., and f() returns the first hit.
    %(a[href$="note_id=#{note_id}"])
  end

  #------------------------------ Elements ------------------------------
  def wiki_page_content
    f(wiki_page_content_selector)
  end

  def notebook_button
    f(notebook_button_selector)
  end

  def notebook_panel
    f(notebook_panel_selector)
  end

  def notes_grid
    f(notes_grid_selector)
  end

  def note_cards
    ff(note_card_selector)
  end

  def note_card_link(note_id)
    f(note_card_link_selector(note_id))
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
end
