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

import React from 'react'
import {Alert} from '@instructure/ui-alerts'
import {View} from '@instructure/ui-view'
import {Flex} from '@instructure/ui-flex'
import {Text} from '@instructure/ui-text'
import {Button} from '@instructure/ui-buttons'
import {useScope as createI18nScope} from '@canvas/i18n'
import {LlmaError} from '../../types'

const I18n = createI18nScope('ai_experiences_ai_conversations')

interface AIExperienceErrorProps {
  error: LlmaError
  onDismiss?: () => void
  // When provided AND the error is retryable, a "Try again" button is shown. We
  // never offer retry for deterministic failures (bad config/input, not-found, …)
  // where another attempt is guaranteed to fail.
  onRetry?: () => void
  margin?: string
  // Override the root alert's test id (defaults to 'ai-experience-error') so a
  // host surface can keep its own established test hook.
  dataTestId?: string
}

/**
 * Consistent error presentation for AI-Experiences (Knowledge check) surfaces.
 * Shows the friendly message, plus a muted, selectable reference id (and code tag)
 * so a teacher can screenshot it and a masquerading support engineer can lift it
 * straight from the rendered page. Never renders internal llma detail — only the
 * server-provided friendly message and the safe code/reference id.
 */
const AIExperienceError: React.FC<AIExperienceErrorProps> = ({
  error,
  onDismiss,
  onRetry,
  margin = '0 0 small 0',
  dataTestId = 'ai-experience-error',
}) => {
  const hasMeta = Boolean(error.referenceId || error.code)
  const showRetry = Boolean(onRetry && error.retryable)

  return (
    <Alert
      variant="error"
      margin={margin}
      renderCloseButtonLabel={onDismiss ? I18n.t('Close') : undefined}
      onDismiss={onDismiss}
      transition="none"
      data-testid={dataTestId}
    >
      <Text>{error.message}</Text>
      {showRetry && (
        <View as="div" margin="x-small 0 0 0">
          <Button size="small" onClick={onRetry} data-testid="ai-experience-error-retry">
            {I18n.t('Try again')}
          </Button>
        </View>
      )}
      {hasMeta && (
        <Flex gap="small" margin="x-small 0 0 0" wrap="wrap">
          {error.referenceId && (
            <Flex.Item>
              <Text size="x-small" color="secondary">
                {I18n.t('Reference:')}{' '}
                <Text size="x-small" color="secondary" data-testid="ai-experience-error-reference">
                  {error.referenceId}
                </Text>
              </Text>
            </Flex.Item>
          )}
          {error.code && (
            <Flex.Item>
              <Text size="x-small" color="secondary" data-testid="ai-experience-error-code">
                {error.code}
              </Text>
            </Flex.Item>
          )}
        </Flex>
      )}
    </Alert>
  )
}

export default AIExperienceError
