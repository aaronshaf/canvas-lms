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
import {View} from '@instructure/ui-view'
import {Flex} from '@instructure/ui-flex'
import {Text} from '@instructure/ui-text'
import {Heading} from '@instructure/ui-heading'
import {Pill} from '@instructure/ui-pill'
import {Spinner} from '@instructure/ui-spinner'
import {Alert} from '@instructure/ui-alerts'
import {Button} from '@instructure/ui-buttons'
import {IconCompleteLine, IconAiColoredSolid, IconRefreshLine} from '@instructure/ui-icons'
import {useScope as createI18nScope} from '@canvas/i18n'
import {EvaluationMetric, ConversationEvaluation, LlmaError} from '../../types'
import {RADIUS_MD, navButtonTheme} from '../brand'
import AIExperienceError from './AIExperienceError'

const I18n = createI18nScope('ai_experiences_ai_conversations')

interface EvaluationInsightsProps {
  metrics: EvaluationMetric[]
  evaluation?: ConversationEvaluation | null
  isLoading: boolean
  error?: LlmaError | null
  stale?: boolean
  isRegenerating?: boolean
  onRegenerate?: () => void
}

// Match both the current GA metric names ("Objectives", "Opportunities") and the
// pre-GA names, so the built-in evaluation sections render for experiences
// created under either naming.
const SUMMARY_NAMES = ['summary']
const LEARNING_TARGETS_NAMES = ['objectives', 'learning targets met', 'learning targets']
const AREAS_NAMES = ['opportunities', 'areas for improvement', 'areas for improvements']

function renderMetricContent(
  metric: EvaluationMetric,
  evaluation: ConversationEvaluation | null,
): React.ReactNode {
  if (!evaluation) {
    return (
      <Text color="secondary" size="small">
        {I18n.t('Evaluation not yet available')}
      </Text>
    )
  }

  const nameLower = metric.name.toLowerCase()

  if (SUMMARY_NAMES.includes(nameLower)) {
    return <Text size="small">{evaluation.summary}</Text>
  }

  if (LEARNING_TARGETS_NAMES.includes(nameLower)) {
    const items = evaluation.learning_objectives_evaluation
    if (!items?.length)
      return (
        <Text color="secondary" size="small">
          {I18n.t('No talking points data')}
        </Text>
      )
    return (
      <View as="div">
        {items.map((item, i) => (
          <Flex key={i} gap="small" alignItems="start" margin={i > 0 ? 'small 0 0 0' : '0'}>
            <Flex.Item>
              {item.met ? (
                <IconCompleteLine color="success" />
              ) : (
                <View
                  as="div"
                  width="1.125rem"
                  height="1.125rem"
                  borderWidth="small"
                  borderRadius="circle"
                  display="inline-block"
                />
              )}
            </Flex.Item>
            <Flex.Item shouldGrow shouldShrink>
              <Text size="small">{item.objective}</Text>
              {item.met && item.met_at_turn != null && (
                <View as="div" margin="xxx-small 0 0 0">
                  <Text size="x-small">
                    {I18n.t('Met at turn %{turn}', {turn: item.met_at_turn})}
                  </Text>
                </View>
              )}
            </Flex.Item>
          </Flex>
        ))}
      </View>
    )
  }

  if (AREAS_NAMES.includes(nameLower)) {
    const items = evaluation.areas_for_improvement
    if (!items?.length)
      return (
        <Text color="secondary" size="small">
          {I18n.t('No areas identified')}
        </Text>
      )
    return (
      <View as="div">
        {items.map((area, i) => (
          <View key={i} as="div" margin="0 0 xx-small 0">
            <Text size="small">• {area}</Text>
          </View>
        ))}
      </View>
    )
  }

  const custom = evaluation.custom_metrics?.find(c => c.metric.toLowerCase() === nameLower)
  if (custom) return <Text size="small">{custom.response}</Text>

  return (
    <Text color="secondary" size="small">
      {I18n.t('Evaluation not yet available')}
    </Text>
  )
}

const EvaluationInsights: React.FC<EvaluationInsightsProps> = ({
  metrics,
  evaluation,
  isLoading,
  error,
  stale = false,
  isRegenerating = false,
  onRegenerate,
}) => {
  const enabledMetrics = metrics.filter(m => m.enabled)

  if (!isLoading && !error && enabledMetrics.length === 0) return null

  // Reset is available whenever an evaluation exists (not only when stale).
  const showReset = Boolean(evaluation) && Boolean(onRegenerate) && !isLoading && !error

  return (
    <View
      as="div"
      background="primary"
      borderWidth="small"
      borderRadius="medium"
      padding="medium"
      height="100%"
      maxHeight="calc(100vh - 455px)"
      overflowY="auto"
      themeOverride={{borderRadiusMedium: RADIUS_MD}}
      data-testid="evaluation-insights"
      tabIndex={0}
      aria-label={I18n.t('Evaluation insights')}
    >
      <Flex
        justifyItems="space-between"
        alignItems="center"
        gap="small"
        wrap="wrap"
        margin="0 0 medium 0"
      >
        <Flex.Item>
          <Heading level="h3">{I18n.t('Evaluation insights')}</Heading>
        </Flex.Item>
        {showReset && (
          <Flex.Item shouldShrink={false}>
            <Button
              data-testid="evaluation-regenerate-button"
              renderIcon={<IconRefreshLine size="x-small" />}
              interaction={isRegenerating ? 'disabled' : 'enabled'}
              onClick={onRegenerate}
              themeOverride={navButtonTheme}
            >
              {isRegenerating ? I18n.t('Resetting…') : I18n.t('Reset evaluation')}
            </Button>
          </Flex.Item>
        )}
      </Flex>

      {stale && !isLoading && !error && (
        <Alert variant="info" margin="0 0 medium 0" data-testid="evaluation-stale-alert">
          {I18n.t(
            'This Knowledge check was edited after this evaluation was generated. Reset to get an updated evaluation.',
          )}
        </Alert>
      )}

      {error ? (
        <AIExperienceError error={error} />
      ) : isLoading ? (
        <View as="div" textAlign="center" data-testid="evaluation-insights-loading">
          <Spinner renderTitle={I18n.t('Loading insights')} size="small" />
        </View>
      ) : (
        <View as="div">
          {enabledMetrics.map((metric, idx) => (
            <View
              key={idx}
              as="div"
              margin={idx < enabledMetrics.length - 1 ? '0 0 medium 0' : '0'}
              data-testid={`evaluation-metric-section-${idx}`}
            >
              <Flex justifyItems="space-between" alignItems="center" margin="0 0 xx-small 0">
                <Flex.Item>
                  <Text weight="bold" size="medium">
                    {metric.name}
                  </Text>
                </Flex.Item>
                <Flex.Item>
                  <Flex gap="x-small">
                    {/* Visible to learners badge — hidden until designed for release */}
                    <Flex.Item>
                      <Pill
                        data-testid={`evaluation-metric-ai-badge-${idx}`}
                        renderIcon={<IconAiColoredSolid />}
                        themeOverride={{background: 'transparent'}}
                      >
                        <span style={{fontWeight: 'bold', color: '#000000'}}>
                          {I18n.t('AI Generated')}
                        </span>
                      </Pill>
                    </Flex.Item>
                  </Flex>
                </Flex.Item>
              </Flex>
              <View as="div">{renderMetricContent(metric, evaluation ?? null)}</View>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

export default EvaluationInsights
