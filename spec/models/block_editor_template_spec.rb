# frozen_string_literal: true

#
# Copyright (C) 2024 - present Instructure, Inc.
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

describe BlockEditorTemplate do
  before do
    course_with_teacher
  end

  it "should have a valid factory" do
    template = BlockEditorTemplate.new({
                                         context_type: "Course",
                                         context_id: @course.id,
                                         name: "name",
                                         description: "description",
                                         node_tree: { "ROOT" => {} },
                                         editor_version: "1.0",
                                         template_type: "block"
                                       })
    expect(template).to be_valid
    expect(template.workflow_state).to eq("unpublished")
  end

  it "should soft delete" do
    template = BlockEditorTemplate.create!({
                                             context_type: "Course",
                                             context_id: @course.id,
                                             name: "name",
                                             description: "description",
                                             node_tree: { "ROOT" => {} },
                                             editor_version: "1.0",
                                             template_type: "block"
                                           })
    template.destroy
    expect(BlockEditorTemplate.find_by(id: template.id).workflow_state).to eq("deleted")
  end

  it "should be active when published" do
    template = BlockEditorTemplate.create!({
                                             context_type: "Course",
                                             context_id: @course.id,
                                             name: "name",
                                             description: "description",
                                             node_tree: { "ROOT" => {} },
                                             editor_version: "1.0",
                                             template_type: "block"
                                           })
    expect(template.active?).to be_falsey
    expect(template.published?).to be_falsey
    template.publish
    expect(template.active?).to be_truthy
    expect(template.published?).to be_truthy
  end

  describe "thumbnail validation" do
    let(:template) do
      BlockEditorTemplate.new(
        context_type: "Course",
        context_id: @course.id,
        name: "name",
        node_tree: { "ROOT" => {} },
        editor_version: "1.0",
        template_type: "block"
      )
    end

    [
      nil,
      "",
      "https://example.com/thumb.png",
      "/files/123/preview-style",
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "data:image/jpeg;base64,AAAA",
      "data:image/webp;base64,AAAA",
    ].each do |value|
      it "accepts #{value.inspect}" do
        template.thumbnail = value
        expect(template).to be_valid
      end
    end

    {
      "http://example.com/thumb.png" => "http scheme",
      "//attacker.tld/log" => "protocol-relative URL",
      "javascript:alert(1)" => "javascript: scheme",
      "vbscript:msgbox(1)" => "vbscript: scheme",
      "file:///etc/passwd" => "file:// scheme",
      "data:text/html;base64,PHNjcmlwdD4=" => "non-image data: URI",
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" => "svg+xml data: URI",
      "\");}body{background:url(\"//attacker.tld/log" => "CSS-breakout payload",
      "https://example.com/x'.png" => "single quote",
      "https://example.com/x\".png" => "double quote",
      "https://example.com/x;.png" => "semicolon",
      "https://example.com/x\nfoo.png" => "newline",
      "https://example.com/x\\.png" => "backslash",
    }.each do |value, label|
      it "rejects #{label}" do
        template.thumbnail = value
        expect(template).not_to be_valid
        expect(template.errors[:thumbnail]).to be_present
      end
    end

    it "rejects thumbnail over max length" do
      template.thumbnail = "https://example.com/#{"a" * 4096}"
      expect(template).not_to be_valid
      expect(template.errors[:thumbnail]).to be_present
    end
  end

  describe "validations and sanitization" do
    let(:base_attrs) do
      {
        context_type: "Course",
        context_id: @course.id,
        name: "name",
        description: "description",
        node_tree: { "ROOT" => {} },
        editor_version: "1.0",
        template_type: "block"
      }
    end

    it "rejects unknown template_type" do
      template = BlockEditorTemplate.new(base_attrs.merge(template_type: "evil"))
      expect(template).not_to be_valid
      expect(template.errors[:template_type]).to be_present
    end

    it "rejects blank name" do
      template = BlockEditorTemplate.new(base_attrs.merge(name: ""))
      expect(template).not_to be_valid
      expect(template.errors[:name]).to be_present
    end

    it "rejects node_tree that is not a Hash" do
      template = BlockEditorTemplate.new(base_attrs.merge(node_tree: "<script>alert(1)</script>"))
      expect(template).not_to be_valid
      expect(template.errors[:node_tree]).to be_present
    end

    it "strips script tags from string values inside node_tree" do
      payload = {
        "ROOT" => {
          "type" => "Container",
          "props" => { "html" => "hi<script>alert(1)</script>" }
        }
      }
      template = BlockEditorTemplate.create!(base_attrs.merge(node_tree: payload))
      expect(template.node_tree.dig("ROOT", "props", "html")).to eq("hi")
    end

    it "strips on* event handler attributes inside node_tree" do
      payload = {
        "ROOT" => {
          "props" => { "html" => '<img src=x onerror="alert(1)">' }
        }
      }
      template = BlockEditorTemplate.create!(base_attrs.merge(node_tree: payload))
      expect(template.node_tree.dig("ROOT", "props", "html")).not_to include("onerror")
      expect(template.node_tree.dig("ROOT", "props", "html")).not_to include("alert")
    end

    it "strips javascript: URLs inside node_tree" do
      payload = {
        "ROOT" => {
          "props" => { "html" => '<a href="javascript:alert(1)">x</a>' }
        }
      }
      template = BlockEditorTemplate.create!(base_attrs.merge(node_tree: payload))
      expect(template.node_tree.dig("ROOT", "props", "html")).not_to include("javascript:")
    end

    it "blanks bare javascript: scalar prop values" do
      payload = { "ROOT" => { "props" => { "href" => "javascript:alert(1)" } } }
      template = BlockEditorTemplate.create!(base_attrs.merge(node_tree: payload))
      expect(template.node_tree.dig("ROOT", "props", "href")).to eq("")
    end

    it "blanks scalar URL schemes with leading control chars and mixed case" do
      payload = { "ROOT" => { "props" => { "href" => "\tJavaScript:alert(1)" } } }
      template = BlockEditorTemplate.create!(base_attrs.merge(node_tree: payload))
      expect(template.node_tree.dig("ROOT", "props", "href")).to eq("")
    end

    it "blanks vbscript: scalar prop values" do
      payload = { "ROOT" => { "props" => { "src" => "vbscript:msgbox(1)" } } }
      template = BlockEditorTemplate.create!(base_attrs.merge(node_tree: payload))
      expect(template.node_tree.dig("ROOT", "props", "src")).to eq("")
    end

    it "blanks base64 data:text/html scalar prop values" do
      payload = {
        "ROOT" => {
          "props" => { "href" => "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==" }
        }
      }
      template = BlockEditorTemplate.create!(base_attrs.merge(node_tree: payload))
      expect(template.node_tree.dig("ROOT", "props", "href")).to eq("")
    end

    it "blanks bare data: scalar prop values" do
      payload = { "ROOT" => { "props" => { "src" => "data:image/svg+xml,<svg/onload=alert(1)>" } } }
      template = BlockEditorTemplate.create!(base_attrs.merge(node_tree: payload))
      expect(template.node_tree.dig("ROOT", "props", "src")).to eq("")
    end

    it "blanks file: and blob: scalar prop values" do
      payload = {
        "ROOT" => {
          "props" => {
            "a" => "file:///etc/passwd",
            "b" => "blob:https://example.com/abc"
          }
        }
      }
      template = BlockEditorTemplate.create!(base_attrs.merge(node_tree: payload))
      expect(template.node_tree.dig("ROOT", "props", "a")).to eq("")
      expect(template.node_tree.dig("ROOT", "props", "b")).to eq("")
    end

    it "blanks dangerous schemes nested in arrays" do
      payload = { "ROOT" => { "props" => { "items" => [{ "href" => "javascript:alert(1)" }] } } }
      template = BlockEditorTemplate.create!(base_attrs.merge(node_tree: payload))
      expect(template.node_tree.dig("ROOT", "props", "items", 0, "href")).to eq("")
    end

    it "leaves safe URL scalars unchanged" do
      payload = { "ROOT" => { "props" => { "href" => "https://example.com/x" } } }
      template = BlockEditorTemplate.create!(base_attrs.merge(node_tree: payload))
      expect(template.node_tree.dig("ROOT", "props", "href")).to eq("https://example.com/x")
    end

    it "strips HTML from name and description" do
      template = BlockEditorTemplate.create!(base_attrs.merge(
                                               name: "ok<script>alert(1)</script>",
                                               description: '<img src=x onerror="alert(1)">desc'
                                             ))
      expect(template.name).not_to include("<script>")
      expect(template.name).not_to include("alert")
      expect(template.description).not_to include("onerror")
    end

    it "rejects node_tree exceeding max depth" do
      stub_const("BlockEditorTemplate::MAX_NODE_TREE_DEPTH", 3)
      deep = (1..5).inject({ "leaf" => true }) { |acc, _| { "child" => acc } }
      template = BlockEditorTemplate.new(base_attrs.merge(node_tree: deep))
      expect(template).not_to be_valid
      expect(template.errors[:node_tree]).to be_present
    end

    it "rejects node_tree exceeding max node count" do
      stub_const("BlockEditorTemplate::MAX_NODE_TREE_NODES", 3)
      wide = { "a" => 1, "b" => 2, "c" => 3, "d" => 4, "e" => 5 }
      template = BlockEditorTemplate.new(base_attrs.merge(node_tree: wide))
      expect(template).not_to be_valid
      expect(template.errors[:node_tree]).to be_present
    end
  end
end
