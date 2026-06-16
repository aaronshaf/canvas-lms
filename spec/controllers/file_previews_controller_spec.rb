# frozen_string_literal: true

#
# Copyright (C) 2014 - present Instructure, Inc.
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

require "webmock/rspec"

describe FilePreviewsController, type: :request do
  describe "with JWT access token" do
    include_context "InstAccess setup"

    it "allows access" do
      account = Account.default
      account.enable_service(:google_docs_previews)
      course_with_student(account:, active_all: true)
      attachment_model.update!(file_state: "hidden", instfs_uuid: "stuff")
      user_with_pseudonym
      allow(Canvadocs).to receive(:enabled?).and_return(true)
      allow(InstFS).to receive_messages(enabled?: true, app_host: "http://instfs.test")
      jwt_payload = {
        resource: "/courses/#{@course.id}/files/#{@attachment.id}?instfs_id=stuff",
        aud: [@course.root_account.uuid],
        sub: @user.uuid,
        tenant_auth: { location: "location" },
        iss: "instructure:inst_access",
        exp: 1.hour.from_now.to_i,
        iat: Time.now.to_i
      }
      token_string = InstAccess::Token.send(:new, jwt_payload).to_unencrypted_token_string
      stub_request(:get, "http://instfs.test/files/stuff/metadata").to_return(status: 200, body: { url: "http://instfs.test/stuff" }.to_json)
      get "/courses/#{@course.id}/files/#{@attachment.id}/file_preview", params: { access_token: token_string, instfs_id: "stuff" }
      expect(response).to be_successful
    end

    it "does not allow access if the file doesn't match" do
      account = Account.default
      account.enable_service(:google_docs_previews)
      course_with_student(account:, active_all: true)
      attachment_model.update!(file_state: "hidden", instfs_uuid: "stuff")
      user_with_pseudonym
      jwt_payload = {
        resource: "/courses/#{@course.id}/files/#{@attachment.id}?instfs_id=stuff",
        aud: [@course.root_account.uuid],
        sub: @user.uuid,
        tenant_auth: { location: "location" },
        iss: "instructure:inst_access",
        exp: 1.hour.from_now.to_i,
        iat: Time.now.to_i
      }
      token_string = InstAccess::Token.send(:new, jwt_payload).to_unencrypted_token_string
      attachment_model.update!(file_state: "hidden", instfs_uuid: "otherstuff")
      get "/courses/#{@course.id}/files/#{@attachment.id}/file_preview", params: { access_token: token_string, instfs_id: "stuff" }
      expect(response).to have_http_status :not_found
    end
  end

  it "renders a generic 404 (not 401) when unauthorized, to avoid leaking file existence" do
    course_model
    attachment_model
    remove_user_session
    get "/courses/#{@course.id}/files/#{@attachment.id}/file_preview"
    expect(response).to have_http_status :not_found
  end

  it "accepts a valid verifier token" do
    course_model
    account = Account.default
    account.enable_service(:google_docs_previews)
    course_with_student(account:, course: @course, active_all: true)
    user_session(@student)
    attachment_model(content_type: "image/png")
    get "/courses/#{@course.id}/files/#{@attachment.id}/file_preview", params: { verifier: @attachment.uuid }
    expect(response).to have_http_status :ok
    expect(response).to render_template "img_preview"
  end

  it "does not accept an invalid verifier token" do
    course_model
    account = Account.default
    account.enable_service(:google_docs_previews)
    course_with_student(account:, course: @course, active_all: true)
    user_session(@student)
    attachment_model
    get "/courses/#{@course.id}/files/#{@attachment.id}/file_preview", params: { verifier: "nope" }
    expect(response).to have_http_status :not_found
  end

  it "renders lock information for the file" do
    account = Account.default
    account.enable_service(:google_docs_previews)
    course_with_student(account:, active_all: true)
    user_session(@student)
    attachment_model locked: true
    get "/courses/#{@course.id}/files/#{@attachment.id}/file_preview"
    expect(response).to have_http_status :ok
    expect(response).to render_template "lock_explanation"
  end

  it "404s (w/o canvas chrome) if the file doesn't exist" do
    course_with_student(account: Account.default, active_all: true)
    user_session(@student)
    attachment_model
    file_id = @attachment.id
    @attachment.destroy_permanently!
    get "/courses/#{@course.id}/files/#{file_id}/file_preview"
    expect(response).to have_http_status :not_found
  end

  it "redirects to canvadocs_url if available" do
    account = Account.default
    account.enable_service(:google_docs_previews)
    course_with_student(account:, active_all: true)
    user_session(@student)
    attachment_model(content_type: "application/msword")
    @attachment.create_canvadoc(document_id: "doc-#{@attachment.id}")
    allow(Canvadocs).to receive(:enabled?).and_return(true)
    get "/courses/#{@course.id}/files/#{@attachment.id}/file_preview"
    expect(response).to have_http_status(:found)
    expect(response.location).to match %r{/api/v1/canvadoc_session}
  end

  it "redirects to a google doc preview if available" do
    account = Account.default
    account.enable_service(:google_docs_previews)
    course_with_student(account:, active_all: true)
    user_session(@student)
    attachment_model(content_type: "application/msword")
    get "/courses/#{@course.id}/files/#{@attachment.id}/file_preview"
    expect(response).to have_http_status(:found)
    expect(response.location).to match %r{\A//docs.google.com/viewer}
    expect(response.location).to include(CGI.escape(@attachment.authenticated_s3_url))
  end

  it "redirects to file if it's html" do
    account = Account.default
    account.enable_service(:google_docs_previews)
    course_with_student(account:, active_all: true)
    user_session(@student)
    attachment_model(content_type: "text/html")
    get "/courses/#{@course.id}/files/#{@attachment.id}/file_preview"
    expect(response).to have_http_status(:found)
    expect(response.location).to match %r{/courses/#{@course.id}/files/#{@attachment.id}/preview}
  end

  it "renders a download link if no previews are available" do
    account = Account.default
    account.enable_service(:google_docs_previews)
    course_with_student(account:, active_all: true)
    user_session(@student)
    account.disable_service(:google_docs_previews)
    account.save!
    attachment_model(content_type: "application/msword")
    get "/courses/#{@course.id}/files/#{@attachment.id}/file_preview"
    expect(response).to have_http_status :ok
    expect(response).to render_template "no_preview"
  end

  it "renders an img element for image types" do
    account = Account.default
    account.enable_service(:google_docs_previews)
    course_with_student(account:, active_all: true)
    user_session(@student)
    attachment_model(content_type: "image/png")
    get "/courses/#{@course.id}/files/#{@attachment.id}/file_preview"
    expect(response).to have_http_status :ok
    expect(response).to render_template "img_preview"
  end

  it "renders a media tag for media types" do
    account = Account.default
    account.enable_service(:google_docs_previews)
    course_with_student(account:, active_all: true)
    user_session(@student)
    attachment_model(content_type: "video/mp4")
    get "/courses/#{@course.id}/files/#{@attachment.id}/file_preview"
    expect(response).to have_http_status :ok
    expect(response).to render_template "media_preview"
  end

  it "fulfills module completion requirements" do
    account = Account.default
    account.enable_service(:google_docs_previews)
    course_with_student(account:, active_all: true)
    user_session(@student)
    attachment_model(content_type: "application/msword")
    mod = @course.context_modules.create!(name: "some module")
    tag = mod.add_item(id: @attachment.id, type: "attachment")
    mod.completion_requirements = { tag.id => { type: "must_view" } }
    mod.save!
    expect(mod.evaluate_for(@user).workflow_state).to eq "unlocked"
    get "/courses/#{@course.id}/files/#{@attachment.id}/file_preview"
    expect(mod.evaluate_for(@user).workflow_state).to eq "completed"
  end

  it "logs asset accesses when previewable" do
    Setting.set("enable_page_views", "db")
    account = Account.default
    account.enable_service(:google_docs_previews)
    course_with_student(account:, active_all: true)
    user_session(@student)
    attachment_model(content_type: "image/png")
    get "/courses/#{@course.id}/files/#{@attachment.id}/file_preview"
    access = AssetUserAccess.for_user(@user).first
    expect(access.asset).to eq @attachment
  end

  it "does not log asset accesses when not previewable" do
    Setting.set("enable_page_views", "db")
    account = Account.default
    account.enable_service(:google_docs_previews)
    course_with_student(account:, active_all: true)
    user_session(@student)
    attachment_model(content_type: "unknown/unknown")
    get "/courses/#{@course.id}/files/#{@attachment.id}/file_preview"
    access = AssetUserAccess.for_user(@user)
    expect(access).to be_empty
  end

  it "works with hidden files" do
    account = Account.default
    account.enable_service(:google_docs_previews)
    course_with_student(account:, active_all: true)
    user_session(@student)
    attachment_model(content_type: "image/png")
    @attachment.update_attribute(:file_state, "hidden")
    get "/courses/#{@course.id}/files/#{@attachment.id}/file_preview"
    expect(response).to be_successful
  end

  describe "student in limited access account" do
    it "allows students to see individual files" do
      account = Account.default
      account.enable_service(:google_docs_previews)
      account.root_account.enable_feature!(:allow_limited_access_for_students)
      account.settings[:enable_limited_access_for_students] = true
      account.save!
      course_with_student(account:, active_all: true)
      user_session(@student)
      attachment_model(content_type: "image/png")
      get "/courses/#{@course.id}/files/#{@attachment.id}/file_preview", params: { verifier: @attachment.uuid }
      expect(response).to have_http_status :ok
      expect(response).to render_template "img_preview"
    end
  end

  describe "unauthenticated access" do
    it "allows unauthenticated access with valid course syllabus location parameter" do
      account = Account.default
      account.enable_service(:google_docs_previews)
      account.root_account.enable_feature!(:disable_file_verifiers_in_public_syllabus)
      account.root_account.enable_feature!(:file_association_access)
      course_factory(account:, active_all: true, is_public: true)
      user_model
      @attachment = attachment_model(context: @course, content_type: "image/png")

      html = "<p><img src='/courses/#{@course.id}/files/#{@attachment.id}/preview' alt='test'></p>"
      @course.syllabus_body = html
      @course.updating_user = @user
      @course.save!

      remove_user_session
      get "/courses/#{@course.id}/files/#{@attachment.id}/file_preview", params: {
        location: "course_syllabus_#{@course.id}"
      }
      expect(response).to have_http_status :ok
      expect(response).to render_template "img_preview"
    end
  end

  describe "does not reveal whether a file exists or who owns it to unauthorized callers" do
    before do
      @owner = user_factory(active_all: true)
      @file = attachment_model(context: @owner)
      @other_user = user_factory(active_all: true)
      remove_user_session
    end

    it "returns 404 for a real file under its owning user when unauthorized" do
      get "/users/#{@owner.id}/files/#{@file.id}/file_preview"
      expect(response).to have_http_status :not_found
    end

    it "returns 404 for a nonexistent file id under the same user" do
      get "/users/#{@owner.id}/files/0/file_preview"
      expect(response).to have_http_status :not_found
    end

    it "returns 404 for a real file id under the wrong user" do
      get "/users/#{@other_user.id}/files/#{@file.id}/file_preview"
      expect(response).to have_http_status :not_found
    end

    it "returns indistinguishable responses across all three cases" do
      get "/users/#{@owner.id}/files/#{@file.id}/file_preview"
      existing_unauthorized = response.status

      get "/users/#{@owner.id}/files/0/file_preview"
      nonexistent = response.status

      get "/users/#{@other_user.id}/files/#{@file.id}/file_preview"
      wrong_context = response.status

      expect([existing_unauthorized, nonexistent, wrong_context]).to all(eq(404))
    end
  end
end
