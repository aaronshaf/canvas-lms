# frozen_string_literal: true

#
# Copyright (C) 2025 - present Instructure, Inc.
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

RSpec.describe Accessibility::GenerateController, type: :request do
  describe "#create_table_caption" do
    context "when generation succeeds" do
      it "returns the generated caption" do
        course_with_teacher(active_all: true)
        user_session(@teacher)
        @course.root_account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_ai_table_caption_generation)
        Account.site_admin.enable_feature!(:a11y_checker_ai_features)
        @course.root_account.enable_feature!(:a11y_checker_ignite_ai)
        stub_const("CedarClient", Class.new do
          def self.conversation(*)
            Struct.new(:response).new(response: "Generated Caption")
          end
        end)
        wiki_page = @course.wiki_pages.create!(title: "test page", body: "<table><tr><td>Data</td></tr></table>")

        post "/courses/#{@course.id}/accessibility/generate/table_caption", params: {
          content_type: "Page",
          content_id: wiki_page.id.to_s,
          path: "./table"
        }

        expect(response).to have_http_status(:ok)
        expect(response.parsed_body).to eq({ "value" => "Generated Caption" })
      end
    end

    context "with missing parameters" do
      it "returns bad request" do
        course_with_teacher(active_all: true)
        user_session(@teacher)
        @course.root_account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_ai_table_caption_generation)
        Account.site_admin.enable_feature!(:a11y_checker_ai_features)
        @course.root_account.enable_feature!(:a11y_checker_ignite_ai)

        post "/courses/#{@course.id}/accessibility/generate/table_caption", params: {
          content_type: "Page"
        }

        expect(response).to have_http_status(:bad_request)
        expect(response.parsed_body).to have_key("error")
      end
    end

    context "when resource is not found" do
      it "returns bad request" do
        course_with_teacher(active_all: true)
        user_session(@teacher)
        @course.root_account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_ai_table_caption_generation)
        Account.site_admin.enable_feature!(:a11y_checker_ai_features)
        @course.root_account.enable_feature!(:a11y_checker_ignite_ai)

        post "/courses/#{@course.id}/accessibility/generate/table_caption", params: {
          content_type: "Page",
          content_id: "999999",
          path: "./table"
        }

        expect(response).to have_http_status(:bad_request)
        expect(response.parsed_body).to have_key("error")
      end
    end

    context "when element is not a table" do
      it "returns bad request" do
        course_with_teacher(active_all: true)
        user_session(@teacher)
        @course.root_account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_ai_table_caption_generation)
        Account.site_admin.enable_feature!(:a11y_checker_ai_features)
        @course.root_account.enable_feature!(:a11y_checker_ignite_ai)
        wiki_page_no_table = @course.wiki_pages.create!(title: "test page", body: "<div>No table</div>")

        post "/courses/#{@course.id}/accessibility/generate/table_caption", params: {
          content_type: "Page",
          content_id: wiki_page_no_table.id.to_s,
          path: "./div"
        }

        expect(response).to have_http_status(:bad_request)
        expect(response.parsed_body).to have_key("error")
      end
    end
  end

  describe "#create_image_alt_text" do
    context "with valid wiki page and image" do
      it "generates alt text for the image" do
        course_with_teacher(active_all: true)
        user_session(@teacher)
        @course.root_account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_ai_alt_text_generation)
        Account.site_admin.enable_feature!(:a11y_checker_ai_features)
        @course.root_account.enable_feature!(:a11y_checker_ignite_ai)
        stub_const("CedarClient", Class.new do
          def self.generate_alt_text(*)
            Struct.new(:image).new(image: { "altText" => "Generated alt text" })
          end
        end)
        attachment = attachment_model(context: @teacher, size: 1.megabyte, content_type: "image/png")
        wiki_page = @course.wiki_pages.build(title: "Test Page", body: "<div><p><img src=\"/files/#{attachment.id}\" /></p></div>")
        wiki_page.updating_user = @teacher
        wiki_page.save!
        allow(Attachment).to receive(:find_by).with(id: attachment.id.to_s).and_return(attachment)
        allow(attachment).to receive_messages(grants_right?: true, open: StringIO.new("fake image data"))

        post "/courses/#{@course.id}/accessibility/generate/alt_text", params: {
          content_type: "Page",
          content_id: wiki_page.id,
          path: "./div/p/img"
        }

        expect(response).to have_http_status(:ok)
        expect(response.parsed_body).to eq({ "value" => "Generated alt text" })
      end

      it "returns forbidden when user cannot read attachment" do
        course_with_teacher(active_all: true)
        user_session(@teacher)
        @course.root_account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_ai_alt_text_generation)
        Account.site_admin.enable_feature!(:a11y_checker_ai_features)
        @course.root_account.enable_feature!(:a11y_checker_ignite_ai)
        stub_const("CedarClient", Class.new do
          def self.generate_alt_text(*)
            Struct.new(:image).new(image: { "altText" => "Generated alt text" })
          end
        end)
        attachment = attachment_model(context: @teacher, size: 1.megabyte, content_type: "image/png")
        wiki_page = @course.wiki_pages.build(title: "Test Page", body: "<div><p><img src=\"/files/#{attachment.id}\" /></p></div>")
        wiki_page.updating_user = @teacher
        wiki_page.save!
        allow(Attachment).to receive(:find_by).with(id: attachment.id.to_s).and_return(attachment)
        allow(attachment).to receive(:grants_right?).and_return(false)

        post "/courses/#{@course.id}/accessibility/generate/alt_text", params: {
          content_type: "Page",
          content_id: wiki_page.id,
          path: "./div/p/img"
        }

        expect(response).to have_http_status(:forbidden)
        expect(response.parsed_body["error"]).to eq("You do not have permission to access this attachment")
      end

      it "returns request_entity_too_large when image is too large" do
        course_with_teacher(active_all: true)
        user_session(@teacher)
        @course.root_account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_ai_alt_text_generation)
        Account.site_admin.enable_feature!(:a11y_checker_ai_features)
        @course.root_account.enable_feature!(:a11y_checker_ignite_ai)
        stub_const("CedarClient", Class.new do
          def self.generate_alt_text(*)
            Struct.new(:image).new(image: { "altText" => "Generated alt text" })
          end
        end)
        attachment = attachment_model(context: @teacher, size: 1.megabyte, content_type: "image/png")
        wiki_page = @course.wiki_pages.build(title: "Test Page", body: "<div><p><img src=\"/files/#{attachment.id}\" /></p></div>")
        wiki_page.updating_user = @teacher
        wiki_page.save!
        large_attachment = attachment_model(context: @teacher, size: 4.megabytes, content_type: "image/png")
        wiki_page.update!(body: "<div><p><img src=\"/files/#{large_attachment.id}\" /></p></div>")
        allow(Attachment).to receive(:find_by).with(id: large_attachment.id.to_s).and_return(large_attachment)
        allow(large_attachment).to receive(:grants_right?).and_return(true)

        post "/courses/#{@course.id}/accessibility/generate/alt_text", params: {
          content_type: "Page",
          content_id: wiki_page.id,
          path: "./div/p/img"
        }

        expect(response).to have_http_status(:content_too_large)
        expect(response.parsed_body["error"]).to eq("Attachment exceeds the maximum allowed size")
      end

      it "returns unsupported_media_type when image type is not supported" do
        course_with_teacher(active_all: true)
        user_session(@teacher)
        @course.root_account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_ai_alt_text_generation)
        Account.site_admin.enable_feature!(:a11y_checker_ai_features)
        @course.root_account.enable_feature!(:a11y_checker_ignite_ai)
        stub_const("CedarClient", Class.new do
          def self.generate_alt_text(*)
            Struct.new(:image).new(image: { "altText" => "Generated alt text" })
          end
        end)
        attachment = attachment_model(context: @teacher, size: 1.megabyte, content_type: "image/png")
        wiki_page = @course.wiki_pages.build(title: "Test Page", body: "<div><p><img src=\"/files/#{attachment.id}\" /></p></div>")
        wiki_page.updating_user = @teacher
        wiki_page.save!
        unsupported_attachment = attachment_model(context: @teacher, size: 1.megabyte, content_type: "application/pdf")
        wiki_page.update!(body: "<div><p><img src=\"/files/#{unsupported_attachment.id}\" /></p></div>")
        allow(Attachment).to receive(:find_by).with(id: unsupported_attachment.id.to_s).and_return(unsupported_attachment)
        allow(unsupported_attachment).to receive(:grants_right?).and_return(true)

        post "/courses/#{@course.id}/accessibility/generate/alt_text", params: {
          content_type: "Page",
          content_id: wiki_page.id,
          path: "./div/p/img"
        }

        expect(response).to have_http_status(:unsupported_media_type)
        expect(response.parsed_body["error"]).to eq("Attachment type is not supported")
      end
    end

    context "with external image" do
      it "returns error when image is not from Canvas" do
        course_with_teacher(active_all: true)
        user_session(@teacher)
        @course.root_account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_ai_alt_text_generation)
        Account.site_admin.enable_feature!(:a11y_checker_ai_features)
        @course.root_account.enable_feature!(:a11y_checker_ignite_ai)
        wiki_page = @course.wiki_pages.build(title: "Test Page", body: "<img src=\"https://example.com/image.png\" />")
        wiki_page.updating_user = @teacher
        wiki_page.save!

        post "/courses/#{@course.id}/accessibility/generate/alt_text", params: {
          content_type: "Page",
          content_id: wiki_page.id,
          path: "./img"
        }

        expect(response).to have_http_status(:bad_request)
        expect(response.parsed_body["error"]).to eq("Invalid or missing parameters")
      end
    end

    context "with missing image" do
      it "returns not_found when attachment does not exist" do
        course_with_teacher(active_all: true)
        user_session(@teacher)
        @course.root_account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_ai_alt_text_generation)
        Account.site_admin.enable_feature!(:a11y_checker_ai_features)
        @course.root_account.enable_feature!(:a11y_checker_ignite_ai)
        wiki_page = @course.wiki_pages.build(title: "Test Page", body: "<div><p><img src=\"/files/999999\" /></p></div>")
        wiki_page.updating_user = @teacher
        wiki_page.save!

        post "/courses/#{@course.id}/accessibility/generate/alt_text", params: {
          content_type: "Page",
          content_id: wiki_page.id,
          path: "./div/p/img"
        }

        expect(response).to have_http_status(:not_found)
        expect(response.parsed_body["error"]).to eq("Attachment not found")
      end
    end

    context "with invalid parameters" do
      it "returns bad_request for missing parameters" do
        course_with_teacher(active_all: true)
        user_session(@teacher)
        @course.root_account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_ai_alt_text_generation)
        Account.site_admin.enable_feature!(:a11y_checker_ai_features)
        @course.root_account.enable_feature!(:a11y_checker_ignite_ai)

        post "/courses/#{@course.id}/accessibility/generate/alt_text", params: {
          content_type: "",
          content_id: "",
          path: ""
        }

        expect(response).to have_http_status(:bad_request)
        expect(response.parsed_body["error"]).to eq("Invalid or missing parameters")
      end
    end
  end
