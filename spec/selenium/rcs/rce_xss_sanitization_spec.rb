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

require_relative "../helpers/wiki_and_tiny_common"
require_relative "pages/rce_next_page"

describe "RCE XSS sanitization regression", :ignore_js_errors do
  include_context "in-process server selenium tests"
  include WikiAndTinyCommon
  include RCENextPage

  before do
    course_with_teacher_logged_in
    stub_rcs_config
  end

  def xss_payloads
    <<~HTML
      <script>alert("xss_script")</script>
      <img src="x" id="xss-img" onerror="alert('xss_img')" />
      <a id="xss-link" href="javascript:void(0)">click me</a>
      <div id="xss-div" style="position:fixed;top:0;left:0;width:100%;height:100%">overlay</div>
    HTML
  end

  def inject_via_raw_html_editor(payload)
    switch_to_html_view
    switch_to_raw_html_editor
    replace_content(wiki_page_body, payload)
    switch_to_editor_view
    wait_for_ajaximations
  end

  def assert_no_xss_in_rce_editor
    in_frame rce_page_body_ifr_id do
      body_html = wiki_body.attribute("innerHTML")
      aggregate_failures "no XSS in editor content" do
        expect(body_html).not_to include("<script")
        expect(body_html).not_to match(/onerror/i)
        expect(body_html).not_to match(/javascript:/i)
      end
    end
  end

  def assert_no_xss_in_stored_body(stored_html)
    aggregate_failures "no XSS in stored HTML" do
      expect(stored_html).not_to include("<script")
      expect(stored_html).not_to match(/onerror/i)
      expect(stored_html).not_to match(/javascript:/i)
      expect(stored_html).not_to match(/position\s*:\s*fixed/i)
    end
  end

  context "TinyMCE sanitizes XSS entered via the raw HTML editor" do
    it "strips and does not execute XSS payloads when switching from raw HTML editor to WYSIWYG view" do
      visit_front_page_edit(@course)
      expect_no_dialog_fired { inject_via_raw_html_editor(xss_payloads) }
      assert_no_xss_in_rce_editor
    end
  end

  context "TinyMCE sanitizes XSS independently of backend sanitize_field" do
    it "strips XSS from content that bypassed backend sanitization" do
      assignment = @course.assignments.create!(title: "XSS Test")
      assignment.update_column(:description, xss_payloads)

      get "/courses/#{@course.id}/assignments/#{assignment.id}/edit"
      wait_for_rce

      assert_no_xss_in_rce_editor
    end
  end

  context "Full save / navigate-away / reload pipeline" do
    it "sanitizes payloads at every stage: stored value and editor re-open" do
      visit_front_page_edit(@course)
      expect_no_dialog_fired { inject_via_raw_html_editor(xss_payloads) }
      assert_no_xss_in_rce_editor
      expect_new_page_load { submit_button.click }

      stored_body = @course.wiki_pages.find_by!(url: "front-page").body
      assert_no_xss_in_stored_body(stored_body)

      get "/courses/#{@course.id}/pages"
      visit_front_page_edit(@course)

      assert_no_xss_in_rce_editor
    end
  end
end
