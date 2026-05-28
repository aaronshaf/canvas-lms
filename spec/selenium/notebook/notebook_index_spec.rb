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

require_relative "../common"
require_relative "pages/notebook_page"
require_relative "../helpers/notebook_common"

describe "notebook index page" do
  include_context "in-process server selenium tests"
  include NotebookPage
  include NotebookCommon

  before :once do
    notebook_student_setup
    create_studynote_with_usertext
  end

  before do
    user_session(@student)
  end

  it "renders the student's notes across pages with their reaction pills" do
    visit_notebook_index(@course)
    expect(notes_grid).to be_displayed
    expect(note_cards.size).to eq(2)

    # Scope reaction asserts to the card containing each user_text so a
    # swapped-label regression (Important <-> Unclear) would fail.
    first_note_card = note_cards.find { |card| card.text.include?("first note") }
    expect(first_note_card.text).to include("Important")
    expect(first_note_card.text).to include("light")

    second_note_card = note_cards.find { |card| card.text.include?("second note") }
    expect(second_note_card.text).to include("Unclear")
    expect(second_note_card.text).to include("glucose")
  end

  it "renders each note as a link back to its source wiki page with the noteId query param" do
    visit_notebook_index(@course)
    expect(notes_grid).to be_displayed
    expect(note_card_link(@studynote_b.id).attribute("href")).to end_with(
      "/courses/#{@course.id}/pages/#{@page_b.id}?noteId=#{@studynote_b.id}"
    )
    note_card_link(@studynote_b.id).click
    expect(wiki_page_content).to be_displayed
    expect(driver.current_url).to end_with("/courses/#{@course.id}/pages/#{@page_b.url}")
  end
end
