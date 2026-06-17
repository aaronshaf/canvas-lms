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
import {IconCompleteLine, IconAiColoredSolid} from '@instructure/ui-icons'
import {useScope as createI18nScope} from '@canvas/i18n'
import {EvaluationMetric, ConversationEvaluation, LlmaError} from '../../types'
import {RADIUS_MD} from '../brand'
import AIExperienceError from './AIExperienceError'

const I18n = createI18nScope('ai_experiences_ai_conversations')

interface EvaluationInsightsProps {
  metrics: EvaluationMetric[]
  evaluation?: ConversationEvaluation | null
  isLoading: boolean
  error?: LlmaError | null
}

const SUMMARY_NAMES = ['summary']
const LEARNING_TARGETS_NAMES = ['learning targets met', 'learning targets']
const AREAS_NAMES = ['areas for improvement', 'areas for improvements']

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
}) => {
  const enabledMetrics = metrics.filter(m => m.enabled)

  if (!isLoading && !error && enabledMetrics.length === 0) return null

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
      <Heading level="h3" margin="0 0 medium 0">
        {I18n.t('Evaluation insights')}
      </Heading>

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
                    {AREAS_NAMES.includes(metric.name.toLowerCase())
                      ? I18n.t('Areas for improvement')
                      : metric.name}
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
