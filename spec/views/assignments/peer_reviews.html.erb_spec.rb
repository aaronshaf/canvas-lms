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

# Regression coverage for EGG-2678 (XSS audit finding H3).
# `<%= student.pronouns %>` at line 80 is rendered inside <i>(...)</i> as
# element text content. ERB's default `<%= %>` invokes html_escape, so the
# audit's "ERB doesn't escape" claim is false. This spec pins that property
# so a future change can't taint pronouns with html_safe and re-introduce a
# real XSS surface here.
require_relative "../views_helper"

describe "assignments/peer_reviews" do
  let_once(:course)  { Course.create! }
  let_once(:teacher) { course.enroll_teacher(User.create!).user }
  let(:student) { course.enroll_student(User.create!(name: "Stu Dent")).user }
  let(:assignment) do
    course.assignments.create!(peer_reviews: true, submission_types: "online_text_entry")
  end

  before do
    # User#pronouns returns nil unless the domain root account opts in,
    # and the predicate consults Account.current_domain_root_account first.
    Account.default.tap { |a| a.settings[:can_add_pronouns] = true }.save!
    Account.current_domain_root_account = Account.default
    view_context(course, teacher)
    assign(:assignment, assignment)
    assign(:context, course)
  end

  after do
    Account.current_domain_root_account = nil
  end

  # Mirrors assignments_controller#peer_reviews: @students is a paginated
  # collection, @students_dropdown_list is the AR scope, @submissions is the
  # submissions for the listed students. We rebuild after mutating pronouns
  # so the freshly-loaded User instances reflect the test's payload.
  def assign_view_collections!
    students_scope = User.where(id: student.id).order_by_sortable_name
    assign(:students, students_scope.paginate(page: 1, per_page: 10))
    assign(:students_dropdown_list, students_scope)
    assign(:submissions, assignment.submissions.where(user: student))
  end

  def parsed_response
    Nokogiri::HTML.fragment(response.body)
  end

  describe "H3 — student.pronouns rendered as text content" do
    it "html-escapes <script> payloads in pronouns so they render as inert text" do
      student.update!(pronouns: %{<script>alert('XSS-H3')</script>})
      assignment.submit_homework(student, body: "x")
      assign_view_collections!
      render

      # No real <script> element exists in the rendered DOM.
      expect(parsed_response.css("span.assessor_name script")).to be_empty
      # The payload survives only as escaped, inert text.
      expect(response.body).not_to include("<script>alert('XSS-H3')</script>")
      expect(response.body).to include("&lt;script&gt;")
    end

    it "renders legitimate pronouns inside the (parenthesised) wrapper" do
      student.update!(pronouns: "she/her")
      assignment.submit_homework(student, body: "x")
      assign_view_collections!
      render

      assessor_name = parsed_response.at_css("span.assessor_name")
      expect(assessor_name).not_to be_nil
      expect(assessor_name.text).to include("(she/her)")
    end
  end
end
