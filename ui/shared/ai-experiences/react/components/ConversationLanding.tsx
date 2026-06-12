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

import React from 'react'
import {InstUISettingsProvider} from '@instructure/emotion'
import {useScope as createI18nScope} from '@canvas/i18n'
import {Heading} from '@instructure/ui-heading'
import {View} from '@instructure/ui-view'
import {Text} from '@instructure/ui-text'
import {Button} from '@instructure/ui-buttons'
import {IconAiSolid} from '@instructure/ui-icons'
import ConversationHeader from './ConversationHeader'
import GradientBorder from './GradientBorder'
import {BRAND_GRADIENT, RADIUS_SM, roundedTheme} from '../brand'

const I18n = createI18nScope('ai_experiences')

const gradientTextStyle = {
  background: BRAND_GRADIENT,
  WebkitBackgroundClip: 'text' as const,
  WebkitTextFillColor: 'transparent' as const,
  backgroundClip: 'text' as const,
}

const gradientButtonWrapperStyle = {
  display: 'inline-block',
  background: BRAND_GRADIENT,
  borderRadius: RADIUS_SM,
}

export interface ConversationLandingProps {
  onStart: () => void
  isTeacherPreview?: boolean
  returnFocusRef?: React.MutableRefObject<HTMLElement | null>
}

const ConversationLanding: React.FC<ConversationLandingProps> = ({
  onStart,
  isTeacherPreview = false,
  returnFocusRef,
}) => (
  <InstUISettingsProvider theme={roundedTheme}>
    <div
      ref={(el: HTMLDivElement | null) => {
        if (el && returnFocusRef) returnFocusRef.current = el
      }}
    >
      <GradientBorder>
        <ConversationHeader />
        <View as="div" padding="x-large" background="primary" textAlign="center">
          <View as="div" margin="0 0 small 0">
            <Heading level="h3">
              <span style={gradientTextStyle}>{I18n.t('Ready to chat?')}</span>
            </Heading>
          </View>
          <View as="div" margin="0 0 medium 0">
            <Text>
              {isTeacherPreview
                ? I18n.t('Preview the student experience.')
                : I18n.t('Hit required talking points that check your understanding.')}
            </Text>
          </View>
          <div style={gradientButtonWrapperStyle}>
            <Button
              data-testid="llm-conversation-start-button"
              onClick={onStart}
              color="primary-inverse"
              withBackground={false}
              themeOverride={{borderRadius: '0.5rem'}}
            >
              <span style={{display: 'flex', alignItems: 'center', gap: '0.375rem'}}>
                <IconAiSolid />
                {isTeacherPreview ? I18n.t('Try it out') : I18n.t('Get started')}
              </span>
            </Button>
          </div>
        </View>
      </GradientBorder>
    </div>
  </InstUISettingsProvider>
)

export default ConversationLanding
