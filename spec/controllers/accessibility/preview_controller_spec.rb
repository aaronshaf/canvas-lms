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

RSpec.describe Accessibility::PreviewController, type: :request do
  include Factories

  describe "#create" do
    it "for a wiki page returns the correct response" do
      course_with_teacher(active_all: true)
      user_session(@teacher)
      @course.root_account.enable_feature!(:a11y_checker_ga1)
      page = @course.wiki_pages.create!(title: "test page", body: "<div>test body</div>")

      post "/courses/#{@course.id}/accessibility/preview", params: {
        rule: "img-alt",
        content_type: "Page",
        content_id: page.id.to_s,
        path: ".//div",
        value: "fixed content"
      }
      expect(response).to have_http_status(:ok)
      expected_content = "<div style=\"display: flex; justify-content: center; align-items: center; width: 100%; height: 100%;\"><div alt=\"fixed content\" style=\"max-width: 100%; max-height: 100%; object-fit: contain;\">test body</div></div>"
      expect(response.parsed_body["content"]).to eq(expected_content)
      expect(response.parsed_body["path"]).to eq("./div")
    end

    it "for a wiki page sanitizes the value before passing it to update_preview" do
      course_with_teacher(active_all: true)
      user_session(@teacher)
      @course.root_account.enable_feature!(:a11y_checker_ga1)
      malicious_value = "<script>alert(1)</script>Caption text"
      page = @course.wiki_pages.create!(title: "test page", body: "<div>content</div>")

      post "/courses/#{@course.id}/accessibility/preview", params: {
        rule: "img-alt",
        content_type: "Page",
        content_id: page.id.to_s,
        path: ".//div",
        value: malicious_value
      }
      expected_content = "<div style=\"display: flex; justify-content: center; align-items: center; width: 100%; height: 100%;\"><div alt=\"Caption text\" style=\"max-width: 100%; max-height: 100%; object-fit: contain;\">content</div></div>"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["content"]).to eq(expected_content)
      expect(response.parsed_body["path"]).to eq("./div")
    end

    it "for a wiki page passes nil to update_preview when the value key is absent" do
      course_with_teacher(active_all: true)
      user_session(@teacher)
      @course.root_account.enable_feature!(:a11y_checker_ga1)
      page = @course.wiki_pages.create!(title: "test page", body: "<div>test body</div>")

      post "/courses/#{@course.id}/accessibility/preview", params: {
        rule: "img-alt",
        content_type: "Page",
        content_id: page.id.to_s,
        path: ".//div"
      }
      expected_content = "<div style=\"display: flex; justify-content: center; align-items: center; width: 100%; height: 100%;\"><div role=\"presentation\" alt=\"\" style=\"max-width: 100%; max-height: 100%; object-fit: contain;\">test body</div></div>"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["content"]).to eq(expected_content)
      expect(response.parsed_body["path"]).to eq("./div")
    end

    it "for an assignment returns the correct response" do
      course_with_teacher(active_all: true)
      user_session(@teacher)
      @course.root_account.enable_feature!(:a11y_checker_ga1)
      assignment = @course.assignments.create!(description: "<div>Assignment</div>")

      post "/courses/#{@course.id}/accessibility/preview", params: {
        rule: "img-alt",
        content_type: "Assignment",
        content_id: assignment.id.to_s,
        path: ".//div",
        value: "fixed"
      }
      expected_content = "<div style=\"display: flex; justify-content: center; align-items: center; width: 100%; height: 100%;\"><div alt=\"fixed\" style=\"max-width: 100%; max-height: 100%; object-fit: contain;\">Assignment</div></div>"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["content"]).to eq(expected_content)
      expect(response.parsed_body["path"]).to eq("./div")
    end

    it "with invalid resource content_type returns an error" do
      course_with_teacher(active_all: true)
      user_session(@teacher)
      @course.root_account.enable_feature!(:a11y_checker_ga1)

      post "/courses/#{@course.id}/accessibility/preview", params: {
        rule: "img-alt",
        content_type: "InvalidType",
        content_id: "123",
        path: ".//div",
        value: "test"
      }
      expect(response).to have_http_status(:internal_server_error)
    end
  end

  describe "#show" do
    context "with missing issue_id parameter" do
      it "returns bad request" do
        course_with_teacher(active_all: true)
        user_session(@teacher)
        @course.root_account.enable_feature!(:a11y_checker_ga1)

        get "/courses/#{@course.id}/accessibility/preview"
        expect(response).to have_http_status(:bad_request)
        expect(response.body).to be_empty
      end
    end

    context "with non-existent issue_id" do
      it "returns not found" do
        course_with_teacher(active_all: true)
        user_session(@teacher)
        @course.root_account.enable_feature!(:a11y_checker_ga1)

        get "/courses/#{@course.id}/accessibility/preview", params: { issue_id: "99999" }
        expect(response).to have_http_status(:not_found)
        expect(response.parsed_body["error"]).to include("Couldn't find AccessibilityIssue")
      end
    end

    context "with issue_id belonging to a different course" do
      it "returns not found" do
        course_with_teacher(active_all: true)
        user_session(@teacher)
        @course.root_account.enable_feature!(:a11y_checker_ga1)

        other_course = Course.create!
        other_wiki_page = other_course.wiki_pages.create!(title: "Other", body: "Other body")
        other_issue = accessibility_issue_model(course: other_course, context: other_wiki_page, node_path: nil)

        get "/courses/#{@course.id}/accessibility/preview", params: { issue_id: other_issue.id.to_s }
        expect(response).to have_http_status(:not_found)
      end
    end

    context "for an assignment" do
      it "returns the assignment description" do
        course_with_teacher(active_all: true)
        user_session(@teacher)
        @course.root_account.enable_feature!(:a11y_checker_ga1)

        assignment = @course.assignments.create!(description: "Assignment description")
        issue = accessibility_issue_model(course: @course, context: assignment, node_path: nil)

        get "/courses/#{@course.id}/accessibility/preview", params: { issue_id: issue.id.to_s }
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body).to eq({ "content" => "Assignment description" })
      end
    end

    context "for a wiki page" do
      it "returns the wiki page body" do
        course_with_teacher(active_all: true)
        user_session(@teacher)
        @course.root_account.enable_feature!(:a11y_checker_ga1)

        wiki_page = @course.wiki_pages.create!(title: "Test Page", body: "Wiki page body")
        issue = accessibility_issue_model(course: @course, context: wiki_page, node_path: nil)

        get "/courses/#{@course.id}/accessibility/preview", params: { issue_id: issue.id.to_s }
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body).to eq({ "content" => "Wiki page body" })
      end
    end

    context "with unknown content type" do
      it "returns an error for unknown content type" do
        course_with_teacher(active_all: true)
        user_session(@teacher)
        @course.root_account.enable_feature!(:a11y_checker_ga1)

        wiki_page = @course.wiki_pages.create!(title: "Test Page", body: "Test content")
        issue = accessibility_issue_model(course: @course, context: wiki_page, node_path: nil)

        allow_any_instance_of(Accessibility::ContentLoader).to receive(:resource_html_content).and_raise(
          Accessibility::ContentLoader::UnsupportedResourceTypeError.new("Unsupported resource type: Course")
        )

        get "/courses/#{@course.id}/accessibility/preview", params: { issue_id: issue.id.to_s }
        expect(response).to have_http_status(:unprocessable_content)
        expect(response.parsed_body["error"]).to include("Unsupported resource type")
      end
    end

    context "with path parameter for element extraction" do
      context "when element exists" do
        it "returns only the specified element" do
          course_with_teacher(active_all: true)
          user_session(@teacher)
          @course.root_account.enable_feature!(:a11y_checker_ga1)

          wiki_page = @course.wiki_pages.create!(title: "Test Page", body: "<div><h1>Page Title</h1><p>Page content</p></div>")
          issue = accessibility_issue_model(course: @course, context: wiki_page, node_path: ".//h1")

          get "/courses/#{@course.id}/accessibility/preview", params: { issue_id: issue.id.to_s }
          expect(response).to have_http_status(:ok)
          expect(response.parsed_body).to eq({ "content" => "<h1>Page Title</h1>" })
        end
      end

      context "when element does not exist" do
        it "returns element not found error" do
          course_with_teacher(active_all: true)
          user_session(@teacher)
          @course.root_account.enable_feature!(:a11y_checker_ga1)

          wiki_page = @course.wiki_pages.create!(title: "Test Page", body: "<div><h1>Page Title</h1><p>Page content</p></div>")
          issue = accessibility_issue_model(course: @course, context: wiki_page, node_path: ".//nonexistent")

          get "/courses/#{@course.id}/accessibility/preview", params: { issue_id: issue.id.to_s }
          expect(response).to have_http_status(:not_found)
          expect(response.parsed_body["error"]).to include("Element not found")
        end
      end

      context "when path is empty string" do
        it "returns full content (treats empty path as no path)" do
          course_with_teacher(active_all: true)
          user_session(@teacher)
          @course.root_account.enable_feature!(:a11y_checker_ga1)

          wiki_page = @course.wiki_pages.create!(title: "Test Page", body: "<div><h1>Page Title</h1><p>Page content</p></div>")
          issue = accessibility_issue_model(course: @course, context: wiki_page, node_path: "")

          get "/courses/#{@course.id}/accessibility/preview", params: { issue_id: issue.id.to_s }
          expect(response).to have_http_status(:ok)
          expect(response.parsed_body).to eq({ "content" => "<div><h1>Page Title</h1><p>Page content</p></div>" })
        end
      end

      context "for assignment with path" do
        it "returns only the specified element from assignment" do
          course_with_teacher(active_all: true)
          user_session(@teacher)
          @course.root_account.enable_feature!(:a11y_checker_ga1)

          assignment = @course.assignments.create!(description: "<div><h2>Assignment Title</h2><p>Assignment description</p></div>")
          issue = accessibility_issue_model(course: @course, context: assignment, node_path: ".//h2")

          get "/courses/#{@course.id}/accessibility/preview", params: { issue_id: issue.id.to_s }
          expect(response).to have_http_status(:ok)
          expect(response.parsed_body).to eq({ "content" => "<h2>Assignment Title</h2>" })
        end
      end

      context "with rule_id parameter" do
        it "passes rule_id to ContentLoader and uses rule's issue_preview" do
          course_with_teacher(active_all: true)
          user_session(@teacher)
          @course.root_account.enable_feature!(:a11y_checker_ga1)

          rule_wiki_page = @course.wiki_pages.create!(title: "Test Page", body: "<div><h1>Test Header</h1></div>")
          issue = accessibility_issue_model(course: @course, context: rule_wiki_page, rule_type: "img-alt", node_path: ".//h1")
          mock_rule_instance = instance_double(Accessibility::Rule)
          mock_rule_registry = { "img-alt" => mock_rule_instance }

          allow(Accessibility::Rule).to receive(:registry).and_return(mock_rule_registry)
          allow(mock_rule_instance).to receive(:issue_preview).and_return("<h1>Test Header</h1><p>Additional context</p>")

          get "/courses/#{@course.id}/accessibility/preview", params: { issue_id: issue.id.to_s }
          expect(response).to have_http_status(:ok)
          expect(response.parsed_body["content"]).to eq("<h1>Test Header</h1><p>Additional context</p>")
        end
      end

      context "with rule_id but no matching rule" do
        it "falls back to default HTML when rule not found" do
          course_with_teacher(active_all: true)
          user_session(@teacher)
          @course.root_account.enable_feature!(:a11y_checker_ga1)

          no_rule_wiki_page = @course.wiki_pages.create!(title: "Test Page", body: "<div><h1>Title</h1></div>")
          issue = accessibility_issue_model(course: @course, context: no_rule_wiki_page, rule_type: "img-alt", node_path: ".//h1")

          allow(Accessibility::Rule).to receive(:registry).and_return({})

          get "/courses/#{@course.id}/accessibility/preview", params: { issue_id: issue.id.to_s }
          expect(response).to have_http_status(:ok)
          expect(response.parsed_body).to eq({ "content" => "<h1>Title</h1>" })
        end
      end

      context "with rule that provides metadata" do
        it "includes metadata in the response" do
          course_with_teacher(active_all: true)
          user_session(@teacher)
          @course.root_account.enable_feature!(:a11y_checker_ga1)

          metadata_wiki_page = @course.wiki_pages.create!(
            title: "Test Page",
            body: '<div><span style="color: #FF0000; background-color: #FFFFFF;">Low contrast text</span></div>'
          )
          issue = accessibility_issue_model(course: @course, context: metadata_wiki_page, rule_type: "small-text-contrast", node_path: ".//span")
          mock_rule_instance = instance_double(Accessibility::Rules::SmallTextContrastRule)
          mock_rule_registry = { "small-text-contrast" => mock_rule_instance }

          allow(Accessibility::Rule).to receive(:registry).and_return(mock_rule_registry)
          allow(mock_rule_instance).to receive_messages(
            issue_preview: '<span style="color: #FF0000; background-color: #FFFFFF;">Low contrast text</span>',
            issue_metadata: { foreground: "#FF0000", background: "#FFFFFF" }
          )

          get "/courses/#{@course.id}/accessibility/preview", params: { issue_id: issue.id.to_s }
          expect(response).to have_http_status(:ok)
          expect(response.parsed_body).to eq({
                                               "content" => '<span style="color: #FF0000; background-color: #FFFFFF;">Low contrast text</span>',
                                               "foreground" => "#FF0000",
                                               "background" => "#FFFFFF"
                                             })
        end
      end
    end

    context "when the resource has been updated since the issue was detected" do
      it "returns conflict status" do
        course_with_teacher(active_all: true)
        user_session(@teacher)
        @course.root_account.enable_feature!(:a11y_checker_ga1)

        stale_wiki_page = @course.wiki_pages.create!(title: "Stale Page", body: "Original body")
        issue = accessibility_issue_model(course: @course, context: stale_wiki_page, node_path: nil)

        allow_any_instance_of(Accessibility::ContentLoader).to receive(:resource_updated_since_issue?).and_return(true)

        get "/courses/#{@course.id}/accessibility/preview", params: { issue_id: issue.id.to_s }
        expect(response).to have_http_status(:conflict)
      end

      it "returns a stale resource error message" do
        course_with_teacher(active_all: true)
        user_session(@teacher)
        @course.root_account.enable_feature!(:a11y_checker_ga1)

        stale_wiki_page = @course.wiki_pages.create!(title: "Stale Page", body: "Original body")
        issue = accessibility_issue_model(course: @course, context: stale_wiki_page, node_path: nil)

        allow_any_instance_of(Accessibility::ContentLoader).to receive(:resource_updated_since_issue?).and_return(true)

        get "/courses/#{@course.id}/accessibility/preview", params: { issue_id: issue.id.to_s }
        expect(response.parsed_body["error"]).to include("Resource has been updated since this issue was detected")
      end
    end
  end
end

# Controller spec tests for private methods
RSpec.describe Accessibility::PreviewController do
  let(:course) { Course.create! }

  context "check_authorized_action" do
    context "when a11y_checker feature flag disabled" do
      it "renders forbidden" do
        allow(course).to receive(:a11y_checker_enabled?).and_return(false)

        expect(controller).to receive(:render).with(status: :forbidden)
        controller.instance_variable_set(:@context, course)
        controller.send(:check_authorized_action)
      end
    end
  end
end
