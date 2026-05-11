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

describe BlockEditorTemplatesApiController do
  let_once(:account) { Account.default }
  let_once(:course1) { course_factory(active_all: true, account:) }
  let_once(:course2) { course_factory(active_all: true, account:) }
  let_once(:teacher) do
    user_factory(active_all: true).tap do |t|
      course1.enroll_teacher(t, enrollment_state: "active")
      course2.enroll_teacher(t, enrollment_state: "active")
    end
  end
  let_once(:template_in_course1) do
    BlockEditorTemplate.create!(
      context: course1,
      name: "Course 1 Template",
      node_tree: { "ROOT" => {} },
      editor_version: "0.2",
      template_type: "page",
      workflow_state: "unpublished"
    )
  end
  let_once(:template_in_course2) do
    BlockEditorTemplate.create!(
      context: course2,
      name: "Course 2 Template",
      node_tree: { "ROOT" => {} },
      editor_version: "0.2",
      template_type: "page",
      workflow_state: "unpublished"
    )
  end

  before do
    user_session(teacher)
    allow(controller).to receive(:template_editor?).and_return(true)
  end

  describe "POST #create" do
    let(:create_params) do
      {
        course_id: course1.id,
        name: "New Template",
        node_tree: { "ROOT" => {} },
        editor_version: "0.2",
        template_type: "page",
        workflow_state: "unpublished"
      }
    end

    it "returns 422 for unknown template_type and does not persist" do
      before_count = BlockEditorTemplate.count
      post :create, params: create_params.merge(template_type: "evil"), format: :json
      expect(response).to have_http_status(:unprocessable_content)
      expect(BlockEditorTemplate.count).to eq(before_count)
    end

    it "returns 422 for svg thumbnail and does not persist" do
      before_count = BlockEditorTemplate.count
      post :create, params: create_params.merge(thumbnail: "data:image/svg+xml;base64,PHN2Zy8+"), format: :json
      expect(response).to have_http_status(:unprocessable_content)
      expect(BlockEditorTemplate.count).to eq(before_count)
    end

    it "sanitizes script tags from node_tree on create" do
      payload = {
        "ROOT" => { "props" => { "html" => "<p>ok</p><script>alert(1)</script>" } }
      }
      post :create, params: create_params.merge(node_tree: payload), format: :json
      expect(response).to be_successful
      template = BlockEditorTemplate.last
      expect(template.node_tree.dig("ROOT", "props", "html")).not_to include("<script>")
    end

    it "blanks scalar javascript: prop values at the HTTP boundary" do
      payload = { "ROOT" => { "props" => { "href" => "javascript:alert(1)" } } }
      post :create, params: create_params.merge(node_tree: payload), format: :json, as: :json
      expect(response).to be_successful
      expect(BlockEditorTemplate.last.node_tree.dig("ROOT", "props", "href")).to eq("")
    end

    it "blanks scalar base64 data:text/html prop values at the HTTP boundary" do
      payload = {
        "ROOT" => {
          "props" => { "href" => "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==" }
        }
      }
      post :create, params: create_params.merge(node_tree: payload), format: :json, as: :json
      expect(response).to be_successful
      expect(BlockEditorTemplate.last.node_tree.dig("ROOT", "props", "href")).to eq("")
    end
  end

  describe "PUT #update" do
    it "allows updating a template in the same course" do
      put :update, params: { course_id: course1.id, id: template_in_course1.id, name: "Updated Name" }, format: :json
      expect(response).to be_successful
      expect(template_in_course1.reload.name).to eq("Updated Name")
    end

    it "rejects updating a template from a different course" do
      put :update, params: { course_id: course1.id, id: template_in_course2.id, name: "Hacked" }, format: :json
      expect(response).to be_not_found
      expect(template_in_course2.reload.name).to eq("Course 2 Template")
    end
  end

  describe "POST #publish" do
    it "allows publishing a template in the same course" do
      post :publish, params: { course_id: course1.id, id: template_in_course1.id }, format: :json
      expect(response).to be_successful
      expect(template_in_course1.reload.workflow_state).to eq("active")
    end

    it "rejects publishing a template from a different course" do
      post :publish, params: { course_id: course1.id, id: template_in_course2.id }, format: :json
      expect(response).to be_not_found
      expect(template_in_course2.reload.workflow_state).to eq("unpublished")
    end
  end

  describe "DELETE #destroy" do
    it "allows deleting a template in the same course" do
      delete :destroy, params: { course_id: course1.id, id: template_in_course1.id }, format: :json
      expect(response).to be_successful
    end

    it "rejects deleting a template from a different course" do
      delete :destroy, params: { course_id: course1.id, id: template_in_course2.id }, format: :json
      expect(response).to be_not_found
      expect(BlockEditorTemplate.find(template_in_course2.id)).to be_present
    end
  end
end
