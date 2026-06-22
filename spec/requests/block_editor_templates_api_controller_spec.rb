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
  let(:account) { Account.default }
  let(:course1) { course_factory(active_all: true, account:) }
  let(:course2) { course_factory(active_all: true, account:) }
  let(:teacher) do
    user_factory(active_all: true).tap do |t|
      course1.enroll_teacher(t, enrollment_state: "active")
      course2.enroll_teacher(t, enrollment_state: "active")
    end
  end
  let(:template_in_course1) do
    BlockEditorTemplate.create!(
      context: course1,
      name: "Course 1 Template",
      node_tree: { "ROOT" => {} },
      editor_version: "0.2",
      template_type: "page",
      workflow_state: "unpublished"
    )
  end
  let(:template_in_course2) do
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
    account.role_overrides.create!(role: Role.get_built_in_role("TeacherEnrollment", root_account_id: account.id), permission: "block_editor_template_editor", enabled: true)
    account.role_overrides.create!(role: Role.get_built_in_role("TeacherEnrollment", root_account_id: account.id), permission: "block_editor_global_template_editor", enabled: true)
    allow_any_instance_of(Account).to receive(:feature_enabled?).and_call_original
    allow_any_instance_of(Account).to receive(:feature_enabled?).with(:block_editor).and_return(true)
    allow_any_instance_of(Account).to receive(:feature_enabled?).with(:block_template_editor).and_return(true)
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

    it "returns 400 for unknown template_type and does not persist" do
      before_count = BlockEditorTemplate.count
      post "/api/v1/courses/#{course1.id}/block_editor_templates", params: create_params.merge(template_type: "evil"), as: :json
      expect(response).to have_http_status(:bad_request)
      expect(BlockEditorTemplate.count).to eq(before_count)
    end

    it "returns 422 for svg thumbnail and does not persist" do
      before_count = BlockEditorTemplate.count
      post "/api/v1/courses/#{course1.id}/block_editor_templates", params: create_params.merge(thumbnail: "data:image/svg+xml;base64,PHN2Zy8+"), as: :json
      expect(response).to have_http_status(:unprocessable_content)
      expect(BlockEditorTemplate.count).to eq(before_count)
    end

    it "sanitizes script tags from node_tree on create" do
      payload = {
        "ROOT" => { "props" => { "html" => "<p>ok</p><script>alert(1)</script>" } }
      }
      post "/api/v1/courses/#{course1.id}/block_editor_templates", params: create_params.merge(node_tree: payload), as: :json
      expect(response).to have_http_status(:ok)
      template = BlockEditorTemplate.last
      expect(template.node_tree.dig("ROOT", "props", "html")).not_to include("<script>")
    end

    it "blanks scalar javascript: prop values at the HTTP boundary" do
      payload = { "ROOT" => { "props" => { "href" => "javascript:alert(1)" } } }
      post "/api/v1/courses/#{course1.id}/block_editor_templates", params: create_params.merge(node_tree: payload), as: :json
      expect(response).to have_http_status(:ok)
      expect(BlockEditorTemplate.last.node_tree.dig("ROOT", "props", "href")).to eq("")
    end

    it "blanks scalar base64 data:text/html prop values at the HTTP boundary" do
      payload = {
        "ROOT" => {
          "props" => { "href" => "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==" }
        }
      }
      post "/api/v1/courses/#{course1.id}/block_editor_templates", params: create_params.merge(node_tree: payload), as: :json
      expect(response).to have_http_status(:ok)
      expect(BlockEditorTemplate.last.node_tree.dig("ROOT", "props", "href")).to eq("")
    end
  end

  describe "PUT #update" do
    it "allows updating a template in the same course" do
      put "/api/v1/courses/#{course1.id}/block_editor_templates/#{template_in_course1.id}", params: { name: "Updated Name" }, as: :json
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["name"]).to eq("Updated Name")
      expect(template_in_course1.reload.name).to eq("Updated Name")
    end

    it "rejects updating a template from a different course" do
      put "/api/v1/courses/#{course1.id}/block_editor_templates/#{template_in_course2.id}", params: { name: "Hacked" }, as: :json
      expect(response).to have_http_status(:not_found)
      expect(template_in_course2.reload.name).to eq("Course 2 Template")
    end
  end

  describe "POST #publish" do
    it "allows publishing a template in the same course" do
      post "/api/v1/courses/#{course1.id}/block_editor_templates/#{template_in_course1.id}/publish", as: :json
      expect(response).to have_http_status(:ok)
      expect(template_in_course1.reload.workflow_state).to eq("active")
    end

    it "rejects publishing a template from a different course" do
      post "/courses/#{course1.id}/block_editor_templates/#{template_in_course2.id}/publish", as: :json
      expect(response).to have_http_status(:not_found)
      expect(template_in_course2.reload.workflow_state).to eq("unpublished")
    end
  end

  describe "DELETE #destroy" do
    it "allows deleting a template in the same course" do
      delete "/api/v1/courses/#{course1.id}/block_editor_templates/#{template_in_course1.id}", as: :json
      expect(response).to have_http_status(:ok)
    end

    it "rejects deleting a template from a different course" do
      delete "/api/v1/courses/#{course1.id}/block_editor_templates/#{template_in_course2.id}", as: :json
      expect(response).to have_http_status(:not_found)
      expect(BlockEditorTemplate.find(template_in_course2.id)).to be_present
    end
  end

  describe "authorization split between local and global template editors" do
    let(:course) { course_factory(active_all: true, account:) }
    let(:local_editor) do
      user_factory(active_all: true).tap do |u|
        course.enroll_teacher(u, enrollment_state: "active")
      end
    end
    let(:global_editor) do
      user_factory(active_all: true).tap do |u|
        course.enroll_teacher(u, enrollment_state: "active")
      end
    end
    let(:teacher_role) { Role.get_built_in_role("TeacherEnrollment", root_account_id: course.root_account.id) }
    let(:block_template) do
      BlockEditorTemplate.create!(
        context: course,
        name: "Local Block",
        node_tree: { "ROOT" => {} },
        editor_version: "0.2",
        template_type: "block",
        workflow_state: "unpublished"
      )
    end
    let(:page_template) do
      BlockEditorTemplate.create!(
        context: course,
        name: "Global Page",
        node_tree: { "ROOT" => {} },
        editor_version: "0.2",
        template_type: "page",
        workflow_state: "unpublished"
      )
    end

    before do
      course.root_account.role_overrides.destroy_all
      course.root_account.role_overrides.create!(role: teacher_role, permission: "block_editor_template_editor", enabled: true)
      course.root_account.role_overrides.create!(role: teacher_role, permission: "block_editor_global_template_editor", enabled: false)
      course.root_account.role_overrides.create!(
        role: Role.get_built_in_role("DesignerEnrollment", root_account_id: course.root_account.id),
        permission: "block_editor_global_template_editor",
        enabled: false
      )
    end

    before do
      allow_any_instance_of(Account).to receive(:feature_enabled?).and_call_original
      allow_any_instance_of(Account).to receive(:feature_enabled?).with(:block_editor).and_return(true)
      allow_any_instance_of(Account).to receive(:feature_enabled?).with(:block_template_editor).and_return(true)
    end

    context "user with only :block_editor_template_editor" do
      before { user_session(local_editor) }

      it "allows creating block templates" do
        post "/api/v1/courses/#{course.id}/block_editor_templates", params: { template_type: "block", name: "B", node_tree: { ROOT: {} } }, as: :json
        expect(response).to have_http_status(:ok)
      end

      it "allows creating section templates" do
        post "/api/v1/courses/#{course.id}/block_editor_templates", params: { template_type: "section", name: "S", node_tree: { ROOT: {} } }, as: :json
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body["template_type"]).to eq("section")
      end

      it "rejects creating page templates" do
        post "/api/v1/courses/#{course.id}/block_editor_templates", params: { template_type: "page", name: "P", node_tree: { ROOT: {} } }, as: :json
        expect(response).to have_http_status(:forbidden)
      end

      it "rejects updating an existing page template" do
        put "/api/v1/courses/#{course.id}/block_editor_templates/#{page_template.id}", params: { name: "Hacked" }, as: :json
        expect(response).to have_http_status(:forbidden)
        expect(page_template.reload.name).to eq("Global Page")
      end

      it "rejects escalating a block template to page" do
        put "/api/v1/courses/#{course.id}/block_editor_templates/#{block_template.id}", params: { template_type: "page" }, as: :json
        expect(response).to have_http_status(:forbidden)
        expect(block_template.reload.template_type).to eq("block")
      end

      it "rejects publishing a page template" do
        post "/api/v1/courses/#{course.id}/block_editor_templates/#{page_template.id}/publish", as: :json
        expect(response).to have_http_status(:forbidden)
      end

      it "rejects destroying a page template" do
        delete "/api/v1/courses/#{course.id}/block_editor_templates/#{page_template.id}", as: :json
        expect(response).to have_http_status(:forbidden)
        expect(BlockEditorTemplate.find(page_template.id)).to be_present
      end

      it "allows updating a block template" do
        put "/api/v1/courses/#{course.id}/block_editor_templates/#{block_template.id}", params: { name: "Renamed" }, as: :json
        expect(response).to have_http_status(:ok)
        expect(block_template.reload.name).to eq("Renamed")
      end
    end

    context "user with :block_editor_global_template_editor" do
      before do
        course.root_account.role_overrides.where(role: teacher_role, permission: "block_editor_global_template_editor").destroy_all
        course.root_account.role_overrides.create!(role: teacher_role, permission: "block_editor_global_template_editor", enabled: true)
        user_session(global_editor)
      end

      it "allows creating page templates" do
        post "/api/v1/courses/#{course.id}/block_editor_templates", params: { template_type: "page", name: "P", node_tree: { ROOT: {} } }, as: :json
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body["template_type"]).to eq("page")
      end

      it "allows creating block templates" do
        post "/api/v1/courses/#{course.id}/block_editor_templates", params: { template_type: "block", name: "B", node_tree: { ROOT: {} } }, as: :json
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body["template_type"]).to eq("block")
      end

      it "allows updating page templates" do
        put "/api/v1/courses/#{course.id}/block_editor_templates/#{page_template.id}", params: { name: "Renamed" }, as: :json
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body["name"]).to eq("Renamed")
      end
    end

    context "user with no block editor permissions" do
      let(:no_perms_user) do
        user_factory(active_all: true).tap do |u|
          course.enroll_teacher(u, enrollment_state: "active")
        end
      end

      before do
        course.root_account.role_overrides.where(role: teacher_role).destroy_all
        user_session(no_perms_user)
      end

      it "rejects create" do
        post "/api/v1/courses/#{course.id}/block_editor_templates", params: { template_type: "block", name: "B", node_tree: { ROOT: {} } }, as: :json
        expect(response).to have_http_status(:forbidden)
      end

      it "rejects update" do
        put "/api/v1/courses/#{course.id}/block_editor_templates/#{block_template.id}", params: { name: "x" }, as: :json
        expect(response).to have_http_status(:forbidden)
      end
    end

    describe "template_type validation" do
      before { user_session(local_editor) }

      it "rejects create with missing template_type" do
        post "/api/v1/courses/#{course.id}/block_editor_templates", params: { name: "X", node_tree: { ROOT: {} } }, as: :json
        expect(response).to have_http_status(:bad_request)
      end

      it "rejects create with invalid template_type" do
        post "/api/v1/courses/#{course.id}/block_editor_templates", params: { template_type: "evil", name: "X", node_tree: { ROOT: {} } }, as: :json
        expect(response).to have_http_status(:bad_request)
      end

      it "rejects update with invalid template_type" do
        put "/api/v1/courses/#{course.id}/block_editor_templates/#{block_template.id}", params: { template_type: "evil" }, as: :json
        expect(response).to have_http_status(:bad_request)
      end
    end
  end
end
