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
    allow(controller).to receive_messages(template_editor?: true, global_template_editor?: true)
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
      post :create, params: create_params.merge(template_type: "evil"), format: :json
      expect(response).to have_http_status(:bad_request)
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

  describe "authorization split between local and global template editors" do
    let_once(:course) { course_factory(active_all: true, account:) }
    let_once(:local_editor) do
      user_factory(active_all: true).tap do |u|
        course.enroll_teacher(u, enrollment_state: "active")
      end
    end
    let_once(:global_editor) do
      user_factory(active_all: true).tap do |u|
        course.enroll_teacher(u, enrollment_state: "active")
      end
    end
    let_once(:teacher_role) { Role.get_built_in_role("TeacherEnrollment", root_account_id: course.root_account.id) }
    let_once(:block_template) do
      BlockEditorTemplate.create!(
        context: course,
        name: "Local Block",
        node_tree: { "ROOT" => {} },
        editor_version: "0.2",
        template_type: "block",
        workflow_state: "unpublished"
      )
    end
    let_once(:page_template) do
      BlockEditorTemplate.create!(
        context: course,
        name: "Global Page",
        node_tree: { "ROOT" => {} },
        editor_version: "0.2",
        template_type: "page",
        workflow_state: "unpublished"
      )
    end

    before(:once) do
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
      allow(controller).to receive(:template_editor?).and_call_original
      allow(controller).to receive(:global_template_editor?).and_call_original
    end

    context "user with only :block_editor_template_editor" do
      before { user_session(local_editor) }

      it "allows creating block templates" do
        post :create, params: { course_id: course.id, template_type: "block", name: "B", node_tree: { ROOT: {} } }, format: :json
        expect(response).to be_successful
      end

      it "allows creating section templates" do
        post :create, params: { course_id: course.id, template_type: "section", name: "S", node_tree: { ROOT: {} } }, format: :json
        expect(response).to be_successful
      end

      it "rejects creating page templates" do
        post :create, params: { course_id: course.id, template_type: "page", name: "P", node_tree: { ROOT: {} } }, format: :json
        expect(response).to be_forbidden
      end

      it "rejects updating an existing page template" do
        put :update, params: { course_id: course.id, id: page_template.id, name: "Hacked" }, format: :json
        expect(response).to be_forbidden
        expect(page_template.reload.name).to eq("Global Page")
      end

      it "rejects escalating a block template to page" do
        put :update, params: { course_id: course.id, id: block_template.id, template_type: "page" }, format: :json
        expect(response).to be_forbidden
        expect(block_template.reload.template_type).to eq("block")
      end

      it "rejects publishing a page template" do
        post :publish, params: { course_id: course.id, id: page_template.id }, format: :json
        expect(response).to be_forbidden
      end

      it "rejects destroying a page template" do
        delete :destroy, params: { course_id: course.id, id: page_template.id }, format: :json
        expect(response).to be_forbidden
        expect(BlockEditorTemplate.find(page_template.id)).to be_present
      end

      it "allows updating a block template" do
        put :update, params: { course_id: course.id, id: block_template.id, name: "Renamed" }, format: :json
        expect(response).to be_successful
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
        post :create, params: { course_id: course.id, template_type: "page", name: "P", node_tree: { ROOT: {} } }, format: :json
        expect(response).to be_successful
      end

      it "allows creating block templates" do
        post :create, params: { course_id: course.id, template_type: "block", name: "B", node_tree: { ROOT: {} } }, format: :json
        expect(response).to be_successful
      end

      it "allows updating page templates" do
        put :update, params: { course_id: course.id, id: page_template.id, name: "Renamed" }, format: :json
        expect(response).to be_successful
      end
    end

    context "user with no block editor permissions" do
      let_once(:no_perms_user) do
        user_factory(active_all: true).tap do |u|
          course.enroll_teacher(u, enrollment_state: "active")
        end
      end

      before do
        course.root_account.role_overrides.where(role: teacher_role).destroy_all
        user_session(no_perms_user)
      end

      it "rejects create" do
        post :create, params: { course_id: course.id, template_type: "block", name: "B", node_tree: { ROOT: {} } }, format: :json
        expect(response).to be_forbidden
      end

      it "rejects update" do
        put :update, params: { course_id: course.id, id: block_template.id, name: "x" }, format: :json
        expect(response).to be_forbidden
      end
    end

    describe "template_type validation" do
      before { user_session(local_editor) }

      it "rejects create with missing template_type" do
        post :create, params: { course_id: course.id, name: "X", node_tree: { ROOT: {} } }, format: :json
        expect(response).to have_http_status(:bad_request)
      end

      it "rejects create with invalid template_type" do
        post :create, params: { course_id: course.id, template_type: "evil", name: "X", node_tree: { ROOT: {} } }, format: :json
        expect(response).to have_http_status(:bad_request)
      end

      it "rejects update with invalid template_type" do
        put :update, params: { course_id: course.id, id: block_template.id, template_type: "evil" }, format: :json
        expect(response).to have_http_status(:bad_request)
      end
    end
  end
end
