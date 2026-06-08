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
import {Text} from '@instructure/ui-text'
import {Flex} from '@instructure/ui-flex'
import {IconCheckLine, IconAwardLine} from '@instructure/ui-icons'
import {useScope as createI18nScope} from '@canvas/i18n'
import {BRAND_PURPLE} from '../brand'

const I18n = createI18nScope('ai_experiences')

export interface ConversationMilestoneProps {
  variant: 'single' | 'all'
  objective?: string
}

const ConversationMilestone: React.FC<ConversationMilestoneProps> = ({variant, objective}) => {
  if (variant === 'single') {
    return (
      <View
        as="div"
        margin="small 0"
        padding="small medium"
        borderWidth="small"
        borderRadius="medium"
        borderColor="success"
        data-testid="conversation-milestone-single"
        role="status"
      >
        <Flex gap="small" alignItems="center">
          <Flex.Item>
            <IconCheckLine color="success" />
          </Flex.Item>
          <Flex.Item shouldGrow shouldShrink>
            <Text weight="bold" size="small">
              {I18n.t('Objective met')}
            </Text>
            {objective && (
              <View as="div">
                <Text size="small" color="secondary">
                  {objective}
                </Text>
              </View>
            )}
          </Flex.Item>
        </Flex>
      </View>
    )
  }

  return (
    <View
      as="div"
      margin="small 0"
      padding="small medium"
      borderWidth="small"
      borderRadius="medium"
      data-testid="conversation-milestone-all"
      role="status"
    >
      <Flex gap="small" alignItems="center">
        <Flex.Item>
          <span style={{color: BRAND_PURPLE, display: 'inline-flex'}}>
            <IconAwardLine />
          </span>
        </Flex.Item>
        <Flex.Item shouldGrow shouldShrink>
          <Text weight="bold" size="small">
            {I18n.t('All objectives met')}
          </Text>
        </Flex.Item>
      </Flex>
      <View as="div" margin="xx-small 0 0 0">
        <Text size="small" color="secondary">
          {I18n.t('You can stop here — or reset the chat to go again.')}
        </Text>
      </View>
    </View>
  )
}

export default ConversationMilestone
