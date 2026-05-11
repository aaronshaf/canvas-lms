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
                                         node_tree: '{"ROOT": {}}',
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
                                             node_tree: '{"ROOT": {}}',
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
                                             node_tree: '{"ROOT": {}}',
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
        node_tree: '{"ROOT": {}}',
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
end
