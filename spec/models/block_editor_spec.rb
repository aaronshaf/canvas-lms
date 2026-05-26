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
  let_once(:wiki_page) do
    course_with_teacher
    @course.wiki_pages.create!(title: "page")
  end

  def build_blocks(node_id, resolved_name, props)
    {
      node_id => {
        "type" => { "resolvedName" => resolved_name },
        "props" => props,
        "nodes" => [],
        "linkedNodes" => {}
      }
    }
  end

  describe "#viewer_iframe_html" do
    let_once(:block_editor) do
      BlockEditor.create!(
        context: wiki_page,
        editor_version: BlockEditor::LATEST_VERSION,
        blocks: { "ROOT" => {} }
      )
    end

    it "renders a sandboxed iframe so the framed page cannot read parent cookies or window.ENV" do
      html = block_editor.viewer_iframe_html
      expect(html).to match(/<iframe[^>]*\bsandbox="allow-scripts"/)
      expect(html).not_to include("allow-same-origin")
    end

    it "returns html_safe output built with attribute-escaping helpers" do
      html = block_editor.viewer_iframe_html
      expect(html).to be_html_safe
      expect(html).to include("src=\"/block_editors/#{block_editor.id}\"")
    end
  end

  describe "sanitize_blocks" do
    let(:xss_payload) { '<img src=x onerror="alert(1)">' }

    it "sanitizes TextBlock content" do
      block_data = BlockEditor.create!(
        context: wiki_page,
        editor_version: BlockEditor::LATEST_VERSION,
        blocks: build_blocks("abc", "TextBlock", { "content" => xss_payload })
      )
      expect(block_data.blocks.dig("abc", "props", "content")).not_to include("onerror")
    end

    it "sanitizes ImageTextBlock content" do
      block_data = BlockEditor.create!(
        context: wiki_page,
        editor_version: BlockEditor::LATEST_VERSION,
        blocks: build_blocks("xyz", "ImageTextBlock", { "content" => xss_payload })
      )
      expect(block_data.blocks.dig("xyz", "props", "content")).not_to include("onerror")
    end
  end
end
