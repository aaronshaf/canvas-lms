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

describe "GroupMembershipsController" do
  describe "DELETE /api/v1/groups/:group_id/memberships/:membership_id" do
    it "reduces the group's active member count to zero after removing the only member" do
      # Arrange
      course_with_teacher(active_all: true)
      student = create_users_in_course(@course, 1, return_type: :record).first
      group_category = @course.group_categories.create!(name: "Count Category")
      group = @course.groups.create!(name: "Count Group", group_category:)
      membership = group.add_user(student)
      user_session(@teacher)

      # Act
      delete "/api/v1/groups/#{group.id}/memberships/#{membership.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq({ "ok" => true })
      expect(membership.reload.workflow_state).to eq("deleted")
      expect(group.group_memberships.active.count).to eq(0)
    end

    it "reduces the group's active member count after deleting one of two members" do
      # Arrange
      course_with_teacher(active_all: true)
      s1, s2 = create_users_in_course(@course, 2, return_type: :record)
      group_category = @course.group_categories.create!(name: "Max Category")
      group = @course.groups.create!(name: "Max Group", group_category:, max_membership: 2)
      m1 = group.add_user(s1)
      group.add_user(s2)
      user_session(@teacher)

      # Act
      delete "/api/v1/groups/#{group.id}/memberships/#{m1.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq({ "ok" => true })
      expect(m1.reload.workflow_state).to eq("deleted")
      expect(group.group_memberships.active.count).to eq(1)
    end

    it "deletes a moderator membership and marks it as deleted" do
      # Arrange
      course_with_teacher(active_all: true)
      student = create_users_in_course(@course, 1, return_type: :record).first
      group_category = @course.group_categories.create!(name: "Leader Category")
      group = @course.groups.create!(name: "Leader Group", group_category:)
      membership = group.add_user(student)
      membership.update!(moderator: true)
      user_session(@teacher)

      # Act
      delete "/api/v1/groups/#{group.id}/memberships/#{membership.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq({ "ok" => true })
      expect(membership.reload.workflow_state).to eq("deleted")
      expect(group.group_memberships.active.where(moderator: true).count).to eq(0)
    end

    it "removes a moderator from a group so they can be added to another" do
      # Arrange
      course_with_teacher(active_all: true)
      student = create_users_in_course(@course, 1, return_type: :record).first
      group_category = @course.group_categories.create!(name: "Move Category")
      grp1 = @course.groups.create!(name: "Group One", group_category:)
      @course.groups.create!(name: "Group Two", group_category:)
      membership = grp1.add_user(student)
      membership.update!(moderator: true)
      user_session(@teacher)

      # Act
      delete "/api/v1/groups/#{grp1.id}/memberships/#{membership.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq({ "ok" => true })
      expect(membership.reload.workflow_state).to eq("deleted")
    end
  end

  describe "POST /api/v1/groups/:group_id/memberships" do
    it "creates an accepted membership for the student" do
      # Arrange
      course_with_teacher(active_all: true)
      student = create_users_in_course(@course, 1, return_type: :record).first
      group_category = @course.group_categories.create!(name: "Create Category")
      group = @course.groups.create!(name: "Create Group", group_category:)
      user_session(@teacher)

      # Act
      post "/api/v1/groups/#{group.id}/memberships", params: { user_id: student.id }

      # Assert
      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body["workflow_state"]).to eq("accepted")
      expect(body["user_id"]).to eql(student.id)
      membership = group.group_memberships.find_by(user_id: student.id)
      expect(membership).not_to be_nil
      expect(membership.workflow_state).to eq("accepted")
    end
  end

  describe "PUT /api/v1/groups/:group_id/memberships/:membership_id" do
    it "sets the membership moderator flag to true" do
      # Arrange
      course_with_teacher(active_all: true)
      student = create_users_in_course(@course, 1, return_type: :record).first
      group_category = @course.group_categories.create!(name: "Moderator Category")
      group = @course.groups.create!(name: "Moderator Group", group_category:)
      membership = group.add_user(student)
      user_session(@teacher)

      # Act
      put "/api/v1/groups/#{group.id}/memberships/#{membership.id}",
          params: { moderator: true }

      # Assert
      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body["moderator"]).to be true
      expect(membership.reload.moderator).to be true
    end
  end
end
