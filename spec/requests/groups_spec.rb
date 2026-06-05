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

describe "GroupsController" do
  describe "DELETE /courses/:course_id/groups/:id" do
    it "deletes a student-organized group when teacher requests it" do
      # Arrange
      course_with_teacher(active_all: true)
      student_in_course(active_all: true, course: @course)
      student_category = GroupCategory.student_organized_for(@course)
      group = student_category.groups.create!(name: "Windfury", context: @course)
      group.add_user(@student, "accepted")
      user_session(@teacher)

      # Act
      delete "/courses/#{@course.id}/groups/#{group.id}"

      # Assert
      expect(response).to have_http_status(:found)
      expect(group.reload.workflow_state).to eq("deleted")
    end
  end

  describe "POST /courses/:course_id/groups" do
    it "creates a named group when student submits the form" do
      # Arrange
      course_with_teacher(active_all: true)
      student_in_course(active_all: true, course: @course)
      user_session(@student)

      # Act
      post "/courses/#{@course.id}/groups", params: { group: { name: "Windfury" } }

      # Assert
      expect(response).to have_http_status(:found)
      group = Group.find_by(name: "Windfury", context: @course)
      expect(group).not_to be_nil
      expect(group.name).to eq("Windfury")
    end

    it "allows teachers to create groups within group sets" do
      # Arrange
      course_with_teacher(active_all: true)
      group_category = @course.group_categories.create!(name: "Project Teams")
      user_session(@teacher)

      # Act
      post "/courses/#{@course.id}/groups",
           params: { group: { name: "Test Group", group_category_id: group_category.id } }

      # Assert
      expect(response).to have_http_status(:found)
      group = Group.find_by(name: "Test Group", context: @course)
      expect(group).not_to be_nil
      expect(group.group_category).to eq(group_category)
    end

    it "sets max_membership when teacher provides it" do
      # Arrange
      course_with_teacher(active_all: true)
      group_category = @course.group_categories.create!(name: "Limited Teams")
      user_session(@teacher)

      # Act
      post "/courses/#{@course.id}/groups",
           params: { group: { name: "Limited Group", group_category_id: group_category.id, max_membership: 2 } }

      # Assert
      expect(response).to have_http_status(:found)
      group = Group.find_by(name: "Limited Group", context: @course)
      expect(group).not_to be_nil
      expect(group.max_membership).to eql(2)
    end
  end

  describe "GET /api/v1/courses/:course_id/groups" do
    it "returns only active groups and excludes deleted ones" do
      # Arrange
      course_with_teacher(active_all: true)
      group_category = @course.group_categories.create!(name: "Nav Test Category")
      @course.groups.create!(name: "group 1", group_category:)
      @course.groups.create!(name: "group 10", group_category:)
      @course.groups.create!(name: "group 2", group_category:)
      zed_group = @course.groups.create!(name: "group zed", group_category:)
      zed_group.destroy
      user_session(@teacher)

      # Act
      get "/api/v1/courses/#{@course.id}/groups"

      # Assert
      expect(response).to have_http_status(:ok)
      names = response.parsed_body.pluck("name")
      expect(names).to include("group 1", "group 10", "group 2")
      expect(names).not_to include("group zed")
    end
  end

  # ---------------------------------------------------------------------------
  # Groups index renders for teacher navigating to manage groups
  # Covers: spec/selenium/k5_course_dashboard_teacher_spec.rb:284
  # ---------------------------------------------------------------------------
  describe "GET /courses/:course_id/groups" do
    it "renders the groups page for a teacher" do
      # Arrange
      course_with_teacher(active_all: true)
      @course.group_categories.create!(name: "Project Groups")
      user_session(@teacher)

      # Act
      get "/courses/#{@course.id}/groups"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("Project Groups")
    end
  end
end
