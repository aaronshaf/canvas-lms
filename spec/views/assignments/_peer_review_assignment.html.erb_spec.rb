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

# Regression coverage for EGG-2677 (XSS audit findings H1/H2).
# Both findings were re-analysed as false positives because Rails' default
# `<%= %>` invokes `html_escape`, preserving attribute-boundary integrity.
# This spec pins that property: an attacker-controlled User#pronouns and
# User#name (interpolated into the assessor reminder title) cannot break
# out of the rendered HTML.
require_relative "../views_helper"

describe "assignments/_peer_review_assignment" do
  let_once(:course)  { Course.create! }
  let_once(:teacher) { course.enroll_teacher(User.create!).user }
  let(:student) { course.enroll_student(User.create!(name: "Stu Dent")).user }
  let(:peer)    { course.enroll_student(User.create!(name: "Peer Reviewer")).user }
  let(:assignment) do
    course.assignments.create!(peer_reviews: true, submission_types: "online_text_entry")
  end
  let(:student_submission) { assignment.submit_homework(student, body: "stu") }
  let(:peer_submission)    { assignment.submit_homework(peer,    body: "peer") }
  let(:assessment_request) do
    AssessmentRequest.create!(
      asset: student_submission,
      user: student,
      assessor: peer,
      assessor_asset: peer_submission
    )
  end

  before do
    # User#pronouns returns nil unless the domain root account opts in.
    Account.default.tap { |a| a.settings[:can_add_pronouns] = true }.save!
    view_context(course, teacher)
    assign(:assignment, assignment)
    assign(:context, course)
  end

  def render_partial
    render partial: "assignments/peer_review_assignment",
           locals: { request: assessment_request }
  end

  def parsed_response
    Nokogiri::HTML.fragment(response.body)
  end

  describe "H1 — pronouns interpolated as text content" do
    it "html-escapes <script> payloads in pronouns so they render as inert text" do
      student.update!(pronouns: %{">'<script>alert('XSS-H1')</script>})
      render_partial

      # No real <script> element exists in the rendered DOM.
      expect(parsed_response.css("script")).to be_empty
      # The payload survives only as escaped, inert text.
      expect(response.body).not_to include("<script>alert('XSS-H1')</script>")
      expect(response.body).to include("&lt;script&gt;")
    end

    it "renders legitimate pronouns inside the (parenthesised) wrapper" do
      student.update!(pronouns: "she/her")
      render_partial

      asset_user_name = parsed_response.at_css("span.asset_user_name")
      expect(asset_user_name).not_to be_nil
      expect(asset_user_name.text).to include("(she/her)")
    end
  end

  describe "H2 — assessor name interpolated into the reminder title=" do
    it "html-escapes attribute-breakout payloads in User#name" do
      peer.update!(name: %{evil"onmouseover="alert('XSS-H2')})
      render_partial

      icon = parsed_response.at_css("i.icon-alerts")
      expect(icon).not_to be_nil

      # The entire payload remains a single attribute value — Nokogiri
      # decodes &quot; back to " when reading the parsed attribute, so
      # success means the full string round-trips intact under one key.
      expect(icon["title"]).to include(%{evil"onmouseover="alert('XSS-H2')})

      # If escaping had failed, attribute boundary would have broken and
      # onmouseover would have become a real DOM attribute on the element.
      expect(icon.attribute_nodes.map(&:name)).not_to include("onmouseover")
    end

    it "renders the legitimate reminder title with the assessor's name" do
      peer.update!(name: "Peer Reviewer")
      render_partial

      icon = parsed_response.at_css("i.icon-alerts")
      expect(icon).not_to be_nil
      expect(icon["title"]).to include("Peer Reviewer")
    end
  end
end
