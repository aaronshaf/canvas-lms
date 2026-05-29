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

# rubocop:disable RSpec/BeEql
describe Accessibility::IssueSummaryController, type: :request do
  describe "GET #show" do
    context "with only 1 course and only active issues" do
      context "with 3 issues of same rule type" do
        it "returns active count 3, resolved count 0, and correct rule breakdown" do
          course_with_teacher(active_all: true)
          user_session(@teacher)
          @course.root_account.enable_feature!(:a11y_checker_ga1)
          wiki_page = wiki_page_model(course: @course)
          accessibility_scan = AccessibilityResourceScan.create!(
            course_id: @course.id,
            wiki_page_id: wiki_page.id
          )

          3.times do |i|
            accessibility_issue_model(
              course: @course,
              accessibility_resource_scan: accessibility_scan,
              node_path: "//img[#{i}]",
              rule_type: Accessibility::Rules::ImgAltRule.id,
              workflow_state: "active"
            )
          end

          get "/courses/#{@course.id}/accessibility/issue_summary"

          expect(response).to have_http_status(:ok)
          json_response = response.parsed_body

          expect(json_response["active"]).to eql(3)
          expect(json_response["resolved"]).to eql(0)
          expect(json_response["by_rule_type"]).to eql({
                                                         Accessibility::Rules::ImgAltRule.id => 3
                                                       })
        end
      end

      context "with 2 issues of different rule types" do
        it "returns active count 2, resolved count 0, and correct rule breakdown" do
          course_with_teacher(active_all: true)
          user_session(@teacher)
          @course.root_account.enable_feature!(:a11y_checker_ga1)
          wiki_page = wiki_page_model(course: @course)
          accessibility_scan = AccessibilityResourceScan.create!(
            course_id: @course.id,
            wiki_page_id: wiki_page.id
          )

          accessibility_issue_model(
            course: @course,
            accessibility_resource_scan: accessibility_scan,
            rule_type: Accessibility::Rules::ImgAltRule.id,
            node_path: "//img[1]",
            workflow_state: "active"
          )
          accessibility_issue_model(
            course: @course,
            accessibility_resource_scan: accessibility_scan,
            rule_type: Accessibility::Rules::ImgAltFilenameRule.id,
            node_path: "//img[2]",
            workflow_state: "active"
          )

          get "/courses/#{@course.id}/accessibility/issue_summary"

          expect(response).to have_http_status(:ok)
          json_response = response.parsed_body

          expect(json_response["active"]).to eql(2)
          expect(json_response["resolved"]).to eql(0)
          expect(json_response["by_rule_type"]).to eql({
                                                         Accessibility::Rules::ImgAltRule.id => 1,
                                                         Accessibility::Rules::ImgAltFilenameRule.id => 1
                                                       })
        end
      end

      context "with 0 issues" do
        it "returns active count 0, resolved count 0, and empty rule breakdown" do
          course_with_teacher(active_all: true)
          user_session(@teacher)
          @course.root_account.enable_feature!(:a11y_checker_ga1)

          get "/courses/#{@course.id}/accessibility/issue_summary"

          expect(response).to have_http_status(:ok)
          json_response = response.parsed_body

          expect(json_response["active"]).to eql(0)
          expect(json_response["resolved"]).to eql(0)
          expect(json_response["by_rule_type"]).to eq({})
        end
      end
    end

    context "with only 1 course but has inactive issues as well" do
      context "with 3 active + 2 inactive issues of same rule type" do
        it "returns active count 3, resolved count 2, and correct rule breakdown (ignoring inactive)" do
          course_with_teacher(active_all: true)
          user_session(@teacher)
          @course.root_account.enable_feature!(:a11y_checker_ga1)
          wiki_page = wiki_page_model(course: @course)
          accessibility_scan = AccessibilityResourceScan.create!(
            course_id: @course.id,
            wiki_page_id: wiki_page.id
          )

          3.times do |i|
            accessibility_issue_model(
              course: @course,
              accessibility_resource_scan: accessibility_scan,
              node_path: "//img[#{i}]",
              workflow_state: "active",
              rule_type: Accessibility::Rules::ImgAltRule.id
            )
          end

          2.times do |i|
            accessibility_issue_model(
              course: @course,
              accessibility_resource_scan: accessibility_scan,
              node_path: "//img[#{i}]",
              workflow_state: "resolved",
              rule_type: Accessibility::Rules::ImgAltRule.id
            )
          end

          get "/courses/#{@course.id}/accessibility/issue_summary"

          expect(response).to have_http_status(:ok)
          json_response = response.parsed_body

          expect(json_response["active"]).to eql(3)
          expect(json_response["resolved"]).to eql(2)
          expect(json_response["by_rule_type"]).to eql({
                                                         Accessibility::Rules::ImgAltRule.id => 3
                                                       })
        end
      end

      context "with 2 active + 2 inactive issues of different rule types" do
        it "returns active count 2, resolved count 1, and correct rule breakdown (ignoring inactive)" do
          course_with_teacher(active_all: true)
          user_session(@teacher)
          @course.root_account.enable_feature!(:a11y_checker_ga1)
          wiki_page = wiki_page_model(course: @course)
          accessibility_scan = AccessibilityResourceScan.create!(
            course_id: @course.id,
            wiki_page_id: wiki_page.id
          )

          accessibility_issue_model(
            course: @course,
            accessibility_resource_scan: accessibility_scan,
            rule_type: Accessibility::Rules::ImgAltRule.id,
            node_path: "//img[1]",
            workflow_state: "active"
          )
          accessibility_issue_model(
            course: @course,
            accessibility_resource_scan: accessibility_scan,
            rule_type: Accessibility::Rules::ImgAltFilenameRule.id,
            node_path: "//img[2]",
            workflow_state: "active"
          )

          accessibility_issue_model(
            course: @course,
            accessibility_resource_scan: accessibility_scan,
            rule_type: Accessibility::Rules::ImgAltRule.id,
            node_path: "//img[1]",
            workflow_state: "resolved"
          )
          accessibility_issue_model(
            course: @course,
            accessibility_resource_scan: accessibility_scan,
            rule_type: Accessibility::Rules::ImgAltFilenameRule.id,
            node_path: "//img[2]",
            workflow_state: "dismissed"
          )

          get "/courses/#{@course.id}/accessibility/issue_summary"

          expect(response).to have_http_status(:ok)
          json_response = response.parsed_body

          expect(json_response["active"]).to eql(2)
          expect(json_response["resolved"]).to eql(1)
          expect(json_response["by_rule_type"]).to eql({
                                                         Accessibility::Rules::ImgAltRule.id => 1,
                                                         Accessibility::Rules::ImgAltFilenameRule.id => 1
                                                       })
        end
      end

      context "with 0 active + 2 inactive issues" do
        it "returns active count 0, resolved count 1, and empty rule breakdown" do
          course_with_teacher(active_all: true)
          user_session(@teacher)
          @course.root_account.enable_feature!(:a11y_checker_ga1)
          wiki_page = wiki_page_model(course: @course)
          accessibility_scan = AccessibilityResourceScan.create!(
            course_id: @course.id,
            wiki_page_id: wiki_page.id
          )

          accessibility_issue_model(
            course: @course,
            accessibility_resource_scan: accessibility_scan,
            rule_type: Accessibility::Rules::ImgAltRule.id,
            node_path: "//img[1]",
            workflow_state: "resolved"
          )
          accessibility_issue_model(
            course: @course,
            accessibility_resource_scan: accessibility_scan,
            rule_type: Accessibility::Rules::ImgAltFilenameRule.id,
            node_path: "//img[2]",
            workflow_state: "dismissed"
          )

          get "/courses/#{@course.id}/accessibility/issue_summary"

          expect(response).to have_http_status(:ok)
          json_response = response.parsed_body

          expect(json_response["active"]).to eql(0)
          expect(json_response["resolved"]).to eql(1)
          expect(json_response["by_rule_type"]).to eq({})
        end
      end
    end

    context "with discussion topics" do
      it "includes issues from discussion topics in the summary" do
        course_with_teacher(active_all: true)
        user_session(@teacher)
        @course.root_account.enable_feature!(:a11y_checker_ga1)
        wiki_page = wiki_page_model(course: @course)
        accessibility_scan = AccessibilityResourceScan.create!(
          course_id: @course.id,
          wiki_page_id: wiki_page.id
        )
        discussion_topic = discussion_topic_model(context: @course)
        discussion_scan = AccessibilityResourceScan.create!(
          course_id: @course.id,
          discussion_topic_id: discussion_topic.id
        )

        accessibility_issue_model(
          course: @course,
          accessibility_resource_scan: accessibility_scan,
          rule_type: Accessibility::Rules::ImgAltRule.id,
          node_path: "//img[1]",
          workflow_state: "active"
        )
        accessibility_issue_model(
          course: @course,
          accessibility_resource_scan: discussion_scan,
          rule_type: Accessibility::Rules::ImgAltFilenameRule.id,
          node_path: "//img[2]",
          workflow_state: "active"
        )

        get "/courses/#{@course.id}/accessibility/issue_summary"

        expect(response).to have_http_status(:ok)
        json_response = response.parsed_body

        expect(json_response["active"]).to eql(2)
        expect(json_response["resolved"]).to eql(0)
        expect(json_response["by_rule_type"]).to eql({
                                                       Accessibility::Rules::ImgAltRule.id => 1,
                                                       Accessibility::Rules::ImgAltFilenameRule.id => 1
                                                     })
      end
    end

    context "with syllabus" do
      it "includes issues from syllabus in the summary" do
        course_with_teacher(active_all: true)
        user_session(@teacher)
        @course.root_account.enable_feature!(:a11y_checker_ga1)
        wiki_page = wiki_page_model(course: @course)
        accessibility_scan = AccessibilityResourceScan.create!(
          course_id: @course.id,
          wiki_page_id: wiki_page.id
        )
        syllabus_scan = AccessibilityResourceScan.create!(
          course_id: @course.id,
          is_syllabus: true,
          resource_name: "Course Syllabus",
          resource_workflow_state: "published",
          workflow_state: "completed",
          issue_count: 1
        )

        accessibility_issue_model(
          course: @course,
          accessibility_resource_scan: accessibility_scan,
          rule_type: Accessibility::Rules::ImgAltRule.id,
          node_path: "//img[1]",
          workflow_state: "active"
        )
        accessibility_issue_model(
          course: @course,
          accessibility_resource_scan: syllabus_scan,
          is_syllabus: true,
          rule_type: Accessibility::Rules::HeadingsSequenceRule.id,
          node_path: "//h3[1]",
          workflow_state: "active"
        )

        get "/courses/#{@course.id}/accessibility/issue_summary"

        expect(response).to have_http_status(:ok)
        json_response = response.parsed_body

        expect(json_response["active"]).to eql(2)
        expect(json_response["resolved"]).to eql(0)
        expect(json_response["by_rule_type"]).to eql({
                                                       Accessibility::Rules::ImgAltRule.id => 1,
                                                       Accessibility::Rules::HeadingsSequenceRule.id => 1
                                                     })
      end
    end
  end
end
# rubocop:enable RSpec/BeEql

# Controller spec tests for private methods
RSpec.describe Accessibility::IssueSummaryController do
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
