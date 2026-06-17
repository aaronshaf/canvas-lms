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

# Shared rendering for llm-conversation (llma) failures across AI-Experiences
# controllers. Centralizing it keeps the client-safe error contract in ONE place:
#   - never leaks the internal #message (only the generic #user_message),
#   - always includes a reference_id support can use to find the matching llma
#     log line (the Canvas request id, also returned as the X-Request-Context-Id
#     response header and forwarded to llma as X-Request-Id).
#
# Including controllers get a rescue_from so every action that talks to llma is
# covered automatically — no per-action rescue to forget. Future fields (e.g. an
# error `code`) are added here once rather than at every render site.
module LLMConversationErrorRendering
  extend ActiveSupport::Concern

  included do
    rescue_from LlmConversation::Errors::ConversationError do |e|
      Rails.logger.warn("[#{self.class.name}] llma error: #{e.message}")
      render json: llm_error_payload(e.user_message, reference_id: e.reference_id, code: e.code, retryable: e.retryable?),
             status: :service_unavailable
    end
  end

  private

  # The single client-safe error shape. Must never include internal error detail.
  #
  # Status is intentionally always :service_unavailable. HTTP status describes the
  # browser<->Canvas relationship; llma's status describes the Canvas<->llma hop, so
  # mirroring it (e.g. llma 404 -> Canvas 404) would be a category error. Every AI
  # Experiences action is expected to yield a happy llma/cedar/pine result, so any
  # failure is an internal AI dependency being unavailable. `code` carries the
  # fine-grained category for the client/support; `error` is the friendly message;
  # `retryable` tells the UI whether offering "try again" makes sense.
  def llm_error_payload(message, reference_id: nil, code: nil, retryable: false)
    {
      error: message,
      code:,
      retryable:,
      reference_id: reference_id || RequestContext::Generator.request_id
    }
  end
end
