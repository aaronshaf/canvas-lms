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

describe "shared/_rubric_criterion" do
  let_once(:course) { course_model }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let_once(:rubric) { rubric_model(context: course) }

  let(:criterion) do
    Rubric::Criterion.new(
      "Test criterion",
      "",
      5.0,
      "crit1",
      false,
      nil,
      nil,
      false,
      [Rubric::Rating.new("Full", "", 5.0, "rat1", "crit1", nil, nil)],
      nil,
      nil,
      nil,
      nil,
      nil
    )
  end

  let(:html) { Nokogiri::HTML5.fragment(response) }

  before do
    view_context(course, student)
    allow(course).to receive(:user_is_student?).and_return(true)
  end

  def render_criterion(friendly_description: "")
    render partial: "shared/rubric_criterion",
           object: criterion,
           locals: {
             assessing: false,
             rubric:,
             friendly_description:,
             edit_view: false,
           }
  end

  describe "friendly_description sanitization" do
    it "strips script tags" do
      render_criterion(friendly_description: "<script>alert('xss')</script>safe")
      expect(html.to_s).not_to include("<script>")
      expect(html.css(".long_description").text).to include("safe")
    end

    it "strips onerror attributes" do
      render_criterion(friendly_description: '<img src="x" onerror="alert(1)">')
      expect(html.to_s).not_to include("onerror")
    end

    it "strips javascript: hrefs" do
      render_criterion(friendly_description: '<a href="javascript:alert(1)">click</a>')
      expect(html.to_s).not_to include("javascript:")
    end

    it "preserves safe HTML formatting" do
      render_criterion(friendly_description: "<p>Hello <strong>world</strong></p>")
      expect(html.css(".long_description strong").text).to eq("world")
    end

    it "renders nothing when friendly_description is blank" do
      render_criterion(friendly_description: "")
      expect(html.css(".long_description").text.strip).to be_empty
    end
  end
end
