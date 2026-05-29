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
#

describe AccessibilityIssuesController, type: :request do
  describe "PATCH #update" do
    context "when issue cannot be found" do
      it "returns a 404 status" do
        course = course_model
        course.account.enable_feature!(:a11y_checker_ga1)
        admin = account_admin_user(account: course.account)
        user_session(admin)
        patch "/courses/#{course.id}/accessibility_issues/1.json"
        expect(response).to have_http_status(:not_found)
      end
    end

    context "when workflow_state is invalid" do
      it "returns a 422 status" do
        course = course_model
        course.account.enable_feature!(:a11y_checker_ga1)
        admin = account_admin_user(account: course.account)
        user_session(admin)
        wiki_page = wiki_page_model(course:, title: "Wiki Page", body: "<div><h1>Document Title</h1></div>")
        scan = accessibility_resource_scan_model(course:, context: wiki_page, issue_count: 1)
        issue = accessibility_issue_model(
          course:,
          accessibility_resource_scan: scan,
          rule_type: Accessibility::Rules::HeadingsStartAtH2Rule.id,
          node_path: "./div/h1"
        )
        patch "/courses/#{course.id}/accessibility_issues/#{issue.id}.json", params: { workflow_state: "invalid_state" }
        expect(response).to have_http_status(:unprocessable_content)
      end

      it "renders an error message" do
        course = course_model
        course.account.enable_feature!(:a11y_checker_ga1)
        admin = account_admin_user(account: course.account)
        user_session(admin)
        wiki_page = wiki_page_model(course:, title: "Wiki Page", body: "<div><h1>Document Title</h1></div>")
        scan = accessibility_resource_scan_model(course:, context: wiki_page, issue_count: 1)
        issue = accessibility_issue_model(
          course:,
          accessibility_resource_scan: scan,
          rule_type: Accessibility::Rules::HeadingsStartAtH2Rule.id,
          node_path: "./div/h1"
        )
        patch "/courses/#{course.id}/accessibility_issues/#{issue.id}.json", params: { workflow_state: "invalid_state" }
        expect(response.parsed_body["error"]).to eq("Invalid workflow_state")
      end
    end

    context "when workflow_state is 'resolved'" do
      context "when value key is not provided" do
        it "returns a 422 status" do
          course = course_model
          course.account.enable_feature!(:a11y_checker_ga1)
          admin = account_admin_user(account: course.account)
          user_session(admin)
          wiki_page = wiki_page_model(course:, title: "Wiki Page", body: "<div><h1>Document Title</h1></div>")
          scan = accessibility_resource_scan_model(course:, context: wiki_page, issue_count: 1)
          issue = accessibility_issue_model(
            course:,
            accessibility_resource_scan: scan,
            rule_type: Accessibility::Rules::HeadingsStartAtH2Rule.id,
            node_path: "./div/h1"
          )
          patch "/courses/#{course.id}/accessibility_issues/#{issue.id}.json", params: { workflow_state: "resolved" }
          expect(response).to have_http_status(:unprocessable_content)
          expect(response.parsed_body["error"]).to eq("Value is required for resolved state")
        end

        it "renders an error message" do
          course = course_model
          course.account.enable_feature!(:a11y_checker_ga1)
          admin = account_admin_user(account: course.account)
          user_session(admin)
          wiki_page = wiki_page_model(course:, title: "Wiki Page", body: "<div><h1>Document Title</h1></div>")
          scan = accessibility_resource_scan_model(course:, context: wiki_page, issue_count: 1)
          issue = accessibility_issue_model(
            course:,
            accessibility_resource_scan: scan,
            rule_type: Accessibility::Rules::HeadingsStartAtH2Rule.id,
            node_path: "./div/h1"
          )
          patch "/courses/#{course.id}/accessibility_issues/#{issue.id}.json", params: { workflow_state: "resolved" }
          expect(response.parsed_body["error"]).to eq("Value is required for resolved state")
        end
      end

      context "when value is an empty string" do
        it "returns a 422 status" do
          course = course_model
          course.account.enable_feature!(:a11y_checker_ga1)
          admin = account_admin_user(account: course.account)
          user_session(admin)
          wiki_page = wiki_page_model(course:, title: "Wiki Page", body: "<div><h1>Document Title</h1></div>")
          scan = accessibility_resource_scan_model(course:, context: wiki_page, issue_count: 1)
          issue = accessibility_issue_model(
            course:,
            accessibility_resource_scan: scan,
            rule_type: Accessibility::Rules::HeadingsStartAtH2Rule.id,
            node_path: "./div/h1"
          )
          patch "/courses/#{course.id}/accessibility_issues/#{issue.id}.json", params: { workflow_state: "resolved", value: "" }
          expect(response).to have_http_status(:unprocessable_content)
          expect(response.parsed_body["error"]).to eq("Value is required for resolved state")
        end

        it "renders an error message" do
          course = course_model
          course.account.enable_feature!(:a11y_checker_ga1)
          admin = account_admin_user(account: course.account)
          user_session(admin)
          wiki_page = wiki_page_model(course:, title: "Wiki Page", body: "<div><h1>Document Title</h1></div>")
          scan = accessibility_resource_scan_model(course:, context: wiki_page, issue_count: 1)
          issue = accessibility_issue_model(
            course:,
            accessibility_resource_scan: scan,
            rule_type: Accessibility::Rules::HeadingsStartAtH2Rule.id,
            node_path: "./div/h1"
          )
          patch "/courses/#{course.id}/accessibility_issues/#{issue.id}.json", params: { workflow_state: "resolved", value: "" }
          expect(response.parsed_body["error"]).to eq("Value is required for resolved state")
        end
      end

      context "when value is whitespace only" do
        it "returns a 422 status" do
          course = course_model
          course.account.enable_feature!(:a11y_checker_ga1)
          admin = account_admin_user(account: course.account)
          user_session(admin)
          wiki_page = wiki_page_model(course:, title: "Wiki Page", body: "<div><h1>Document Title</h1></div>")
          scan = accessibility_resource_scan_model(course:, context: wiki_page, issue_count: 1)
          issue = accessibility_issue_model(
            course:,
            accessibility_resource_scan: scan,
            rule_type: Accessibility::Rules::HeadingsStartAtH2Rule.id,
            node_path: "./div/h1"
          )
          patch "/courses/#{course.id}/accessibility_issues/#{issue.id}.json", params: { workflow_state: "resolved", value: "   " }
          expect(response).to have_http_status(:unprocessable_content)
          expect(response.parsed_body["error"]).to eq("Value is required for resolved state")
        end

        it "renders an error message" do
          course = course_model
          course.account.enable_feature!(:a11y_checker_ga1)
          admin = account_admin_user(account: course.account)
          user_session(admin)
          wiki_page = wiki_page_model(course:, title: "Wiki Page", body: "<div><h1>Document Title</h1></div>")
          scan = accessibility_resource_scan_model(course:, context: wiki_page, issue_count: 1)
          issue = accessibility_issue_model(
            course:,
            accessibility_resource_scan: scan,
            rule_type: Accessibility::Rules::HeadingsStartAtH2Rule.id,
            node_path: "./div/h1"
          )
          patch "/courses/#{course.id}/accessibility_issues/#{issue.id}.json", params: { workflow_state: "resolved", value: "   " }
          expect(response.parsed_body["error"]).to eq("Value is required for resolved state")
        end
      end

      context "when value is nil for a rule that allows it" do
        it "updates the workflow_state" do
          course = course_model
          course.account.enable_feature!(:a11y_checker_ga1)
          admin = account_admin_user(account: course.account)
          user_session(admin)
          img_wiki_page = wiki_page_model(course:, title: "Image Wiki Page", body: "<div><img src='test.jpg' /></div>")
          img_scan = accessibility_resource_scan_model(course:, context: img_wiki_page, issue_count: 1)
          img_issue = accessibility_issue_model(
            course:,
            accessibility_resource_scan: img_scan,
            rule_type: Accessibility::Rules::ImgAltRule.id,
            node_path: ".//img"
          )
          patch "/courses/#{course.id}/accessibility_issues/#{img_issue.id}", params: { workflow_state: "resolved", value: nil }, as: :json
          expect(img_issue.reload.workflow_state).to eq("resolved")
        end

        it "returns a no content status" do
          course = course_model
          course.account.enable_feature!(:a11y_checker_ga1)
          admin = account_admin_user(account: course.account)
          user_session(admin)
          img_wiki_page = wiki_page_model(course:, title: "Image Wiki Page", body: "<div><img src='test.jpg' /></div>")
          img_scan = accessibility_resource_scan_model(course:, context: img_wiki_page, issue_count: 1)
          img_issue = accessibility_issue_model(
            course:,
            accessibility_resource_scan: img_scan,
            rule_type: Accessibility::Rules::ImgAltRule.id,
            node_path: ".//img"
          )
          patch "/courses/#{course.id}/accessibility_issues/#{img_issue.id}", params: { workflow_state: "resolved", value: nil }, as: :json
          expect(response).to have_http_status(:no_content)
        end
      end

      context "when value is nil for ImgAltFilenameRule" do
        it "updates the workflow_state" do
          course = course_model
          course.account.enable_feature!(:a11y_checker_ga1)
          admin = account_admin_user(account: course.account)
          user_session(admin)
          img_wiki_page = wiki_page_model(course:, title: "Image Wiki Page", body: "<div><img src='test.jpg' alt='test.jpg' /></div>")
          img_scan = accessibility_resource_scan_model(course:, context: img_wiki_page, issue_count: 1)
          img_issue = accessibility_issue_model(
            course:,
            accessibility_resource_scan: img_scan,
            rule_type: Accessibility::Rules::ImgAltFilenameRule.id,
            node_path: ".//img"
          )
          patch "/courses/#{course.id}/accessibility_issues/#{img_issue.id}", params: { workflow_state: "resolved", value: nil }, as: :json
          expect(img_issue.reload.workflow_state).to eq("resolved")
        end

        it "returns a no content status" do
          course = course_model
          course.account.enable_feature!(:a11y_checker_ga1)
          admin = account_admin_user(account: course.account)
          user_session(admin)
          img_wiki_page = wiki_page_model(course:, title: "Image Wiki Page", body: "<div><img src='test.jpg' alt='test.jpg' /></div>")
          img_scan = accessibility_resource_scan_model(course:, context: img_wiki_page, issue_count: 1)
          img_issue = accessibility_issue_model(
            course:,
            accessibility_resource_scan: img_scan,
            rule_type: Accessibility::Rules::ImgAltFilenameRule.id,
            node_path: ".//img"
          )
          patch "/courses/#{course.id}/accessibility_issues/#{img_issue.id}", params: { workflow_state: "resolved", value: nil }, as: :json
          expect(response).to have_http_status(:no_content)
        end
      end

      context "when value is provided" do
        context "when applying the fix fails" do
          it "returns a 400 status" do
            course = course_model
            course.account.enable_feature!(:a11y_checker_ga1)
            admin = account_admin_user(account: course.account)
            user_session(admin)
            wiki_page = wiki_page_model(course:, title: "Wiki Page", body: "<div><h1>Document Title</h1></div>")
            scan = accessibility_resource_scan_model(course:, context: wiki_page, issue_count: 1)
            issue = accessibility_issue_model(
              course:,
              accessibility_resource_scan: scan,
              rule_type: Accessibility::Rules::HeadingsStartAtH2Rule.id,
              node_path: "./div/h1"
            )
            patch "/courses/#{course.id}/accessibility_issues/#{issue.id}.json", params: { workflow_state: "resolved", value: "Invalid value" }
            expect(response).to have_http_status(:bad_request)
            expect(response.parsed_body["error"]).to eq("Invalid value for form: Invalid value")
          end

          it "renders an error message" do
            course = course_model
            course.account.enable_feature!(:a11y_checker_ga1)
            admin = account_admin_user(account: course.account)
            user_session(admin)
            wiki_page = wiki_page_model(course:, title: "Wiki Page", body: "<div><h1>Document Title</h1></div>")
            scan = accessibility_resource_scan_model(course:, context: wiki_page, issue_count: 1)
            issue = accessibility_issue_model(
              course:,
              accessibility_resource_scan: scan,
              rule_type: Accessibility::Rules::HeadingsStartAtH2Rule.id,
              node_path: "./div/h1"
            )
            patch "/courses/#{course.id}/accessibility_issues/#{issue.id}.json", params: { workflow_state: "resolved", value: "Invalid value" }
            expect(response.parsed_body["error"]).to eq("Invalid value for form: Invalid value")
          end
        end

        context "when applying the fix succeeds" do
          it "updates the workflow_state" do
            course = course_model
            course.account.enable_feature!(:a11y_checker_ga1)
            admin = account_admin_user(account: course.account)
            user_session(admin)
            wiki_page = wiki_page_model(course:, title: "Wiki Page", body: "<div><h1>Document Title</h1></div>")
            scan = accessibility_resource_scan_model(course:, context: wiki_page, issue_count: 1)
            issue = accessibility_issue_model(
              course:,
              accessibility_resource_scan: scan,
              rule_type: Accessibility::Rules::HeadingsStartAtH2Rule.id,
              node_path: "./div/h1"
            )
            patch "/courses/#{course.id}/accessibility_issues/#{issue.id}.json", params: { workflow_state: "resolved", value: "Change heading level to Heading 2" }
            expect(issue.reload.workflow_state).to eq("resolved")
          end

          it "returns a no content status" do
            course = course_model
            course.account.enable_feature!(:a11y_checker_ga1)
            admin = account_admin_user(account: course.account)
            user_session(admin)
            wiki_page = wiki_page_model(course:, title: "Wiki Page", body: "<div><h1>Document Title</h1></div>")
            scan = accessibility_resource_scan_model(course:, context: wiki_page, issue_count: 1)
            issue = accessibility_issue_model(
              course:,
              accessibility_resource_scan: scan,
              rule_type: Accessibility::Rules::HeadingsStartAtH2Rule.id,
              node_path: "./div/h1"
            )
            patch "/courses/#{course.id}/accessibility_issues/#{issue.id}.json", params: { workflow_state: "resolved", value: "Change heading level to Heading 2" }
            expect(response).to have_http_status(:no_content)
          end

          it "updates the issue count" do
            course = course_model
            course.account.enable_feature!(:a11y_checker_ga1)
            admin = account_admin_user(account: course.account)
            user_session(admin)
            wiki_page = wiki_page_model(course:, title: "Wiki Page", body: "<div><h1>Document Title</h1></div>")
            scan = accessibility_resource_scan_model(course:, context: wiki_page, issue_count: 1)
            issue = accessibility_issue_model(
              course:,
              accessibility_resource_scan: scan,
              rule_type: Accessibility::Rules::HeadingsStartAtH2Rule.id,
              node_path: "./div/h1"
            )
            patch "/courses/#{course.id}/accessibility_issues/#{issue.id}.json", params: { workflow_state: "resolved", value: "Change heading level to Heading 2" }
            expect(scan.reload.issue_count).to eql(0) # rubocop:disable RSpec/BeEql
          end
        end
      end

      context "with linked files, no user (happens after content migration), and no attachment associations" do
        it "successfully applies the fix" do
          course = course_model
          course.account.enable_feature!(:a11y_checker_ga1)
          admin = account_admin_user(account: course.account)
          user_session(admin)
          attachment = attachment_model(context: course, uploaded_data: fixture_file_upload("cn_image.jpg"))
          body = <<~HTML
            <div><img src='/courses/#{course.id}/files/#{attachment.id}/preview' /></div>
          HTML
          img_wiki_page = wiki_page_model(course:, title: "Image Wiki Page", body:, skip_attachment_association_update: true)
          img_scan = accessibility_resource_scan_model(course:, context: img_wiki_page, issue_count: 1)
          img_issue = accessibility_issue_model(
            course:,
            accessibility_resource_scan: img_scan,
            rule_type: Accessibility::Rules::ImgAltFilenameRule.id,
            node_path: ".//img"
          )
          patch "/courses/#{course.id}/accessibility_issues/#{img_issue.id}", params: { workflow_state: "resolved", value: nil }, as: :json
          expect(response).to have_http_status(:no_content)
        end
      end
    end

    context "when workflow_state is 'dismissed'" do
      it "updates the workflow_state" do
        course = course_model
        course.account.enable_feature!(:a11y_checker_ga1)
        admin = account_admin_user(account: course.account)
        user_session(admin)
        wiki_page = wiki_page_model(course:, title: "Wiki Page", body: "<div><h1>Document Title</h1></div>")
        scan = accessibility_resource_scan_model(course:, context: wiki_page, issue_count: 1)
        issue = accessibility_issue_model(
          course:,
          accessibility_resource_scan: scan,
          rule_type: Accessibility::Rules::HeadingsStartAtH2Rule.id,
          node_path: "./div/h1"
        )
        patch "/courses/#{course.id}/accessibility_issues/#{issue.id}.json", params: { workflow_state: "dismissed" }
        expect(issue.reload.workflow_state).to eq("dismissed")
      end

      it "returns a no content status" do
        course = course_model
        course.account.enable_feature!(:a11y_checker_ga1)
        admin = account_admin_user(account: course.account)
        user_session(admin)
        wiki_page = wiki_page_model(course:, title: "Wiki Page", body: "<div><h1>Document Title</h1></div>")
        scan = accessibility_resource_scan_model(course:, context: wiki_page, issue_count: 1)
        issue = accessibility_issue_model(
          course:,
          accessibility_resource_scan: scan,
          rule_type: Accessibility::Rules::HeadingsStartAtH2Rule.id,
          node_path: "./div/h1"
        )
        patch "/courses/#{course.id}/accessibility_issues/#{issue.id}.json", params: { workflow_state: "dismissed" }
        expect(response).to have_http_status(:no_content)
      end

      it "updates the issue count" do
        course = course_model
        course.account.enable_feature!(:a11y_checker_ga1)
        admin = account_admin_user(account: course.account)
        user_session(admin)
        wiki_page = wiki_page_model(course:, title: "Wiki Page", body: "<div><h1>Document Title</h1></div>")
        scan = accessibility_resource_scan_model(course:, context: wiki_page, issue_count: 1)
        issue = accessibility_issue_model(
          course:,
          accessibility_resource_scan: scan,
          rule_type: Accessibility::Rules::HeadingsStartAtH2Rule.id,
          node_path: "./div/h1"
        )
        patch "/courses/#{course.id}/accessibility_issues/#{issue.id}.json", params: { workflow_state: "dismissed" }
        expect(scan.reload.issue_count).to eql(0) # rubocop:disable RSpec/BeEql
      end
    end
  end
end
