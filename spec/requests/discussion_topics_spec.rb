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
          get "/api/v1/courses/#{course.id}/discussion_topics", params: { format: :json }
          expect(response).to have_http_status :ok
          json = response.parsed_body.detect { |d| d["id"] == discussion.id }
          expect(json["author"]["display_name"]).to eq(teacher.name)
        end
      end

      context "when the discussion is anonymous" do
        it "does not include the author information" do
          get "/api/v1/courses/#{course.id}/discussion_topics", params: { format: :json }
          expect(response).to have_http_status :ok
          json = response.parsed_body.detect { |d| d["id"] == anon_discussion.id }
          expect(json["author"]).to be_nil
        end
      end
    end
  end

  describe "DELETE /groups/:group_id/discussion_topics/:id" do
    before do
      course_with_teacher(active_all: true)
      @group = @course.groups.create!(name: "Test Group")
    end

    it "allows group members to delete their own announcements" do
      # Arrange
      student_in_course(active_all: true, course: @course)
      @group.add_user(@student)
      topic = @group.announcements.create!(title: "Test Ann", message: "hello", user: @student)
      user_session(@student)

      # Act
      delete "/groups/#{@group.id}/discussion_topics/#{topic.id}", params: { format: :json }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["discussion_topic"]["workflow_state"]).to eq("deleted")
      expect(topic.reload.workflow_state).to eq("deleted")
    end

    it "allows teachers to delete their own group announcements" do
      # Arrange
      @group.add_user(@teacher)
      topic = @group.announcements.create!(title: "Test Ann", message: "hello", user: @teacher)
      user_session(@teacher)

      # Act
      delete "/groups/#{@group.id}/discussion_topics/#{topic.id}", params: { format: :json }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["discussion_topic"]["workflow_state"]).to eq("deleted")
      expect(topic.reload.workflow_state).to eq("deleted")
    end

    it "allows teachers to delete group member announcements" do
      # Arrange
      student_in_course(active_all: true, course: @course)
      @group.add_user(@student)
      @group.add_user(@teacher)
      topic = @group.announcements.create!(title: "Test Ann", message: "hello", user: @student)
      user_session(@teacher)

      # Act
      delete "/groups/#{@group.id}/discussion_topics/#{topic.id}", params: { format: :json }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["discussion_topic"]["workflow_state"]).to eq("deleted")
      expect(topic.reload.workflow_state).to eq("deleted")
    end
  end

  # ---------------------------------------------------------------------------
  # Discussion topics index renders for enrolled student
  # Covers: spec/selenium/dashcards_spec.rb:90
  # ---------------------------------------------------------------------------
  describe "GET /courses/:course_id/discussion_topics" do
    it "renders the discussion topics index page for an enrolled student" do
      # Arrange
      course = course_factory(active_all: true)
      teacher = teacher_in_course(active_all: true, course:).user
      student = student_in_course(active_all: true, course:).user
      course.discussion_topics.create!(
        title: "Week 1 Discussion",
        message: "What do you think?",
        user: teacher
      )
      user_session(student)

      # Act
      get "/courses/#{course.id}/discussion_topics"

      # Assert
      expect(response).to have_http_status(:ok)
      js_env = js_env_from_response(response)
      expect(js_env["COURSE_ID"]).to eq(course.id.to_s)
      expect(js_env["totalDiscussions"]).to eq(1)
    end
  end

  # Covers selenium discussions_new_page_spec.rb:470 "does not navigate to
  # discussions create page": a Horizon course redirects the new-discussion
  # page away to context modules (the create form never renders).
  describe "GET /courses/:course_id/discussion_topics/new" do
    it "redirects a horizon course away from the new discussion page" do
      course = course_factory(active_all: true)
      teacher = teacher_in_course(active_all: true, course:).user
      course.account.enable_feature!(:horizon_course_setting)
      course.update!(horizon_course: true)
      user_session(teacher)

      get "/courses/#{course.id}/discussion_topics/new"

      expect(response).to redirect_to("/courses/#{course.id}/modules")
    end
  end

  # Covers selenium discussions_edit_page_spec.rb:445 "does not navigate to
  # existing discussion edit page": a Horizon course redirects the edit page
  # away to context modules (the save button / form never renders).
  describe "GET /courses/:course_id/discussion_topics/:id/edit" do
    it "redirects a horizon course away from the edit page" do
      course = course_factory(active_all: true)
      teacher = teacher_in_course(active_all: true, course:).user
      topic = course.discussion_topics.create!(title: "Test Discussion", user: teacher)
      course.account.enable_feature!(:horizon_course_setting)
      course.update!(horizon_course: true)
      user_session(teacher)

      get "/courses/#{course.id}/discussion_topics/#{topic.id}/edit"

      expect(response).to redirect_to("/courses/#{course.id}/modules")
    end
  end
end
