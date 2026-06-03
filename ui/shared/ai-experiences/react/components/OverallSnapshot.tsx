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
import {Spinner} from '@instructure/ui-spinner'
import {useScope as createI18nScope} from '@canvas/i18n'
import {Snapshot} from '../../types'
import {BRAND_PURPLE, GREEN, RADIUS_LG} from '../brand'

const I18n = createI18nScope('ai_experiences_ai_conversations')

const BLUE = '#0770E3'
const LIGHT_GREY = '#C7CDD1'

interface StatCardProps {
  label: string
  value: number | string
  borderColor: string
  testId: string
}

const StatCard: React.FC<StatCardProps> = ({label, value, borderColor, testId}) => (
  <div
    data-testid={testId}
    style={{
      border: `2px solid ${borderColor}`,
      borderRadius: RADIUS_LG,
      padding: '0.75rem 1rem',
      backgroundColor: '#ffffff',
    }}
  >
    <Text size="xx-large" weight="bold">
      {value}
    </Text>
    <View as="div" margin="xx-small 0 0 0">
      <Text size="small" color="secondary">
        {label}
      </Text>
    </View>
  </div>
)

interface OverallSnapshotProps {
  snapshot: Snapshot | null
  isLoading: boolean
}

const OverallSnapshot: React.FC<OverallSnapshotProps> = ({snapshot, isLoading}) => {
  if (isLoading) {
    return (
      <View as="div" margin="0 0 medium 0" data-testid="overall-snapshot-loading">
        <Spinner renderTitle={I18n.t('Loading snapshot')} size="small" />
      </View>
    )
  }

  if (!snapshot) return null

  const started = snapshot.completed + snapshot.in_progress
  const avgMet = `${snapshot.completed}/${started}`

  return (
    <View as="div" margin="0 0 medium 0" data-testid="overall-snapshot">
      <Heading level="h3" margin="0 0 small 0">
        {I18n.t('Overall snapshot')}
      </Heading>
      <Flex gap="small" wrap="wrap">
        <Flex.Item shouldGrow>
          <StatCard
            label={I18n.t('Learning targets')}
            value={snapshot.total_objectives}
            borderColor={BRAND_PURPLE}
            testId="snapshot-learning-targets"
          />
        </Flex.Item>
        <Flex.Item shouldGrow>
          <StatCard
            label={I18n.t('Avg targets met')}
            value={avgMet}
            borderColor={BRAND_PURPLE}
            testId="snapshot-avg-met"
          />
        </Flex.Item>
        <Flex.Item shouldGrow>
          <StatCard
            label={I18n.t('Completed')}
            value={snapshot.completed}
            borderColor={GREEN}
            testId="snapshot-completed"
          />
        </Flex.Item>
        <Flex.Item shouldGrow>
          <StatCard
            label={I18n.t('In progress')}
            value={snapshot.in_progress}
            borderColor={BLUE}
            testId="snapshot-in-progress"
          />
        </Flex.Item>
        <Flex.Item shouldGrow>
          <StatCard
            label={I18n.t('Not started')}
            value={snapshot.not_started}
            borderColor={LIGHT_GREY}
            testId="snapshot-not-started"
          />
        </Flex.Item>
      </Flex>
    </View>
  )
}

export default OverallSnapshot
