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

module AiExperiences
  class ConversationContextStatsService
    def initialize(account:)
      @client = LlmConversation::HttpClient.new(account:)
    end

    def total_objectives(context_id:)
      raise LlmConversation::Errors::ConversationError, "Context ID not set" unless context_id

      response = @client.get("/conversation-context/#{context_id}")
      response.dig("data", "objectives")&.length || 0
    end
  end
end
