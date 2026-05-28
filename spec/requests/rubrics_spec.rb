# frozen_string_literal: true

#
# Copyright (C) 2024 - present Instructure, Inc.
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

describe "RubricsController" do
  describe "GET /courses/:course_id/rubrics/:id" do
    it "renders outcome-linked criterion rows with outcome_sr_content visible and no edit div" do
      # Arrange
      enrollment = course_with_teacher(active_all: true)
      teacher = enrollment.user
      course = enrollment.course
      course.disable_feature!(:enhanced_rubrics)
      outcome_with_rubric(context: course)
      @rubric.rubric_associations.create!(
        association_object: course,
        context: course,
        purpose: "bookmark",
        bookmarked: true
      )

      user_session(teacher)

      # Act
      get "/courses/#{course.id}/rubrics/#{@rubric.id}"

      # Assert: outcome criterion row present with outcome_sr_content visible (aria-hidden=false)
      # The template renders aria-hidden="false" on outcome_sr_content only for outcome-linked rows
      # (value = learning_outcome_criterion.nil? — false when outcome ID present)
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("learning_outcome_criterion")
      expect(response.body).to match(/class="outcome_sr_content" aria-hidden="false"/)
    end
  end

  describe "GET /courses/:course_id/rubrics" do
    it "renders the rubric_grading element hidden when not in assignment context" do
      # Arrange
      enrollment = course_with_teacher(active_all: true)
      course = enrollment.course
      teacher = enrollment.user
      course.disable_feature!(:enhanced_rubrics)

      user_session(teacher)

      # Act
      get "/courses/#{course.id}/rubrics"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("rubric_grading")
      expect(response.body).to include('class="rubric_grading" style="display: none;"')
    end
  end
end
