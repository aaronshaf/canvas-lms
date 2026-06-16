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
  end

  before do
    user_session(@student)
  end

  it "renders the student's notes across pages with their reaction pills" do
    visit_notebook_index(@course)
    assert_note_card_count(2)
    expect(element_exists?(notebook_index_pagination_selector)).to be_falsey

    # Scope reaction asserts to the card containing each user_text so a
    # swapped-label regression (Important <-> Unclear) would fail.
    first_note_card = note_card(@studynote_a.id)
    expect(first_note_card.text).to include("Important")
    expect(first_note_card.text).to include("light")

    second_note_card = note_card(@studynote_b.id)
    expect(second_note_card.text).to include("Unclear")
    expect(second_note_card.text).to include("glucose")
  end

  it "renders each note as a link back to its source wiki page with the noteId query param" do
    visit_notebook_index(@course)
    expect(notes_grid).to be_displayed
    expect(note_card_link(@studynote_b.id).attribute("href")).to end_with(
      "/courses/#{@course.id}/pages/#{@page_b.id}?note_id=#{@studynote_b.id}"
    )
    note_card_link(@studynote_b.id).click
    expect(wiki_page_content).to be_displayed
    expect(driver.current_url).to end_with("/courses/#{@course.id}/pages/#{@page_b.url}?note_id=#{@studynote_b.id}")
  end

  it "filters notes by reaction when a filter option is selected" do
    visit_notebook_index(@course)
    filter_notes_by(:important)
    assert_note_card_count(1)
    expect(note_card(@studynote_a.id)).to be_displayed
    expect(element_exists?(note_card_selector(@studynote_b.id))).to be_falsey

    filter_notes_by(:unclear)
    assert_note_card_count(1)
    expect(note_card(@studynote_b.id)).to be_displayed
    expect(element_exists?(note_card_selector(@studynote_a.id))).to be_falsey

    filter_notes_by(:all)
    assert_note_card_count(2)
    expect(note_card(@studynote_a.id)).to be_displayed
    expect(note_card(@studynote_b.id)).to be_displayed
  end

  context "empty state" do
    before :once do
      notebook_empty_student_setup
    end

    before do
      user_session(@student_no_note)
    end

    it "renders the empty state when the student has no notes" do
      visit_notebook_index(@course)
      expect(notebook_index_heading).to be_displayed
      expect(notebook_index_heading.text).to include("Start capturing your notes")
      expect(notebook_total_notes_count).to be_displayed
      expect(notebook_total_notes_count.text).to include("0 results")
    end

    it "renders no results when the active filter has no matching notes" do
      visit_notebook_index(@course)
      filter_notes_by(:important)
      expect(notebook_index_heading).to be_displayed
      expect(notebook_index_heading.text).to include("Nothing here yet")
      expect(element_exists?(notes_grid_selector)).to be_falsey
    end
  end

  context "pagination" do
    before :once do
      notebook_pagination_setup # additional 50 notes + the original 2 = 52 total notes
    end

    it "can navigate through pagination" do
      ordered = StudyNote.where(user: @student, course: @course).active.order(:created_at, :id)
      page1_first = ordered.first
      page2_first = ordered.offset(page_size).first
      page3_first = ordered.offset(page_size * 2).first

      visit_notebook_index(@course)

      expect(notebook_index_pagination).to be_displayed
      expect(note_card(page1_first.id)).to be_displayed
      assert_note_card_count(page_size)

      control_pagination("next")
      expect(note_card(page2_first.id)).to be_displayed
      assert_note_card_count(page_size)

      control_pagination("next")
      expect(note_card(page3_first.id)).to be_displayed
      assert_note_card_count(4) # 2 full pages (24 + 24) + left over 4 notes = 52 total notes

      control_pagination("first")
      expect(note_card(page1_first.id)).to be_displayed
      assert_note_card_count(page_size)

      control_pagination("last")
      assert_note_card_count(4)

      control_pagination("prev")
      expect(note_card(page2_first.id)).to be_displayed
      assert_note_card_count(page_size)

      control_pagination("prev")
      expect(note_card(page1_first.id)).to be_displayed
      assert_note_card_count(page_size)
    end

    it "maintains the current filter when navigating pagination" do
      last_important_note = StudyNote.where(user: @student, course: @course).where("'Important' = ANY(reaction)").order(:id).last
      second_last_important_note = StudyNote.where(user: @student, course: @course).where("'Important' = ANY(reaction)").order(id: :desc).offset(1).first

      visit_notebook_index(@course)
      filter_notes_by(:important)
      assert_note_card_count(page_size)

      control_pagination("next")
      expect(note_card(last_important_note.id)).to be_displayed
      expect(note_card(second_last_important_note.id)).to be_displayed
      assert_note_card_count(2)
    end
  end
end
