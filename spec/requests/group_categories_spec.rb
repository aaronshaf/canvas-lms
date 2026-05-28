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

require_relative "../support/request_helper"

describe "GroupCategoriesController" do
  describe "POST /api/v1/courses/:course_id/group_categories" do
    it "allows teachers to add a group set with only a name" do
      # Arrange
      course_with_teacher(active_all: true)
      user_session(@teacher)

      # Act
      post "/api/v1/courses/#{@course.id}/group_categories",
           params: { name: "Test Group Set" }

      # Assert
      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body["name"]).to eq("Test Group Set")
      group_category = GroupCategory.find_by(name: "Test Group Set", context: @course)
      expect(group_category).not_to be_nil
    end

    it "allows a teacher to set up a group set with member limits" do
      # Arrange
      course_with_teacher(active_all: true)
      user_session(@teacher)

      # Act
      post "/api/v1/courses/#{@course.id}/group_categories",
           params: { name: "Limited Groups", enable_self_signup: "1", group_limit: 2 }

      # Assert
      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body["name"]).to eq("Limited Groups")
      group_category = GroupCategory.find_by(name: "Limited Groups", context: @course)
      expect(group_category).not_to be_nil
      expect(group_category.group_limit).to be(2)
    end
  end
end
