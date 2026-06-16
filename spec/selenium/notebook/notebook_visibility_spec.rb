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

describe "notebook visibility" do
  include_context "in-process server selenium tests"
  include NotebookPage
  include NotebookCommon

  before :once do
    notebook_student_setup
  end

  context "as a teacher" do
    before do
      user_session(@teacher)
    end

    it "does not display Notebook for teachers" do
      visit_wiki_page(@course, @page_a)
      expect(wiki_page_content).to be_displayed
      expect(element_exists?(notebook_button_selector)).to be_falsey
      expect(left_nav_container.text).not_to include("Notebook")
    end

    it "blocks teachers from accessing Notebook via direct URL" do
      visit_notebook_index(@course)
      expect(access_denied_message).to be_displayed
      expect(element_exists?("#notebook_index_mount_point")).to be_falsey
    end
  end

  context "as an observer" do
    before :once do
      observer_setup
    end

    before do
      user_session(@observer)
      verify_observer_session(@student)
    end

    it "does not display Notebook for observers" do
      visit_wiki_page(@course, @page_a)
      expect(wiki_page_content).to be_displayed
      expect(element_exists?(notebook_button_selector)).to be_falsey
      expect(left_nav_container.text).not_to include("Notebook")
    end

    it "blocks observers from accessing Notebook via direct URL" do
      visit_notebook_index(@course)
      expect(access_denied_message).to be_displayed
      expect(element_exists?("#notebook_index_mount_point")).to be_falsey
    end
  end
end
