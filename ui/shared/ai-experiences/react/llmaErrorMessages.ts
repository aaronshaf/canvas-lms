/*
 * Copyright (C) 2026 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import {useScope as createI18nScope} from '@canvas/i18n'

const I18n = createI18nScope('ai_experiences_ai_conversations')

/**
 * Friendly, localized user-facing copy for llma's stable error `code`s. This is the
 * frontend home for AI-Experiences error wording: the backend sends only the stable
 * `code` (+ retryable + reference id) and a generic fallback, and each client maps
 * the code to whatever wording it wants — here, localized via @canvas/i18n.
 *
 * Returns undefined for codes we don't surface specifics for (auth_*, tenant_*,
 * prompt_not_found, llm_upstream_error, internal_error, …) — callers fall back to
 * the server's generic message or a per-surface default. Messages must stay
 * generic and non-sensitive (no internal detail). Wording must NOT say "try again"
 * — the retry affordance is a button shown only when the error is retryable.
 */
export function messageForCode(code?: string | null): string | undefined {
  if (!code) return undefined

  const messages: Record<string, string> = {
    // Throttling / safety
    rate_limited: I18n.t(
      "You're sending messages too quickly. Please wait a moment and try again.",
    ),
    content_filtered: I18n.t('Your message could not be processed by the AI service.'),
    conversation_completed: I18n.t('This conversation has already been completed.'),

    // Conversation
    conversation_not_found: I18n.t('This conversation could not be found.'),
    conversation_invalid: I18n.t(
      'This conversation can no longer continue. Please start a new one.',
    ),
    message_not_found: I18n.t('That message could not be found.'),

    // Knowledge check setup / context
    context_not_found: I18n.t('This Knowledge check could not be found.'),
    context_invalid: I18n.t("This Knowledge check isn't configured correctly."),

    // Evaluation
    evaluation_context_incomplete: I18n.t(
      'This Knowledge check is missing information needed to evaluate the conversation.',
    ),
    evaluation_no_messages: I18n.t("There isn't a conversation to evaluate yet."),
    evaluation_parse_failed: I18n.t("The evaluation couldn't be completed."),
    evaluation_failed: I18n.t("The evaluation couldn't be completed."),

    // Source materials (RAG)
    rag_context_not_found: I18n.t(
      'The source materials for this Knowledge check could not be found.',
    ),
    rag_context_invalid: I18n.t(
      "There was a problem with this Knowledge check's source materials.",
    ),
    rag_document_not_found: I18n.t('A source file for this Knowledge check could not be found.'),
    rag_upstream_error: I18n.t('There was a problem accessing the source materials.'),

    // Feedback
    feedback_duplicate: I18n.t("You've already submitted feedback for this message."),
    feedback_not_found: I18n.t('That feedback could not be found.'),

    // Input
    validation_failed: I18n.t("Some of the information provided isn't valid."),
    payload_too_large: I18n.t('Your message is too long. Please shorten it.'),

    // Provisioning
    tenant_not_provisioned: I18n.t(
      'Knowledge checks are still being set up for your institution. Please check back shortly.',
    ),

    // AI service fully unavailable (llma unreachable)
    service_unavailable: I18n.t('The AI service is currently unavailable. Please check back soon.'),
  }

  return messages[code]
}
