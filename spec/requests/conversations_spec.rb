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

describe "ConversationsController" do
  describe "POST /conversations" do
    it "sets the conversation context when teacher sends with context_code" do
      # Arrange
      course_with_teacher(active_all: true)
      student_in_course(active_all: true, course: @course)
      user_session(@teacher)

      # Act
      post "/conversations",
           params: {
             recipients: [@student.id.to_s],
             body: "message body",
             context_code: @course.asset_string
           }

      # Assert
      expect(response).to have_http_status(:created)
      body = response.parsed_body
      expect(body.length).to be(1)
      expect(body.first["context_code"]).to eq(@course.asset_string)
      expect(Conversation.last.context).to eq(@course)
    end
  end
end
