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

describe BlockEditor do
  describe "#viewer_iframe_html" do
    before do
      course_with_teacher
      @wiki_page = @course.wiki_pages.create!(title: "page")
      @block_editor = BlockEditor.create!(
        context: @wiki_page,
        editor_version: BlockEditor::LATEST_VERSION,
        blocks: { ROOT: {} }
      )
    end

    it "renders a sandboxed iframe so the framed page cannot read parent cookies or window.ENV" do
      html = @block_editor.viewer_iframe_html
      expect(html).to match(/<iframe[^>]*\bsandbox="allow-scripts"/)
      expect(html).not_to include("allow-same-origin")
    end

    it "returns html_safe output built with attribute-escaping helpers" do
      html = @block_editor.viewer_iframe_html
      expect(html).to be_html_safe
      expect(html).to include("src=\"/block_editors/#{@block_editor.id}\"")
    end
  end
end
