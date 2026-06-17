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

import {useState, useEffect} from 'react'
import doFetchApi, {type DoFetchApiResults} from '@canvas/do-fetch-api-effect'
import {useScope as createI18nScope} from '@canvas/i18n'
import {
  StudentConversation,
  ConversationDetail,
  Snapshot,
  ConversationEvaluation,
  LlmaError,
} from '../../types'
import {parseLlmaError} from '../parseLlmaError'

const I18n = createI18nScope('ai_experiences_ai_conversations')

interface ConversationsPage {
  conversations?: StudentConversation[]
  snapshot?: Snapshot
}

// Caps background depagination (~2000 students at 50/page); beyond it `hasMore`
// is true and the teacher narrows the roster with server-side search.
const MAX_AUTO_PAGES = 40

/**
 * Loads the student roster, depaginating in the background (following Link:next)
 * so the picker gets the whole roster. The first unfiltered page carries the
 * whole-roster `snapshot`, which is cached. `searchTerm` (debounced by the caller)
 * filters by name server-side.
 */
export const useStudentConversations = (
  courseId: string | number,
  aiExperienceId: string | number,
  searchTerm = '',
) => {
  const [conversations, setConversations] = useState<StudentConversation[]>([])
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<LlmaError | null>(null)

  const basePath = `/api/v1/courses/${courseId}/ai_experiences/${aiExperienceId}/ai_conversations`

  useEffect(() => {
    let cancelled = false

    const loadRoster = async () => {
      setIsLoading(true)
      setIsLoadingMore(false)
      setHasMore(false)
      setError(null)

      const query = searchTerm ? `?search_term=${encodeURIComponent(searchTerm)}` : ''
      let nextUrl: string | null = `${basePath}${query}`
      let accumulated: StudentConversation[] = []
      let pages = 0

      try {
        while (nextUrl && pages < MAX_AUTO_PAGES) {
          const result: DoFetchApiResults<ConversationsPage> = await doFetchApi<ConversationsPage>({
            path: nextUrl,
          })
          if (cancelled) return

          const page = (result.json ?? {}) as ConversationsPage
          accumulated = accumulated.concat(page.conversations || [])
          // Only the first unfiltered page returns a snapshot; cache it (never clear).
          if (page.snapshot) setSnapshot(page.snapshot)
          setConversations(accumulated)

          nextUrl = result.link?.next?.url ?? null
          pages += 1

          if (pages === 1) setIsLoading(false)
          setIsLoadingMore(Boolean(nextUrl) && pages < MAX_AUTO_PAGES)
        }
        if (!cancelled) setHasMore(Boolean(nextUrl))
      } catch (err) {
        if (!cancelled) {
          setError(
            await parseLlmaError(err, I18n.t('Could not load conversations. Please try again.')),
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
          setIsLoadingMore(false)
        }
      }
    }

    loadRoster()
    return () => {
      cancelled = true
    }
  }, [courseId, aiExperienceId, searchTerm, basePath])

  return {
    conversations,
    snapshot,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
  }
}

export const useConversationDetail = (
  courseId: string | number,
  aiExperienceId: string | number,
  conversationId?: string,
) => {
  const [conversation, setConversation] = useState<ConversationDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<LlmaError | null>(null)

  useEffect(() => {
    if (!conversationId) {
      setConversation(null)
      return
    }

    const fetchConversation = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const {json} = await doFetchApi({
          path: `/api/v1/courses/${courseId}/ai_experiences/${aiExperienceId}/ai_conversations/${conversationId}`,
        })
        setConversation(json as ConversationDetail)
      } catch (err) {
        setError(
          await parseLlmaError(err, I18n.t('Could not load this conversation. Please try again.')),
        )
      } finally {
        setIsLoading(false)
      }
    }

    fetchConversation()
  }, [courseId, aiExperienceId, conversationId])

  return {conversation, isLoading, error}
}

export const useConversationEvaluation = (
  courseId: string | number,
  aiExperienceId: string | number,
  conversationId?: string,
  // Gates the fetch so it runs after the conversation, not concurrently —
  // concurrent llma calls can collide on the single-use token refresh.
  enabled = true,
) => {
  const [evaluation, setEvaluation] = useState<ConversationEvaluation | null>(null)
  const [stale, setStale] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [error, setError] = useState<LlmaError | null>(null)

  const evaluationPath = `/api/v1/courses/${courseId}/ai_experiences/${aiExperienceId}/conversations/${conversationId}/evaluation`

  useEffect(() => {
    if (!conversationId || !enabled) {
      setEvaluation(null)
      setStale(false)
      return
    }

    // Guards against a fast student switch or React strict-mode double-mount
    // double-POSTing or setting state for a conversation we've already left.
    let cancelled = false

    const loadEvaluation = async () => {
      try {
        setIsLoading(true)
        setError(null)
        setEvaluation(null)
        setStale(false)

        // Read the stored evaluation first (cheap, not rate-limited).
        const {json: getJson} = await doFetchApi({path: evaluationPath})
        const stored = getJson as {
          id: string
          evaluation: ConversationEvaluation | null
          stale: boolean
        }

        if (cancelled) return

        if (stored.evaluation) {
          setEvaluation(stored.evaluation)
          setStale(Boolean(stored.stale))
          return
        }

        // None stored yet — generate one (rate-limited POST).
        const {json: postJson} = await doFetchApi({path: evaluationPath, method: 'POST'})
        if (cancelled) return
        const generated = postJson as {id: string; evaluation: ConversationEvaluation}
        setEvaluation(generated.evaluation)
        setStale(false)
      } catch (err) {
        if (cancelled) return
        setError(
          await parseLlmaError(err, I18n.t('Could not load the evaluation. Please try again.')),
        )
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadEvaluation()

    return () => {
      cancelled = true
    }
  }, [courseId, aiExperienceId, conversationId, evaluationPath, enabled])

  const regenerate = async () => {
    if (!conversationId) return
    try {
      setIsRegenerating(true)
      setError(null)
      const {json} = await doFetchApi({path: evaluationPath, method: 'POST'})
      const generated = json as {id: string; evaluation: ConversationEvaluation}
      setEvaluation(generated.evaluation)
      setStale(false)
    } catch (err) {
      setError(
        await parseLlmaError(err, I18n.t('Could not regenerate the evaluation. Please try again.')),
      )
    } finally {
      setIsRegenerating(false)
    }
  }

  return {evaluation, stale, isLoading, isRegenerating, regenerate, error}
}
