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

describe "submissions/_originality_score" do
  let_once(:course)  { Course.create! }
  let_once(:student) { course.enroll_student(User.create!).user }
  let_once(:teacher) { course.enroll_teacher(User.create!).user }
  let(:assignment) { course.assignments.create!(title: "a", submission_types: "online_text_entry") }
  let(:submission) { assignment.submit_homework(student, body: "x") }

  # EGG-2682 / audit finding M5
  it "html-escapes Turnitin error_message in title and alt attributes" do
    hostile = %{Bad PDF "><script>alert('XSS-M5')</script>}
    turnitin_score = { state: "warning", similarity_score: 50, error_message: hostile }

    asset_key = OriginalityReport.submission_asset_key(submission)
    allow(submission).to receive_messages(
      has_originality_report?: true,
      originality_data: { asset_key => turnitin_score },
      grants_any_right?: true,
      can_view_plagiarism_report: false
    )
    view_context(course, teacher)
    assign(:assignment, assignment)
    assign(:submission, submission)
    render partial: "submissions/originality_score",
           locals: { attachment: nil, show_updated_icons: false }

    doc  = Nokogiri::HTML.fragment(response.body)
    link = doc.at_css("a[title]")
    img  = doc.at_css("img[alt]")
    expect(link).not_to be_nil
    expect(img).not_to be_nil
    expect(link["title"]).to eql(hostile)
    expect(img["alt"]).to eql(hostile)
    expect(link.attribute_nodes.map(&:name)).not_to include("onerror", "onclick", "onmouseover")
    expect(doc.css("script")).to be_empty
  end
end
