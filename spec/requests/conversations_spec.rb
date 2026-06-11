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

  describe "GET /conversations (with attachments)" do
    before :once do
      course_with_teacher(active_all: true)
      student_in_course(active_all: true)
    end

    it "includes location parameters in attachment URLs when file_association_access_conversation is enabled" do
      Account.default.enable_feature!(:file_association_access_conversation)
      Account.default.disable_feature!(:file_association_access)
      user_session(@teacher)

      attachment = attachment_model(context: @teacher, folder: @teacher.conversation_attachments_folder)
      conversation_participant = @teacher.initiate_conversation([@student])
      message = conversation_participant.add_message("test with attachment", attachment_ids: [attachment.id], root_account_id: Account.default.id)

      get "/conversations/#{conversation_participant.conversation_id}.json"

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      messages = body["messages"] || []

      message_with_attachments = messages.find { |m| m["attachments"]&.any? }
      expect(message_with_attachments).to be_present

      attachment_data = message_with_attachments["attachments"].first
      expect(attachment_data["url"]).to include("location=conversation_message_#{message.id}")
    end

    it "does not include location parameters when only file_association_access is enabled" do
      Account.default.enable_feature!(:file_association_access)
      Account.default.disable_feature!(:file_association_access_conversation)
      user_session(@teacher)

      attachment = attachment_model(context: @teacher, folder: @teacher.conversation_attachments_folder)
      conversation_participant = @teacher.initiate_conversation([@student])
      conversation_participant.add_message("test with attachment", attachment_ids: [attachment.id], root_account_id: Account.default.id)

      get "/conversations/#{conversation_participant.conversation_id}.json"

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      messages = body["messages"] || []

      message_with_attachments = messages.find { |m| m["attachments"]&.any? }
      expect(message_with_attachments).to be_present

      attachment_data = message_with_attachments["attachments"].first
      expect(attachment_data["url"]).not_to include("location=")
    end
  end
end
