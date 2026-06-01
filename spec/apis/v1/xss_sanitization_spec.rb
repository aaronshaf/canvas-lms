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

require_relative "../api_spec_helper"

describe "XSS sanitization via API", type: :request do
  include Api
  include Api::V1::Assignment

  def xss_payloads
    <<~HTML
      <script>alert("xss_script")</script>
      <img src="x" id="xss-img" onerror="alert('xss_img')" />
      <a id="xss-link" href="javascript:void(0)">click me</a>
      <div id="xss-div" style="position:fixed;top:0;left:0;width:100%;height:100%">overlay</div>
    HTML
  end

  def xss_assignment_name = "XSS Test"
  def xss_safe_content    = "<p>Safe paragraph</p><strong>Bold text</strong>"

  def assert_no_xss_in_stored_body(stored_html)
    aggregate_failures "no XSS in stored HTML" do
      expect(stored_html).not_to include("<script")
      expect(stored_html).not_to match(/onerror/i)
      expect(stored_html).not_to match(/javascript:/i)
      expect(stored_html).not_to match(/position\s*:\s*fixed/i)
    end
  end

  context "assignment description" do
    before :once do
      course_with_teacher(active_all: true)
    end

    let(:assignments_path) { "/api/v1/courses/#{@course.id}/assignments.json" }
    let(:create_route)     { { controller: "assignments_api", action: "create", format: "json", course_id: @course.id.to_s } }

    it "strips XSS payloads from description on creation" do
      json = api_call(:post,
                      assignments_path,
                      create_route,
                      { assignment: { "name" => xss_assignment_name, "description" => xss_payloads } })
      assert_no_xss_in_stored_body(Assignment.find(json["id"]).description)
    end

    it "returns sanitized description in the GET response" do
      json = api_call(:post,
                      assignments_path,
                      create_route,
                      { assignment: { "name" => xss_assignment_name, "description" => xss_payloads } })
      assignment = Assignment.find(json["id"])
      get_json = api_call(:get,
                          "/api/v1/courses/#{@course.id}/assignments/#{assignment.id}.json",
                          { controller: "assignments_api",
                            action: "show",
                            format: "json",
                            course_id: @course.id.to_s,
                            id: assignment.id.to_s })

      assert_no_xss_in_stored_body(get_json["description"])
    end

    it "strips XSS payloads from description on update" do
      json = api_call(:post,
                      assignments_path,
                      create_route,
                      { assignment: { "name" => xss_assignment_name } })
      assignment = Assignment.find(json["id"])
      api_call(:put,
               "/api/v1/courses/#{@course.id}/assignments/#{assignment.id}.json",
               { controller: "assignments_api",
                 action: "update",
                 format: "json",
                 course_id: @course.id.to_s,
                 id: assignment.id.to_s },
               { assignment: { "description" => xss_payloads } })
      assert_no_xss_in_stored_body(assignment.reload.description)
    end

    it "preserves safe HTML in description while stripping XSS payloads" do
      json = api_call(:post,
                      assignments_path,
                      create_route,
                      { assignment: { "name" => xss_assignment_name, "description" => "#{xss_safe_content}#{xss_payloads}" } })
      assignment = Assignment.find(json["id"])

      expect(assignment.description).to include(xss_safe_content)
      assert_no_xss_in_stored_body(assignment.description)
    end
  end
end
