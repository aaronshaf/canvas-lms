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

describe "shared/_current_enrollment" do
  subject(:doc) { Nokogiri::HTML5(rendered) }

  let(:star_span) { doc.at_css("span.course-list-favorite-course, span.course-list-favoritable, span.course-list-not-favoritable") }

  def render_enrollment(enrollment, past_enrollments: [], favorite_course_ids: [])
    view_context(@course, @user)
    assign(:show_star_column, true)
    assign(:favorite_course_ids, favorite_course_ids)
    assign(:past_enrollments, past_enrollments)

    allow(view).to receive(:enrollments_for_index).with(:past).and_return(past_enrollments)
    allow(view).to receive(:api_v1_add_favorite_course_url).with(enrollment.course_id)
                                                           .and_return("/api/v1/users/self/favorites/courses/#{enrollment.course_id}")

    render partial: "shared/current_enrollment",
           object: enrollment,
           locals: { dashboard: false, is_current_term: true }
  end

  before do
    course_with_student(active_all: true)
    @show_star_column = true
    allow_any_instance_of(Enrollment).to receive(:allows_favoriting?).and_return(true)
    allow_any_instance_of(Enrollment).to receive(:state_based_on_date).and_return(:active)
  end

  describe "past enrollment that is favorited" do
    before { render_enrollment(@enrollment, past_enrollments: [@enrollment], favorite_course_ids: [@course.id]) }

    it "shows the 'Click to remove' tooltip" do
      expect(star_span["title"]).to include("Click to remove")
    end

    it "includes data-favorite-url so the course can be unfavorited" do
      expect(star_span["data-favorite-url"]).to be_present
    end

    it "has course-list-not-favoritable class" do
      expect(star_span["class"]).to include("course-list-not-favoritable")
    end

    it "has course-list-favorite-course class" do
      expect(star_span["class"]).to include("course-list-favorite-course")
    end

    it "does not have course-list-favoritable class" do
      expect(star_span["class"]).not_to include("course-list-favoritable")
    end
  end

  describe "past enrollment that is not favorited" do
    before { render_enrollment(@enrollment, past_enrollments: [@enrollment], favorite_course_ids: []) }

    it "does not render a star span" do
      expect(star_span).to be_nil
    end
  end

  describe "active (non-past) enrollment that is favorited" do
    before { render_enrollment(@enrollment, past_enrollments: [], favorite_course_ids: [@course.id]) }

    it "shows the 'Click to remove' tooltip" do
      expect(star_span["title"]).to include("Click to remove")
    end

    it "includes data-favorite-url" do
      expect(star_span["data-favorite-url"]).to be_present
    end

    it "has course-list-favoritable class" do
      expect(star_span["class"]).to include("course-list-favoritable")
    end
  end

  describe "active enrollment that is not favorited" do
    before { render_enrollment(@enrollment, past_enrollments: [], favorite_course_ids: []) }

    it "shows the 'Click to add' tooltip" do
      expect(star_span["title"]).to include("Click to add")
    end

    it "includes data-favorite-url" do
      expect(star_span["data-favorite-url"]).to be_present
    end

    it "does not have course-list-favorite-course class" do
      expect(star_span["class"]).not_to include("course-list-favorite-course")
    end
  end

  describe "enrollment where show_link is false (course not active/accessible)" do
    before do
      allow_any_instance_of(Enrollment).to receive(:state_based_on_date).and_return(:inactive)
      render_enrollment(@enrollment, past_enrollments: [], favorite_course_ids: [])
    end

    it "shows the 'cannot be added' tooltip" do
      expect(star_span["title"]).to include("cannot be added")
    end

    it "has the disabled class" do
      expect(star_span["class"]).to include("disabled")
    end

    it "has course-list-not-favoritable class" do
      expect(star_span["class"]).to include("course-list-not-favoritable")
    end

    it "does not include data-favorite-url" do
      expect(star_span["data-favorite-url"]).to be_nil
    end
  end

  describe "when @show_star_column is false" do
    before do
      view_context(@course, @user)
      assign(:show_star_column, false)
      assign(:favorite_course_ids, [@course.id])
      assign(:past_enrollments, [])
      allow(view).to receive(:enrollments_for_index).with(:past).and_return([])
      render partial: "shared/current_enrollment",
             object: @enrollment,
             locals: { dashboard: false, is_current_term: true }
    end

    it "does not render the star span" do
      expect(star_span).to be_nil
    end
  end
end
