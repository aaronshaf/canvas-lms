# frozen_string_literal: true

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

require_relative "../api_spec_helper"

describe DiscussionTopicUsersController, type: :request do
  describe "search for users," do
    before :once do
      course_with_student active_all: true
      @topic = @course.discussion_topics.create!(title: "discussion")
    end

    it "all messageble users" do
      response = api_call(
        :get,
        "/api/v1/courses/#{@course.id}/discussion_topics/#{@topic.id}/messageable_users",
        {
          format: "json",
          controller: "discussion_topic_users",
          action: "search",
          course_id: @course.id,
          topic_id: @topic.id,
          search: ""
        }
      )
      expect(response.first["name"]).to eq "User"
      expect(response.length).to be > 1
    end

    it "limit one per page" do
      response = api_call(
        :get,
        "/api/v1/courses/#{@course.id}/discussion_topics/#{@topic.id}/messageable_users",
        {
          format: "json",
          controller: "discussion_topic_users",
          action: "search",
          course_id: @course.id,
          topic_id: @topic.id,
          search: "",
          per_page: 1
        }
      )
      expect(response.first["name"]).to eq "User"
      expect(response.length).to eq 1
    end

    it "with search string john" do
      user = User.last
      user.name = "John"
      user.save

      response = api_call(
        :get,
        "/api/v1/courses/#{@course.id}/discussion_topics/#{@topic.id}/messageable_users",
        {
          format: "json",
          controller: "discussion_topic_users",
          action: "search",
          course_id: @course.id,
          topic_id: @topic.id,
          search: "john"
        }
      )
      expect(response.first["name"]).to eq "John"
      expect(response.length).to eq 1
    end

    it "with search string donald" do
      user = User.last
      user.name = "John"
      user.save

      response = api_call(
        :get,
        "/api/v1/courses/#{@course.id}/discussion_topics/#{@topic.id}/messageable_users",
        {
          format: "json",
          controller: "discussion_topic_users",
          action: "search",
          course_id: @course.id,
          topic_id: @topic.id,
          search: "donald"
        }
      )
      expect(response.length).to eq 0
    end
  end

  describe "anonymous discussion topics," do
    before :once do
      course_with_teacher(active_all: true)
      ta_in_course(course: @course, active_all: true)
      designer_in_course(course: @course, active_all: true)
      @other_student = student_in_course(course: @course, active_all: true).user
      student_in_course(course: @course, active_all: true)
    end

    def search_path(topic)
      "/api/v1/courses/#{@course.id}/discussion_topics/#{topic.id}/messageable_users"
    end

    def search_params(topic)
      {
        format: "json",
        controller: "discussion_topic_users",
        action: "search",
        course_id: @course.id.to_s,
        topic_id: topic.id.to_s,
        search: ""
      }
    end

    def search_as(user, topic)
      api_call_as_user(user, :get, search_path(topic), search_params(topic))
    end

    def raw_search(topic)
      raw_api_call(:get, search_path(topic), search_params(topic))
    end

    it "prevents non-instructors from searching users on full_anonymity topics" do
      topic = @course.discussion_topics.create!(title: "anon", anonymous_state: "full_anonymity")
      raw_search(topic)
      expect(response).to have_http_status :forbidden
      expect(response.body).not_to include @other_student.name
    end

    it "prevents non-instructors from searching users on partial_anonymity topics" do
      topic = @course.discussion_topics.create!(title: "partial anon", anonymous_state: "partial_anonymity")
      raw_search(topic)
      expect(response).to have_http_status :forbidden
    end

    it "allows teachers to search users on full_anonymity topics" do
      topic = @course.discussion_topics.create!(title: "anon", anonymous_state: "full_anonymity")
      json = search_as(@teacher, topic)
      expect(response).to have_http_status :ok
      expect(json.pluck("id")).to include(@other_student.id)
    end

    it "allows teachers to search users on partial_anonymity topics" do
      topic = @course.discussion_topics.create!(title: "partial anon", anonymous_state: "partial_anonymity")
      json = search_as(@teacher, topic)
      expect(response).to have_http_status :ok
      expect(json.pluck("id")).to include(@other_student.id)
    end

    it "allows TAs to search users on full_anonymity topics" do
      topic = @course.discussion_topics.create!(title: "anon", anonymous_state: "full_anonymity")
      json = search_as(@ta, topic)
      expect(response).to have_http_status :ok
      expect(json.pluck("id")).to include(@other_student.id)
    end

    it "allows TAs to search users on partial_anonymity topics" do
      topic = @course.discussion_topics.create!(title: "partial anon", anonymous_state: "partial_anonymity")
      json = search_as(@ta, topic)
      expect(response).to have_http_status :ok
      expect(json.pluck("id")).to include(@other_student.id)
    end

    it "allows designers to search users on full_anonymity topics" do
      topic = @course.discussion_topics.create!(title: "anon", anonymous_state: "full_anonymity")
      json = search_as(@designer, topic)
      expect(response).to have_http_status :ok
      expect(json.pluck("id")).to include(@other_student.id)
    end

    it "allows designers to search users on partial_anonymity topics" do
      topic = @course.discussion_topics.create!(title: "partial anon", anonymous_state: "partial_anonymity")
      json = search_as(@designer, topic)
      expect(response).to have_http_status :ok
      expect(json.pluck("id")).to include(@other_student.id)
    end

    it "allows account admins to search users on full_anonymity topics" do
      admin = account_admin_user(account: @course.root_account)
      topic = @course.discussion_topics.create!(title: "anon", anonymous_state: "full_anonymity")
      search_as(admin, topic)
      expect(response).to have_http_status :ok
    end

    it "allows account admins to search users on partial_anonymity topics" do
      admin = account_admin_user(account: @course.root_account)
      topic = @course.discussion_topics.create!(title: "partial anon", anonymous_state: "partial_anonymity")
      search_as(admin, topic)
      expect(response).to have_http_status :ok
    end

    it "allows site admins to search users on full_anonymity topics" do
      admin = site_admin_user
      topic = @course.discussion_topics.create!(title: "anon", anonymous_state: "full_anonymity")
      search_as(admin, topic)
      expect(response).to have_http_status :ok
    end

    it "allows site admins to search users on partial_anonymity topics" do
      admin = site_admin_user
      topic = @course.discussion_topics.create!(title: "partial anon", anonymous_state: "partial_anonymity")
      search_as(admin, topic)
      expect(response).to have_http_status :ok
    end

    it "allows students to search users on non-anonymous topics" do
      topic = @course.discussion_topics.create!(title: "open")
      json = search_as(@student, topic)
      expect(response).to have_http_status :ok
      expect(json.pluck("id")).to include(@other_student.id)
    end
  end
end
