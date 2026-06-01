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

require_relative "../../support/request_helper"

describe "Quizzes::QuizzesController#create POST /courses/:course_id/quizzes" do
  describe "ip_filter validation" do
    it "accepts a valid ipv4 address with subnet mask and persists it on the quiz" do
      # Arrange
      course_with_teacher(active_all: true)
      user_session(@teacher)
      ip_filter_value = "7.7.7.7/255.255.255.0"

      # Act
      post "/courses/#{@course.id}/quizzes",
           params: { quiz: { title: "IPv4 CIDR Quiz", ip_filter: ip_filter_value } }

      # Assert
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json["quiz"]["ip_filter"]).to eq ip_filter_value
      quiz = Quizzes::Quiz.find(json["quiz"]["id"])
      expect(quiz.title).to eq "IPv4 CIDR Quiz"
      expect(quiz.ip_filter).to eq ip_filter_value
      expect(quiz.errors[:invalid_ip_filter]).to be_empty
      expect(quiz).to be_unpublished
    end

    it "accepts a valid ipv6 address and persists it on the quiz" do
      # Arrange
      course_with_teacher(active_all: true)
      user_session(@teacher)
      ip_filter_value = "2001:0db8:85a3:0000:0000:8a2e:0370:7334"

      # Act
      post "/courses/#{@course.id}/quizzes",
           params: { quiz: { title: "IPv6 Quiz", ip_filter: ip_filter_value } }

      # Assert
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json["quiz"]["ip_filter"]).to eq ip_filter_value
      quiz = Quizzes::Quiz.find(json["quiz"]["id"])
      expect(quiz.title).to eq "IPv6 Quiz"
      expect(quiz.ip_filter).to eq ip_filter_value
      expect(quiz.errors[:invalid_ip_filter]).to be_empty
      expect(quiz).to be_unpublished
    end
  end
end