end

# Controller spec tests for private methods
RSpec.describe Accessibility::GenerateController do
  let(:course) { Course.create! }

  describe "#check_authorized_action" do
    context "when a11y_checker feature flag disabled" do
      it "renders forbidden" do
        allow(course).to receive(:a11y_checker_enabled?).and_return(false)

        expect(controller).to receive(:render).with(status: :forbidden)
        controller.instance_variable_set(:@context, course)
        controller.send(:check_authorized_action)
      end
    end
  end

  describe "#check_table_caption_feature" do
    before do
      controller.instance_variable_set(:@context, course)
    end

    context "when table caption feature flag is disabled" do
      it "renders forbidden" do
        allow(course).to receive(:a11y_checker_ai_table_caption_generation?).and_return(false)

        expect(controller).to receive(:render).with(status: :forbidden)
        controller.send(:check_table_caption_feature)
      end
    end

    context "when table caption feature flag is enabled" do
      it "does not render forbidden" do
        allow(course).to receive(:a11y_checker_ai_table_caption_generation?).and_return(true)

        expect(controller).not_to receive(:render)
        controller.send(:check_table_caption_feature)
      end
    end
  end

  describe "#check_alt_text_feature" do
    before do
      controller.instance_variable_set(:@context, course)
    end

    context "when alt text feature flag is disabled" do
      it "renders forbidden" do
        allow(course).to receive(:a11y_checker_ai_alt_text_generation?).and_return(false)

        expect(controller).to receive(:render).with(status: :forbidden)
        controller.send(:check_alt_text_feature)
      end
    end

    context "when alt text feature flag is enabled" do
      it "does not render forbidden" do
        allow(course).to receive(:a11y_checker_ai_alt_text_generation?).and_return(true)

        expect(controller).not_to receive(:render)
        controller.send(:check_alt_text_feature)
      end
    end
  end
end
