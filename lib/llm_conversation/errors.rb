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
    # ConversationError carries several layers of information:
    #   - #message — internal detail (full llma body, validation reason, etc.) — safe to log,
    #     never safe to render to API clients (may contain stack traces, uuids, internal paths).
    #   - #user_message — generic, client-safe string. Controllers MUST render this, never #message.
    #   - #reference_id — non-sensitive request id (set by HttpClient from the current
    #     RequestContext). Safe to render so support can join a client failure to the
    #     llma log line for the same request.
    #   - #code — stable, machine-readable llma error code (from llma's LlmaErrorCode
    #     enum). Safe to render (fixed vocabulary, no PII); lets the client/support
    #     categorize the failure. nil for non-llma failures (e.g. network errors).
    class ConversationError < StandardError
      # Single, generic, client-safe fallback message. Per-code user-facing wording
      # lives in the FRONTEND (ui/shared/ai-experiences/.../llmaErrorMessages), keyed
      # off `code` — that's where it gets i18n for free and stays next to the UI that
      # renders it. The stable `code` is the contract; any client maps it to whatever
      # wording (and localization) it wants. This generic is only what a client sees
      # if it doesn't map the code. NOT "try again" — retry is the button's job.
      DEFAULT_USER_MESSAGE = "The AI service is temporarily unavailable."

      # Canvas-originated catchall when llma can't be reached at all (timeout,
      # connection refused, unparseable response). Distinct from llma's own
      # `internal_error` (which means llma WAS reached but failed). Assigned in
      # HttpClient's transport rescue so `code` is never null for "AI service down".
      SERVICE_UNAVAILABLE = "service_unavailable"

      # Codes where an immediate user retry has a real chance of succeeding: the
      # model produced a bad/empty result this once (re-running RE-ROLLS it), or the
      # rate limit clears after a brief wait. Everything else is deterministic or
      # systemic — bad input/config, not-found, conflicts, an upstream service
      # (Cedar/Pine) erroring, an unexpected internal error, llma being unreachable,
      # or "still provisioning". Those won't clear on an in-the-moment retry — they
      # need a fix, engineering escalation, or just time — so the UI must NOT dangle
      # a "try again" button. A nil code is still treated as retryable (an
      # uncategorized transient blip).
      RETRYABLE_CODES = %w[
        rate_limited
        evaluation_parse_failed
        llm_no_response
        llm_invalid_response
      ].freeze

      attr_reader :user_message, :reference_id, :code

      def initialize(message = nil, user_message: nil, reference_id: nil, code: nil)
        super(message)
        @user_message = user_message || DEFAULT_USER_MESSAGE
        @reference_id = reference_id
        @code = code
      end

      # Whether retrying the same action might succeed. nil code (e.g. a network
      # failure, which never reached llma) is transient, so retryable.
      def retryable?
        code.nil? || RETRYABLE_CODES.include?(code)
      end
    end

    # Raised on HTTP 409 Conflict. Retrying a conflict
    # (e.g. account already provisioned) would not resolve it.
    class ConflictError < StandardError; end
  end
end
