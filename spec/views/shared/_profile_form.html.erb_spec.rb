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

describe "shared/_profile_form" do
  let_once(:user) { user_model(short_name: "Bio User") }

  let(:user_data) do
    {
      short_name: "Bio User",
      pronouns: nil,
      can_edit_name: false,
      title: "",
      can_edit_title: false,
      user_services: [],
      pronunciation: nil,
      bio: nil,
      can_edit_bio: false,
      common_contexts: nil,
      links: [],
      can_edit_profile_links: false,
      can_edit: false,
      known_user: true
    }
  end

  let(:html) { Nokogiri::HTML5.fragment(response.body) }

  before do
    assign(:user, user)
    assign(:current_user, user)
    assign(:domain_root_account, Account.default)
    assign(:user_data, user_data)
  end

  def render_form
    render partial: "shared/profile_form"
  end

  describe "bio rendering (defense-in-depth)" do
    it "strips <script> tags injected via bio" do
      user_data[:bio] = "<script>alert('xss')</script>safe text"
      render_form
      expect(html.css("#biography script")).to be_empty
      expect(html.css("#biography").text).to include("safe text")
    end

    it "strips event-handler attributes" do
      user_data[:bio] = '<img src="x" onerror="alert(1)">'
      render_form
      attrs = html.css("#biography *").flat_map { |n| n.attributes.keys }
      expect(attrs.select { |k| k.start_with?("on") }).to be_empty
    end

    it "strips javascript: hrefs" do
      user_data[:bio] = '<a href="javascript:alert(1)">click</a>'
      render_form
      hrefs = html.css("#biography a").pluck("href").compact
      expect(hrefs.any? { |h| h.match?(/\Ajavascript:/i) }).to be(false)
    end

    it "strips <script> wrapped in SVG" do
      user_data[:bio] = "<svg><script>alert(1)</script></svg>"
      render_form
      expect(html.css("#biography script")).to be_empty
    end

    it "strips DOM-clobbering form/input pairs targeting attributes" do
      user_data[:bio] = '<form><input name="attributes"></form>'
      render_form
      expect(html.css("#biography form, #biography input")).to be_empty
    end

    it "strips javascript: srcset values from surviving img tags" do
      user_data[:bio] = '<img srcset="javascript:alert(1)">'
      render_form
      srcsets = html.css("#biography img").pluck("srcset").compact
      expect(srcsets.any? { |s| s.match?(/\Ajavascript:/i) }).to be(false)
    end

    it "renders the empty placeholder when bio is blank string" do
      user_data[:bio] = ""
      render_form
      expect(html.css("#biography_empty_message")).not_to be_empty
    end

    it "renders the empty placeholder when bio is nil" do
      user_data[:bio] = nil
      render_form
      expect(html.css("#biography_empty_message")).not_to be_empty
      expect(html.css("#biography")).to be_empty
    end
  end

  describe "bio rendering (real format_message, no-op guarantee)" do
    it "preserves linkified URLs produced by format_message" do
      user_data[:bio] = "see https://example.com for details"
      render_form
      link = html.css("#biography a").first
      expect(link).not_to be_nil
      expect(link["href"]).to eq("https://example.com")
      expect(html.css("#biography").text).to include("for details")
    end
  end
end
