# frozen_string_literal: true

#
# Copyright (C) 2026 - present Instructure, Inc.
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

require_relative "../views_helper"

describe "assignments/_group_submission_reminder" do
  let_once(:course)  { Course.create! }
  let_once(:teacher) { course.enroll_teacher(User.create!).user }
  let(:category) { GroupCategory.create!(name: category_name, context: course) }
  let(:assignment) do
    course.assignments.create!(
      group_category: category,
      grade_group_students_individually: false
    )
  end

  before do
    view_context(course, teacher)
    assign(:assignment, assignment)
  end

  def parsed_response
    Nokogiri::HTML.fragment(response.body)
  end

  describe "group_category.name interpolated into data-group-type" do
    context "with a legitimate group category name" do
      let(:category_name) { "Project Teams" }

      it "renders the name as the attribute value" do
        render

        alert_div = parsed_response.at_css("div.group_submission_alert")
        expect(alert_div).not_to be_nil
        expect(alert_div["data-group-type"]).to eq("Project Teams")
      end
    end

    context "with tag-injection payloads (attempt to break out of the div)" do
      {
        "script tag" => %{evil"><script>alert(1)</script>},
        "iframe tag" => %{evil"><iframe src="javascript:alert(1)"></iframe>},
        "embed tag" => %(evil"><embed src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">),
        "object tag" => %(evil"><object data="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="></object>),
        "img onerror" => %{evil"><img src="x" onerror="alert(1)">},
        "form tag" => %(evil"><form><input name="x"></form>),
        "a javascript: href" => %{evil"><a href="javascript:alert(1)">click</a>},
        "svg onload" => %{evil"><svg/onload=alert(1)>},
      }.each do |label, payload|
        context "with a #{label} payload" do
          let(:category_name) { payload }

          it "escapes the payload so #{label} cannot become a sibling DOM element" do
            render

            alert_div = parsed_response.at_css("div.group_submission_alert")
            expect(alert_div).not_to be_nil

            expect(parsed_response.css("script, iframe, embed, object, form, img, svg, a")).to be_empty

            # Nokogiri decodes &quot;/&lt;/&gt; on attribute read, so equality
            # against the raw payload proves it round-tripped intact.
            expect(alert_div["data-group-type"]).to eq(payload)

            # Entity escapes present in the body — confirms encoding (not
            # stripping) is the mechanism that produced the result.
            expect(response.body).to include("&quot;").and include("&lt;")
          end
        end
      end
    end

    context "with an event-handler attribute-injection payload" do
      let(:category_name) { %{evil"onmouseover="alert('<XSS>')} }

      it "html-escapes quotes so onmouseover does not become a DOM attribute on the alert div" do
        render

        alert_div = parsed_response.at_css("div.group_submission_alert")
        expect(alert_div).not_to be_nil

        # Round-trip equality proves the " was escaped in-place rather than
        # terminating data-group-type early.
        expect(alert_div["data-group-type"]).to eq(category_name)

        expect(alert_div.attribute_nodes.map(&:name)).to match_array(%w[class data-group-type])

        expect(response.body).to include("&quot;").and include("&lt;")
      end
    end
  end
end
