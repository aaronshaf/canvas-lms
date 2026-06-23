/*
 * Copyright (C) 2024 - present Instructure, Inc.
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

import React, {useCallback} from 'react'
import {useTranslation} from '@canvas/i18next'
import {IconButton} from '@instructure/ui-buttons'
import {
  IconWarningLine,
  IconFilesCopyrightLine,
  IconFilesPublicDomainLine,
  IconFilesObtainedPermissionLine,
  IconFilesFairUseLine,
  IconFilesCreativeCommonsLine,
} from '@instructure/ui-icons'
import {Tooltip} from '@instructure/ui-tooltip'
import {type UsageRights} from '../../../interfaces/File'

interface RightsIconButtonProps {
  userCanEditFilesForContext: boolean
  usageRights: UsageRights | null
  onClick: () => void
}

type RightsTooltipButtonProps = {
  icon: React.JSX.Element
  title: string
  screenReaderLabel?: string
  userCanEditFilesForContext: boolean
  onClick: () => void
}

const getIconData = (use_justification: string, t: (key: string) => string) => {
  switch (use_justification) {
    case 'own_copyright':
      return {icon: <IconFilesCopyrightLine />, text: t('Own Copyright')}
    case 'public_domain':
      return {icon: <IconFilesPublicDomainLine />, text: t('Public Domain')}
    case 'used_by_permission':
      return {icon: <IconFilesObtainedPermissionLine />, text: t('Used by Permission')}
    case 'fair_use':
      return {icon: <IconFilesFairUseLine />, text: t('Fair Use')}
    case 'creative_commons':
      return {icon: <IconFilesCreativeCommonsLine />, text: t('Creative Commons')}
  }
}

const RightsTooltipButton = ({
  icon,
  title,
  screenReaderLabel,
  userCanEditFilesForContext,
  onClick,
}: RightsTooltipButtonProps) => {
  const {t} = useTranslation('files_v2')
  return (
    <Tooltip
      renderTip={title}
      on={['hover', 'focus']}
      themeOverride={{
        fontSize: '0.75rem',
      }}
    >
      <IconButton
        withBackground={false}
        withBorder={false}
        size="small"
        shape="circle"
        screenReaderLabel={screenReaderLabel || title}
        aria-label={userCanEditFilesForContext ? t('Set usage rights') : t('Usage rights')}
        disabled={!userCanEditFilesForContext}
        onClick={onClick}
      >
        {icon}
      </IconButton>
    </Tooltip>
  )
}

const RightsIconButton = ({
  userCanEditFilesForContext,
  usageRights,
  onClick,
}: RightsIconButtonProps) => {
  const {t} = useTranslation('files_v2')
  const handleOnClick = useCallback(() => onClick?.(), [onClick])

  if (!usageRights) {
    if (!userCanEditFilesForContext) return null // not allow to edit

    return (
      <RightsTooltipButton
        icon={<IconWarningLine color="warning" />}
        title={t('Before publishing this file, you must specify usage rights')}
        userCanEditFilesForContext={userCanEditFilesForContext}
        onClick={handleOnClick}
      />
    )
  }

  const iconData = getIconData(usageRights.use_justification, t)
  if (!iconData) return null // error

  return (
    <RightsTooltipButton
      icon={iconData.icon}
      title={usageRights.license_name}
      screenReaderLabel={iconData.text}
      userCanEditFilesForContext={userCanEditFilesForContext}
      onClick={handleOnClick}
    />
  )
}

export default RightsIconButton
