# frozen_string_literal: true

#
# Copyright (C) 2019 - present Instructure, Inc.
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

describe ContentSharesController do
  before do
    course_with_teacher(active_all: true)
    @course_1 = @course
    @teacher_1 = @teacher
    course_with_teacher(active_all: true)
    @course_2 = @course
    @teacher_2 = @teacher
    @shared_course = course_factory(active_all: true)
    @shared_course.enroll_teacher(@teacher_1, enrollment_state: "active")
    @shared_course.enroll_teacher(@teacher_2, enrollment_state: "active")
    assignment_model(course: @course_1, name: "assignment share")
  end

  describe "POST #create" do
    let(:sender) { @teacher_1 }
    let(:receiver) { @teacher_2 }

    before do
      user_session(sender)
    end

    shared_examples_for "a successful create" do
      let(:json_response) do
        subject
        response.parsed_body
      end
      let(:content_export) { ContentExport.find(json_response["content_export"]["id"]) }

      it "has the http status 'created'" do
        subject
        expect(response).to have_http_status(:created)
      end

      it "includes the content export id in the response" do
        subject
        sent_share = SentContentShare.find_by(user_id: sender.id)
        expect(response.parsed_body["content_export"]["id"]).to eq(sent_share.content_export_id)
      end

      it "includes the sender id in the response" do
        expect(json_response["user_id"]).to eq sender.id
      end

      it "includes the receiver id in the response" do
        expect(json_response["receivers"].pluck("id")).to eq([receiver.id])
      end

      it "creates a ContentExport" do
        expect(content_export.user_id).to eq(sender.id)
      end

      it "creates a SentContentShare with the sender id" do
        sent_content_share = SentContentShare.find_by(
          content_export_id: content_export.id,
          user_id: sender.id
        )
        expect(sent_content_share&.user_id).to eq(sender.id)
      end

      it "creates a ReceivedContentShare with the receiver and sender ids" do
        received_content_share = ReceivedContentShare.find_by(
          content_export_id: content_export.id,
          sender_id: sender.id,
          user_id: receiver.id
        )
        expect(received_content_share&.sender_id).to eq(sender.id)
      end
    end

    context "when sharing an assignment" do
      subject do
        post(
          "/api/v1/users/#{sender.id}/content_shares",
          params: {
            content_type: "assignment",
            content_id: @assignment.id,
            receiver_ids: [receiver.id]
          }
        )
      end

      it_behaves_like "a successful create"

      it "includes the name of the assignment in the response" do
        subject
        expect(response.parsed_body["name"]).to eq @assignment.title
      end
    end

    context "when sharing an attachment" do
      subject do
        post(
          "/api/v1/users/#{sender.id}/content_shares",
          params: {
            content_type: "attachment",
            content_id: attachment.id,
            receiver_ids: [receiver.id]
          }
        )
      end

      let(:attachment) { attachment_model(context: sender) }

      it_behaves_like "a successful create"

      it "includes the name of the attachment in the response" do
        subject
        expect(response.parsed_body["name"]).to eq attachment.filename
      end
    end

    context "when sharing a module item in a horizon course" do
      subject do
        post(
          "/api/v1/users/#{sender.id}/content_shares",
          params: {
            content_type: "module_item",
            content_id: module_item.id,
            receiver_ids: [receiver.id],
            include_module: true
          }
        )
      end

      before do
        @course_1.account.enable_feature!(:horizon_course_setting)
        @course_1.update!(horizon_course: true)
      end

      let(:course) { @course_1 }
      let(:context_module) { course.context_modules.create! name: "Module 1" }
      let(:module_item) do
        context_module.content_tags.create!(
          content_id: 0,
          tag_type: "context_module",
          content_type: "ExternalUrl",
          context_id: course.id,
          context_type: "Course",
          title: "Test Title",
          url: "https://google.com"
        )
      end

      it "includes the module in the export" do
        subject
        export = ContentExport.find response.parsed_body["content_export"]["id"]
        expect(export.settings["selected_content"]["content_tags"].length).to eq(1)
        expect(export.settings["selected_content"]["context_modules"].length).to eq(1)
      end

      it "sets selective_content_tag_export setting on the export" do
        subject

        export = ContentExport.find response.parsed_body["content_export"]["id"]
        expect(export.settings["selective_content_tag_export"]).to be true
      end

      context "with feature flag enabled" do
        before do
          Account.site_admin.enable_feature!(:selective_content_tag_export)
        end

        it "exports only the shared module item" do
          # Add another item to the module
          context_module.content_tags.create!(
            content_id: 0,
            tag_type: "context_module",
            content_type: "ExternalUrl",
            context_id: course.id,
            context_type: "Course",
            title: "Other Item",
            url: "https://other.com"
          )

          subject

          export = ContentExport.find response.parsed_body["content_export"]["id"]
          export.export(synchronous: true)

          expect(export.reload.workflow_state).to eq "exported"
          attachment = export.attachment
          require "zip"
          Zip::File.open(attachment.open.path) do |zip_file|
            module_xml = zip_file.read("course_settings/module_meta.xml")
            doc = Nokogiri::XML(module_xml)

            # Should have only 1 item (the shared one)
            items = doc.css("item")
            expect(items.count).to eq 1
            item_title = items.first.at_css("title").text
            expect(item_title).to eq "Test Title"
          end
        end
      end
    end

    it "returns 400 if required parameters aren't included" do
      post "/api/v1/users/#{@teacher_1.id}/content_shares", params: { content_type: "assignment", content_id: @assignment.id }
      expect(response).to have_http_status(:bad_request)

      post "/api/v1/users/#{@teacher_1.id}/content_shares", params: { content_type: "assignment", receiver_ids: [@teacher_2.id] }
      expect(response).to have_http_status(:bad_request)

      post "/api/v1/users/#{@teacher_1.id}/content_shares", params: { content_id: @assignment.id, receiver_ids: [@teacher_2.id] }
      expect(response).to have_http_status(:bad_request)

      announcement_model(context: @course_1)
      post "/api/v1/users/#{@teacher_1.id}/content_shares", params: { content_type: "announcement", content_id: @a.id, receiver_ids: [@teacher_2.id] }
      expect(response).to have_http_status(:bad_request)
    end

    it "returns 400 if the associated content cannot be found" do
      post "/api/v1/users/#{@teacher_1.id}/content_shares", params: { content_type: "discussion_topic", content_id: @assignment.id, receiver_ids: [@teacher_2.id] }
      expect(response).to have_http_status(:bad_request)
    end

    it "returns 403 if the user doesn't have access to export the associated content" do
      user_session(@teacher_2)
      post "/api/v1/users/#{@teacher_2.id}/content_shares", params: { content_type: "assignment", content_id: @assignment.id, receiver_ids: [@teacher_1.id] }
      expect(response).to have_http_status(:forbidden)
    end

    it "returns 401 if the sharing user doesn't match current user" do
      user_session(@teacher_2)
      post "/api/v1/users/#{@teacher_1.id}/content_shares", params: { content_type: "assignment", content_id: @assignment.id, receiver_ids: [@teacher_2.id] }
      expect(response).to have_http_status(:forbidden)
    end

    context "recipient authorization" do
      let(:unrelated_user) { user_with_pseudonym(active_user: true) }

      before do
        user_session(@teacher_1)
      end

      it "rejects when the only recipient has no shared course or group with the sender" do
        post "/api/v1/users/#{@teacher_1.id}/content_shares", params: { content_type: "assignment", content_id: @assignment.id, receiver_ids: [unrelated_user.id] }
        expect(response).to have_http_status(:bad_request)
        expect(response.parsed_body["message"]).to eq("No valid receiving users found")
        expect(ReceivedContentShare.where(user_id: unrelated_user.id)).not_to exist
        expect(SentContentShare.where(user_id: @teacher_1.id)).not_to exist
        expect(ContentExport.where(user_id: @teacher_1.id)).not_to exist
      end

      it "silently drops unauthorized recipients when at least one is authorized" do
        post "/api/v1/users/#{@teacher_1.id}/content_shares", params: { content_type: "assignment", content_id: @assignment.id, receiver_ids: [@teacher_2.id, unrelated_user.id] }
        expect(response).to have_http_status(:created)
        expect(ReceivedContentShare.where(user_id: @teacher_2.id)).to exist
        expect(ReceivedContentShare.where(user_id: unrelated_user.id)).not_to exist
      end

      it "lets site admins with :send_messages share with unrelated users" do
        site_admin = account_admin_user(account: Account.site_admin)
        user_session(site_admin)
        post "/api/v1/users/#{site_admin.id}/content_shares", params: { content_type: "assignment", content_id: @assignment.id, receiver_ids: [unrelated_user.id] }
        expect(response).to have_http_status(:created)
        expect(ReceivedContentShare.where(user_id: unrelated_user.id)).to exist
        json = response.parsed_body
        expect(json["user_id"]).to eq(site_admin.id)
        expect(json["receivers"].pluck("id")).to eq([unrelated_user.id])
      end

      it "rejects when receiver_ids exceeds the per-request cap" do
        post "/api/v1/users/#{@teacher_1.id}/content_shares", params: { content_type: "assignment", content_id: @assignment.id, receiver_ids: Array.new(ContentSharesController::MAX_RECEIVERS + 1, @teacher_2.id) }
        expect(response).to have_http_status(:bad_request)
        expect(response.parsed_body["message"]).to eq("Too many recipients (max #{ContentSharesController::MAX_RECEIVERS})")
        expect(SentContentShare.where(user_id: @teacher_1.id)).not_to exist
        expect(ContentExport.where(user_id: @teacher_1.id)).not_to exist
      end
    end
  end

  describe "rest of CRUD" do
    before do
      @export = @course_1.content_exports.create!(settings: { "selected_content" => { "assignments" => { CC::CCHelper.create_key(@assignment) => "1" } } })
      @export_2 = @course_1.content_exports.create!(settings: { "selected_content" => { "assignments" => { CC::CCHelper.create_key(@assignment) => "1" } } })
      @sent_share = @teacher_1.sent_content_shares.create! name: "booga", content_export: @export, read_state: "read"
      @received_share = @teacher_2.received_content_shares.create! name: "booga", content_export: @export, sender: @teacher_1, read_state: "unread"
      @teacher_2.received_content_shares.create! name: "u read me", content_export: @export_2, sender: @teacher_1, read_state: "read"
    end

    describe "GET #index" do
      it "lists sent content shares" do
        user_session @teacher_1
        get "/api/v1/users/#{@teacher_1.id}/content_shares/sent"
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json.length).to eq 1
        expect(json[0]["id"]).to eq @sent_share.id
        expect(json[0]["name"]).to eq "booga"
        expect(json[0]["read_state"]).to eq "read"
        expect(json[0]["sender"]).to be_nil
        expect(json[0]["receivers"].length).to eq 1
        expect(json[0]["receivers"][0]["id"]).to eq @teacher_2.id
        expect(json[0]["content_type"]).to eq "assignment"
        expect(json[0]["source_course"]).to eq({ "id" => @course_1.id, "name" => @course_1.name })
        expect(json[0]["content_export"]["id"]).to eq @export.id
      end

      it "paginates sent content shares" do
        Timecop.travel(1.hour.ago) do
          export2 = @course_1.content_exports.create!(settings: { "selected_content" => { "assignments" => { "foo" => "1" }, "content_tags" => { "bar" => "1" } } })
          @teacher_1.sent_content_shares.create! name: "ooga", content_export: export2, read_state: "read"
        end
        user_session @teacher_1

        get "/api/v1/users/self/content_shares/sent", params: { per_page: 1 }
        json = response.parsed_body
        expect(json.length).to eq 1
        expect(json[0]["name"]).to eq "booga"
        expect(json[0]["content_type"]).to eq "assignment"

        links = Api.parse_pagination_links(response.headers["Link"])
        link = links.detect { |l| l[:rel] == "next" }
        expect(link[:uri].path).to eq "/api/v1/users/self/content_shares/sent"
        expect(link[:uri].query).to include "page=2"
        expect(link[:uri].query).to include "per_page=1"

        get "/api/v1/users/self/content_shares/sent", params: { per_page: 1, page: 2 }
        json = response.parsed_body
        expect(json.length).to eq 1
        expect(json[0]["name"]).to eq "ooga"
        expect(json[0]["content_type"]).to eq "module_item"

        links = Api.parse_pagination_links(response.headers["Link"])
        expect(links.detect { |l| l[:rel] == "next" }).to be_nil
      end

      it "lists received content shares" do
        user_session @teacher_2
        get "/api/v1/users/#{@teacher_2.id}/content_shares/received"
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json.length).to eq 2
        expect(json[1]["id"]).to eq @received_share.id
        expect(json[1]["name"]).to eq "booga"
        expect(json[1]["read_state"]).to eq "unread"
        expect(json[1]["sender"]["id"]).to eq @teacher_1.id
        expect(json[1]["receivers"]).to eq([])
        expect(json[1]["content_type"]).to eq "assignment"
        expect(json[1]["source_course"]).to eq({ "id" => @course_1.id, "name" => @course_1.name })
        expect(json[1]["content_export"]["id"]).to eq @export.id
      end

      it "includes sender information" do
        user_session @teacher_2
        get "/api/v1/users/#{@teacher_2.id}/content_shares/received", params: { per_page: 1 }
        json = response.parsed_body
        expect(json.map { |share| share["sender"]["id"] }).to eq([@teacher_1.id])
      end

      it "paginates received content shares" do
        Timecop.travel(1.hour.ago) do
          export2 = @course_1.content_exports.create!(settings: { "selected_content" => { "quizzes" => { "foo" => "1" }, "content_tags" => { "bar" => "1" }, "context_modules" => { "baz" => "1" } } })
          @teacher_2.received_content_shares.create! name: "ooga", content_export: export2, sender_id: user_with_pseudonym, read_state: "unread"
        end
        user_session @teacher_2

        get "/api/v1/users/self/content_shares/received", params: { per_page: 2 }
        json = response.parsed_body
        expect(json.length).to eq 2
        expect(json[0]["name"]).to eq "u read me"
        expect(json[0]["content_type"]).to eq "assignment"

        links = Api.parse_pagination_links(response.headers["Link"])
        link = links.detect { |l| l[:rel] == "next" }
        expect(link[:uri].path).to eq "/api/v1/users/self/content_shares/received"
        expect(link[:uri].query).to include "page=2"
        expect(link[:uri].query).to include "per_page=2"

        get "/api/v1/users/self/content_shares/received", params: { per_page: 2, page: 2 }
        json = response.parsed_body
        expect(json.length).to eq 1
        expect(json[0]["name"]).to eq "ooga"
        expect(json[0]["content_type"]).to eq "module"

        links = Api.parse_pagination_links(response.headers["Link"])
        expect(links.detect { |l| l[:rel] == "next" }).to be_nil
      end

      it "requires permission on user" do
        user_session @teacher_1
        get "/api/v1/users/#{@teacher_2.id}/content_shares/received"
        expect(response).to have_http_status(:forbidden)
      end
    end

    describe "GET #show" do
      it "returns a content share" do
        user_session @teacher_1
        get "/api/v1/users/#{@teacher_1.id}/content_shares/#{@sent_share.id}"
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json["id"]).to eq @sent_share.id
        expect(json["name"]).to eq "booga"
        expect(json["read_state"]).to eq "read"
        expect(json["sender"]).to be_nil
        expect(json["receivers"].length).to eq 1
        expect(json["receivers"][0]["id"]).to eq @teacher_2.id
        expect(json["content_type"]).to eq "assignment"
        expect(json["source_course"]).to eq({ "id" => @course_1.id, "name" => @course_1.name })
        expect(json["content_export"]["id"]).to eq @export.id
      end

      it "scopes to user" do
        user_session @teacher_1
        get "/api/v1/users/#{@teacher_1.id}/content_shares/#{@received_share.id}"
        expect(response).to have_http_status(:not_found)
      end
    end

    describe "DELETE #destroy" do
      it "deletes a content share" do
        user_session @teacher_1
        delete "/api/v1/users/#{@teacher_1.id}/content_shares/#{@sent_share.id}"
        expect(response).to have_http_status(:ok)
        expect(ContentShare.where(id: @sent_share.id).exists?).to be false
      end

      it "scopes to user" do
        user_session @teacher_2
        delete "/api/v1/users/#{@teacher_2.id}/content_shares/#{@sent_share.id}"
        expect(response).to have_http_status(:not_found)
      end

      it "requires user=self" do
        user_session @teacher_1
        delete "/api/v1/users/#{@teacher_2.id}/content_shares/#{@sent_share.id}"
        expect(response).to have_http_status(:forbidden)
      end
    end

    describe "POST #add_users" do
      before do
        @teacher_3 = user_with_pseudonym(active_user: true)
        @shared_course.enroll_teacher(@teacher_3, enrollment_state: "active")
      end

      it "adds users" do
        user_session @teacher_1
        post "/api/v1/users/#{@teacher_1.id}/content_shares/#{@sent_share.id}/add_users", params: { receiver_ids: [@teacher_3.id] }
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json["receivers"].length).to eq 2
        expect(json["receivers"].pluck("id")).to match_array([@teacher_2.id, @teacher_3.id])
        expect(@sent_share.reload.receivers.pluck(:id)).to match_array([@teacher_2.id, @teacher_3.id])
      end

      it "ignores users already shared" do
        user_session @teacher_1
        post "/api/v1/users/#{@teacher_1.id}/content_shares/#{@sent_share.id}/add_users", params: { receiver_ids: [@teacher_2.id, @teacher_3.id] }
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json["receivers"].pluck("id")).to match_array([@teacher_2.id, @teacher_3.id])
        expect(@sent_share.reload.receivers.pluck(:id)).to match_array([@teacher_2.id, @teacher_3.id])
      end

      it "allows sharing with yourself, because why not" do
        user_session @teacher_1
        post "/api/v1/users/#{@teacher_1.id}/content_shares/#{@sent_share.id}/add_users", params: { receiver_ids: [@teacher_1.id, @teacher_3.id] }
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json["receivers"].pluck("id")).to match_array([@teacher_1.id, @teacher_2.id, @teacher_3.id])
        expect(@sent_share.reload.receivers.pluck(:id)).to match_array([@teacher_1.id, @teacher_2.id, @teacher_3.id])
      end

      it "complains if no valid users are included" do
        user_session @teacher_1
        post "/api/v1/users/#{@teacher_1.id}/content_shares/#{@sent_share.id}/add_users", params: { receiver_ids: [0] }
        expect(response).to have_http_status(:bad_request)
        expect(response.parsed_body["message"]).to eq("No valid receiving users found")
      end

      it "drops unauthorized recipients" do
        user_session @teacher_1
        unrelated_user = user_with_pseudonym(active_user: true)
        post "/api/v1/users/#{@teacher_1.id}/content_shares/#{@sent_share.id}/add_users", params: { receiver_ids: [unrelated_user.id, @teacher_3.id] }
        expect(response).to have_http_status(:ok)
        expect(@sent_share.reload.receivers.pluck(:id)).to match_array([@teacher_2.id, @teacher_3.id])
        expect(ReceivedContentShare.where(user_id: unrelated_user.id)).not_to exist
      end

      it "rejects when receiver_ids exceeds the per-request cap" do
        user_session @teacher_1
        expect do
          post "/api/v1/users/#{@teacher_1.id}/content_shares/#{@sent_share.id}/add_users", params: { receiver_ids: Array.new(ContentSharesController::MAX_RECEIVERS + 1, @teacher_3.id) }
        end.not_to change { @sent_share.reload.receivers.pluck(:id) }
        expect(response).to have_http_status(:bad_request)
        expect(response.parsed_body["message"]).to include("Too many recipients")
      end

      it "disallows resharing somebody else's share" do
        user_session @teacher_2
        post "/api/v1/users/#{@teacher_2.id}/content_shares/#{@received_share.id}/add_users", params: { receiver_ids: [@teacher_3.id] }
        expect(response).to have_http_status(:bad_request)
        expect(response.parsed_body["message"]).to eq("Content share not owned by you")
      end

      it "scopes to user" do
        user_session @teacher_2
        post "/api/v1/users/#{@teacher_2.id}/content_shares/#{@sent_share.id}/add_users", params: { receiver_ids: [@teacher_3.id] }
        expect(response).to have_http_status(:not_found)
      end

      it "requires user=self" do
        user_session @teacher_2
        post "/api/v1/users/#{@teacher_1.id}/content_shares/#{@sent_share.id}/add_users", params: { receiver_ids: [@teacher_3.id] }
        expect(response).to have_http_status(:forbidden)
      end
    end

    describe "GET #unread_count" do
      it "returns the correct count" do
        user_session @teacher_2
        get "/api/v1/users/#{@teacher_2.id}/content_shares/unread_count"
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json["unread_count"]).to eq(1)
      end
    end

    describe "PUT #update" do
      it "marks a content share read" do
        user_session @teacher_2
        put "/api/v1/users/#{@teacher_2.id}/content_shares/#{@received_share.id}", params: { read_state: "read" }
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json["read_state"]).to eq "read"
        expect(json["content_export"]["id"]).to eq @export.id
        expect(@received_share.reload.read_state).to eq "read"
      end

      it "rejects an invalid read state" do
        user_session @teacher_2
        put "/api/v1/users/#{@teacher_2.id}/content_shares/#{@received_share.id}", params: { read_state: "malarkey" }
        expect(response).to have_http_status(:bad_request)
      end

      it "ignores invalid attributes" do
        user_session @teacher_2
        put "/api/v1/users/#{@teacher_2.id}/content_shares/#{@received_share.id}", params: { content_export_id: 0, read_state: "read" }
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json["read_state"]).to eq "read"
        expect(json["content_export"]["id"]).to eq @export.id
        expect(@received_share.reload.read_state).to eq "read"
        expect(@received_share.reload.content_export_id).to eq @export.id
      end

      it "scopes to user" do
        user_session @teacher_1
        put "/api/v1/users/#{@teacher_1.id}/content_shares/#{@received_share.id}", params: { read_state: "read" }
        expect(response).to have_http_status(:not_found)
      end

      it "requires user=self" do
        user_session @teacher_1
        put "/api/v1/users/#{@teacher_2.id}/content_shares/#{@received_share.id}", params: { read_state: "read" }
        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end
