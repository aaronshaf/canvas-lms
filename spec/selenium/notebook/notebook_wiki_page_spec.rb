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
    create_studynote_with_usertext
  end

  before do
    user_session(@student)
  end

  it "shows the notebook trigger button to a student" do
    visit_wiki_page(@course, @page_b)
    expect(notebook_button).to be_displayed
  end

  it "opens the drawer panel and renders a seeded note's user_text" do
    visit_wiki_page(@course, @page_a)
    open_notebook_panel
    expect(notes_grid).to be_displayed
    expect(note_cards.size).to eq(1)
    expect(notebook_panel.text).to include("first note")
  end
end
