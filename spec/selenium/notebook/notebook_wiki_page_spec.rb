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

describe "notebook on a wiki page" do
  include_context "in-process server selenium tests"
  include NotebookPage
  include NotebookCommon

  before :once do
    notebook_student_setup
  end

  before do
    user_session(@student)
  end

  it "shows the notebook trigger button to a student" do
    visit_wiki_page(@course, @page_a)
    expect(notebook_button).to be_displayed
  end

  it "opens the drawer panel and renders Note and its user text" do
    visit_wiki_page(@course, @page_a)
    open_notebook_panel
    assert_note_card_count(1)
    expect(note_card(@studynote_a.id)).to be_displayed
    expect(note_card(@studynote_a.id).text).to include("Important\nlight\nfirst note")
  end

  it "deletes Note" do
    visit_wiki_page(@course, @page_b)
    expect(wiki_page_highlight_content(@studynote_b.id)).to be_displayed

    open_notebook_panel
    expect(note_card(@studynote_b.id)).to be_displayed
    assert_note_card_count(1)
    note_card(@studynote_b.id).click
    delete_study_note(@studynote_b)

    expect(element_exists?(note_card_selector(@studynote_b.id))).to be_falsey
    expect(element_exists?(wiki_page_highlight_content_selector(@studynote_b.id))).to be_falsey
  end

  context "user text" do
    before :once do
      create_studynote_without_usertext
      @edited_user_text = "user text edited from Notebook spec"
    end

    it "adds a user text in existing Note" do
      added_user_text = "user text added from Notebook spec"
      visit_wiki_page(@course, @page_a)
      open_notebook_panel
      note_card(@studynote_a_no_text.id).click
      click_edit_user_text_button(@studynote_a_no_text)
      fill_in_user_text(@studynote_a_no_text, added_user_text)
      click_save_user_text_button(@studynote_a_no_text)

      expect(element_exists?(note_card_text_area_selector(@studynote_a_no_text.id))).to be_falsey
      expect(note_card(@studynote_a_no_text.id).text).to include(added_user_text)
    end

    it "edits a user text in Note" do
      visit_wiki_page(@course, @page_a)
      open_notebook_panel
      expect(note_card(@studynote_a.id)).to be_displayed
      note_card(@studynote_a.id).click
      click_edit_user_text_button(@studynote_a)
      fill_in_user_text(@studynote_a, @edited_user_text)
      click_save_user_text_button(@studynote_a)

      expect(note_card(@studynote_a.id)).to be_displayed
      expect(note_card(@studynote_a.id).text).to include(@edited_user_text)
    end

    it "cancels editing a user text in Note" do
      visit_wiki_page(@course, @page_a)
      open_notebook_panel
      expect(note_card(@studynote_a.id)).to be_displayed
      note_card(@studynote_a.id).click
      click_edit_user_text_button(@studynote_a)
      fill_in_user_text(@studynote_a, @edited_user_text)
      click_cancel_edit_user_text_button(@studynote_a)

      expect(note_card(@studynote_a.id)).to be_displayed
      expect(note_card(@studynote_a.id).text).to include("first note")
    end
  end
end
