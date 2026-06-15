# frozen_string_literal: true

#
# Copyright (C) 2025 - present Instructure, Inc.
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

module LlmConversation
  module Errors
    # ConversationError carries two layers of information:
    #   - #message — internal detail (full llma body, validation reason, etc.) — safe to log,
    #     never safe to render to API clients (may contain stack traces, uuids, internal paths).
    #   - #user_message — generic, client-safe string. Controllers MUST render this, never #message.
    #   - #reference_id — non-sensitive request id (set by HttpClient from the current
    #     RequestContext). Safe to render so support can join a client failure to the
    #     llma log line for the same request.
    class ConversationError < StandardError
      DEFAULT_USER_MESSAGE = "AI service is temporarily unavailable. Please try again."

      # Whitelisted llma error codes whose friendly variant we surface to the client.
      # Any code not in this map falls back to DEFAULT_USER_MESSAGE.
      SAFE_USER_MESSAGES = {
        "rate_limited" => "You're sending messages too quickly. Please wait a moment and try again.",
        "content_filtered" => "Your message could not be processed by the AI service.",
        "conversation_completed" => "This conversation has already been completed."
      }.freeze

      attr_reader :user_message, :reference_id

      def initialize(message = nil, user_message: nil, reference_id: nil)
        super(message)
        @user_message = user_message || DEFAULT_USER_MESSAGE
        @reference_id = reference_id
      end
    end

    # Raised on HTTP 409 Conflict. Retrying a conflict
    # (e.g. account already provisioned) would not resolve it.
    class ConflictError < StandardError; end
  end
end
