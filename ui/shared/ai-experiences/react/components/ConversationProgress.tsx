/*
 * Copyright (C) 2025 - present Instructure, Inc.
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

import React, {useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {Flex} from '@instructure/ui-flex'
import {View} from '@instructure/ui-view'
import {Text} from '@instructure/ui-text'
import {ProgressBar} from '@instructure/ui-progress'
import {Popover} from '@instructure/ui-popover'
import {IconMiniArrowDownLine, IconMiniArrowUpLine, IconCompleteLine} from '@instructure/ui-icons'
import {List} from '@instructure/ui-list'
import {Button, CloseButton} from '@instructure/ui-buttons'
import {navyButtonTheme, RADIUS_PILL, BLACK} from '../brand'

const I18n = createI18nScope('ai_experiences')

const progressBorderTheme = {borderColorPrimary: BLACK}
const progressBarTheme = {borderRadius: RADIUS_PILL, trackBottomBorderWidth: '0'}
const targetButtonTheme = navyButtonTheme

export interface ConversationProgressData {
  current: number
  total: number
  percentage: number
  objectives: Array<{
    objective: string
    status: '' | 'covered'
  }>
}

interface ConversationProgressProps {
  progress: ConversationProgressData | null
}

const ConversationProgress: React.FC<ConversationProgressProps> = ({progress}) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  if (!progress) {
    return null
  }

  const {current, total, percentage, objectives} = progress
  const isComplete = percentage >= 100

  return (
    <Flex gap="small" alignItems="center" justifyItems="space-between">
      <Flex.Item shouldGrow shouldShrink>
        <View
          as="div"
          borderWidth="small"
          borderRadius="pill"
          overflowX="hidden"
          overflowY="hidden"
          themeOverride={progressBorderTheme}
        >
          <ProgressBar
            screenReaderLabel={I18n.t('Talking point progress: %{percentage}%', {percentage})}
            valueNow={percentage}
            valueMax={100}
            size="small"
            meterColor={isComplete ? 'success' : 'success'}
            themeOverride={progressBarTheme}
          />
        </View>
      </Flex.Item>
      <Flex.Item>
        <Popover
          renderTrigger={
            <Button
              display="inline-block"
              color="primary"
              onClick={() => setIsPopoverOpen(!isPopoverOpen)}
              themeOverride={targetButtonTheme}
              aria-expanded={isPopoverOpen}
              aria-haspopup="true"
            >
              <Flex gap="xx-small" alignItems="center">
                <Text weight="bold" size="small">
                  {I18n.t('%{current}/%{total} Talking points', {current, total})}
                </Text>
                {isPopoverOpen ? (
                  <IconMiniArrowUpLine size="x-small" />
                ) : (
                  <IconMiniArrowDownLine size="x-small" />
                )}
              </Flex>
            </Button>
          }
          isShowingContent={isPopoverOpen}
          onShowContent={() => setIsPopoverOpen(true)}
          onHideContent={() => setIsPopoverOpen(false)}
          on="click"
          placement="bottom end"
          shouldContainFocus
          shouldReturnFocus
          screenReaderLabel={I18n.t('Talking points')}
        >
          <View as="div" padding="medium" width="400px" maxWidth="90vw">
            <Flex justifyItems="space-between" alignItems="start" margin="0 0 small 0">
              <Flex.Item shouldGrow shouldShrink>
                <Text weight="bold" size="large">
                  {I18n.t('%{current}/%{total} Talking points met', {current, total})}
                </Text>
              </Flex.Item>
              <Flex.Item>
                <CloseButton
                  size="small"
                  screenReaderLabel={I18n.t('Close talking points')}
                  onClick={() => setIsPopoverOpen(false)}
                />
              </Flex.Item>
            </Flex>
            <List isUnstyled margin="0">
              {objectives.map((objective, index) => (
                <List.Item
                  key={index}
                  spacing="small"
                  aria-label={
                    objective.status === 'covered'
                      ? I18n.t('Met: %{objective}', {objective: objective.objective})
                      : I18n.t('Not yet met: %{objective}', {objective: objective.objective})
                  }
                >
                  <Flex gap="small" alignItems="start">
                    <Flex.Item>
                      {objective.status === 'covered' ? (
                        <IconCompleteLine color="success" aria-hidden="true" />
                      ) : (
                        <View
                          as="div"
                          width="1.125rem"
                          height="1.125rem"
                          borderWidth="small"
                          borderRadius="circle"
                          display="inline-block"
                          aria-hidden="true"
                        />
                      )}
                    </Flex.Item>
                    <Flex.Item shouldGrow shouldShrink>
                      <Text aria-hidden="true">{objective.objective}</Text>
                    </Flex.Item>
                  </Flex>
                </List.Item>
              ))}
            </List>
          </View>
        </Popover>
      </Flex.Item>
    </Flex>
  )
}

export default ConversationProgress
