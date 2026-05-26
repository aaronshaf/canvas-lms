# frozen_string_literal: true

#
# Copyright (C) 2021 - present Instructure, Inc.
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

require_relative "../support/request_helper"

describe "Discussion Topics API" do
  let(:teacher_enrollment) { course_with_teacher(active_all: true) }
  let(:course) { teacher_enrollment.course }
  let(:teacher) { teacher_enrollment.user }
  let!(:discussion) { discussion_topic_model(context: course, user: teacher) }
  let!(:anon_discussion) { discussion_topic_model(context: course, user: teacher, anonymous_state: "full_anonymity") }

  describe "index" do
    before do
      user_session(teacher)
    end

    describe "anonymity" do
      context "when the discussion is not anonymous" do
        it "includes the author information" do
          get api_v1_course_discussion_topics_path(course.id), params: { format: :json }
          expect(response).to have_http_status :ok
          json = response.parsed_body.detect { |d| d["id"] == discussion.id }
          expect(json["author"]).not_to be_nil
        end
      end

      context "when the discussion is anonymous" do
        it "does not include the author information" do
          get api_v1_course_discussion_topics_path(course.id), params: { format: :json }
          expect(response).to have_http_status :ok
          json = response.parsed_body.detect { |d| d["id"] == anon_discussion.id }
          expect(json["author"]).to be_nil
        end
      end
    end
  end

  describe "DELETE /groups/:group_id/discussion_topics/:id" do
    it "allows group members to delete their own announcements" do
      # Arrange
      course_with_teacher(active_all: true)
      student_in_course(active_all: true, course: @course)
      group = @course.groups.create!(name: "Test Group")
      group.add_user(@student)
      topic = group.announcements.create!(title: "Test Ann", message: "hello", user: @student)
      user_session(@student)

      # Act
      delete "/groups/#{group.id}/discussion_topics/#{topic.id}", params: { format: :json }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["discussion_topic"]["workflow_state"]).to eq("deleted")
      expect(topic.reload.workflow_state).to eq("deleted")
    end

    it "allows teachers to delete their own group announcements" do
      # Arrange
      course_with_teacher(active_all: true)
      group = @course.groups.create!(name: "Test Group")
      group.add_user(@teacher)
      topic = group.announcements.create!(title: "Test Ann", message: "hello", user: @teacher)
      user_session(@teacher)

      # Act
      delete "/groups/#{group.id}/discussion_topics/#{topic.id}", params: { format: :json }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["discussion_topic"]["workflow_state"]).to eq("deleted")
      expect(topic.reload.workflow_state).to eq("deleted")
    end

    it "allows teachers to delete group member announcements" do
      # Arrange
      course_with_teacher(active_all: true)
      student_in_course(active_all: true, course: @course)
      group = @course.groups.create!(name: "Test Group")
      group.add_user(@student)
      group.add_user(@teacher)
      topic = group.announcements.create!(title: "Test Ann", message: "hello", user: @student)
      user_session(@teacher)

      # Act
      delete "/groups/#{group.id}/discussion_topics/#{topic.id}", params: { format: :json }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["discussion_topic"]["workflow_state"]).to eq("deleted")
      expect(topic.reload.workflow_state).to eq("deleted")
    end
  end
end
