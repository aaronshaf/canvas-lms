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

import {useEffect, useState} from 'react'
import {Flex} from '@instructure/ui-flex'
import {Text} from '@instructure/ui-text'
import {IconButton, Button} from '@instructure/ui-buttons'
import {IconLikeLine, IconLikeSolid} from '@instructure/ui-icons'
import {TextInput} from '@instructure/ui-text-input'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {showFlashAlert} from '@instructure/platform-alerts'
import {useScope as createI18nScope} from '@canvas/i18n'
import {useTranslationContext} from '../../hooks/useTranslationContext'
import {postInboxTranslationFeedback} from '../../utils/inbox_translator'

declare const ENV: Global & {
  inbox_translation_feedback?: boolean
}

const I18n = createI18nScope('conversations_2')

const TranslationFeedback = () => {
  const {translationTargetLanguage, translationCompleted, translationNonce} =
    useTranslationContext()
  const [feedbackId, setFeedbackId] = useState<number | null>(null)
  const [liked, setLiked] = useState(false)
  const [disliked, setDisliked] = useState(false)
  const [notes, setNotes] = useState('')
  const [notesSubmitted, setNotesSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  // Reset the feedback whenever a new translation is produced.
  useEffect(() => {
    setFeedbackId(null)
    setLiked(false)
    setDisliked(false)
    setNotes('')
    setNotesSubmitted(false)
  }, [translationNonce])

  if (!ENV?.inbox_translation_feedback || !translationCompleted || !translationTargetLanguage) {
    return null
  }

  const postFeedback = async (
    action: 'like' | 'dislike' | 'reset_like',
    feedbackNotes?: string,
  ) => {
    setLoading(true)
    try {
      const result = await postInboxTranslationFeedback({
        action,
        targetLanguage: translationTargetLanguage,
        notes: feedbackNotes,
        id: feedbackId,
      })
      setFeedbackId(result.id)
      setLiked(result.liked)
      setDisliked(result.disliked)
      if (feedbackNotes) {
        setNotesSubmitted(true)
      }
    } catch {
      showFlashAlert({
        type: 'error',
        message: I18n.t('There was an unexpected error while submitting feedback.'),
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLike = () => {
    postFeedback(liked ? 'reset_like' : 'like')
  }

  const handleDislike = () => {
    postFeedback(disliked ? 'reset_like' : 'dislike')
  }

  const handleSendNotes = () => {
    if (!notes.trim()) return
    postFeedback('dislike', notes)
  }

  return (
    <Flex direction="column" margin="x-small 0 0 0">
      <Flex justifyItems="end" alignItems="center">
        <Flex.Item margin="0 small 0 0">
          <Text color="secondary" size="small">
            {liked || disliked
              ? I18n.t('Thank you for sharing!')
              : I18n.t('Was this translation helpful?')}
          </Text>
        </Flex.Item>
        <IconButton
          onClick={handleLike}
          size="small"
          withBackground={false}
          withBorder={false}
          color={liked ? 'primary' : 'secondary'}
          screenReaderLabel={
            liked ? I18n.t('Like translation, selected') : I18n.t('Like translation')
          }
          interaction={loading ? 'disabled' : 'enabled'}
          data-testid="inbox-translation-like-button"
        >
          {liked ? <IconLikeSolid /> : <IconLikeLine />}
        </IconButton>
        <IconButton
          onClick={handleDislike}
          size="small"
          withBackground={false}
          withBorder={false}
          color={disliked ? 'primary' : 'secondary'}
          screenReaderLabel={
            disliked ? I18n.t('Dislike translation, selected') : I18n.t('Dislike translation')
          }
          interaction={loading ? 'disabled' : 'enabled'}
          data-testid="inbox-translation-dislike-button"
        >
          {disliked ? <IconLikeSolid rotate="180" /> : <IconLikeLine rotate="180" />}
        </IconButton>
      </Flex>
      {disliked && !notesSubmitted && (
        <Flex direction="column" gap="x-small" margin="x-small 0 0 0">
          <Text size="small">{I18n.t("What didn't you like about this translation?")}</Text>
          <Flex gap="small" alignItems="end">
            <Flex.Item shouldGrow={true}>
              <TextInput
                renderLabel={
                  <ScreenReaderContent>{I18n.t('Translation feedback')}</ScreenReaderContent>
                }
                placeholder={I18n.t('Start typing...')}
                value={notes}
                onChange={(_e, value) => setNotes(value)}
                data-testid="inbox-translation-feedback-input"
              />
            </Flex.Item>
            <Flex.Item>
              <Button
                color="secondary"
                onClick={handleSendNotes}
                interaction={!loading && notes.trim() ? 'enabled' : 'disabled'}
                data-testid="inbox-translation-feedback-submit"
              >
                {I18n.t('Send Feedback')}
              </Button>
            </Flex.Item>
          </Flex>
          <Text size="small" color="secondary">
            {I18n.t('Explain what was incorrect, unclear, or missing in the translation.')}
          </Text>
        </Flex>
      )}
    </Flex>
  )
}

export default TranslationFeedback
