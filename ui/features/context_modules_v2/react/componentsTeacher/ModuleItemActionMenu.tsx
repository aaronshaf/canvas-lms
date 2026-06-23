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
import {Flex} from '@instructure/ui-flex'
import {IconButton} from '@instructure/ui-buttons'
import {Menu} from '@instructure/ui-menu'
import {
  IconMoreLine,
  IconArrowEndLine,
  IconArrowStartLine,
  IconEditLine,
  IconSpeedGraderLine,
  IconPermissionsSolid,
  IconDuplicateLine,
  IconUpdownLine,
  IconUserLine,
  IconDuplicateSolid,
  IconTrashLine,
  IconMasteryPathsLine,
} from '@instructure/ui-icons'
import {useTranslation} from '@canvas/i18next'
import {useContextModule} from '../hooks/useModuleContext'
import type {ModuleItemContent} from '../utils/types'
import {usePublishing} from '@canvas/context-modules/react/publishing/publishingContext'

const basicContentTypes = ['SubHeader', 'ExternalUrl']

export interface ModuleItemActionMenuProps {
  moduleId: string
  itemType: string
  content: ModuleItemContent
  published: boolean
  canDuplicate: boolean
  isMenuOpen: boolean
  setIsMenuOpen: (isOpen: boolean) => void
  indent: number
  handleEdit: () => void
  handleSpeedGrader: () => void
  handleAssignTo: () => void
  handleDuplicate: () => void
  handleMoveTo: () => void
  handleDecreaseIndent: () => void
  handleIncreaseIndent: () => void
  handleSendTo: () => void
  handleCopyTo: () => void
  handleRemove: () => void
  masteryPathsData?: {
    isCyoeAble: boolean
    isTrigger: boolean
    isReleased: boolean
    releasedLabel: string | null
  } | null
  handleMasteryPaths?: () => void
}

const ModuleItemActionMenu: React.FC<ModuleItemActionMenuProps> = ({
  moduleId,
  itemType,
  content,
  published,
  canDuplicate,
  isMenuOpen,
  setIsMenuOpen,
  indent,
  handleEdit,
  handleSpeedGrader,
  handleAssignTo,
  handleDuplicate,
  handleMoveTo,
  handleDecreaseIndent,
  handleIncreaseIndent,
  handleSendTo,
  handleCopyTo,
  handleRemove,
  masteryPathsData,
  handleMasteryPaths = () => {},
}) => {
  const {t} = useTranslation('context_modules_v2')
  const isBasic = basicContentTypes.includes(itemType)
  const isFile = itemType === 'File'
  const isExternalTool = itemType === 'ExternalTool'
  const {permissions, menuItemLoadingState} = useContextModule()
  const isModuleLoading = !!menuItemLoadingState?.[moduleId]?.state
  const canEdit = permissions?.canEdit
  const canAdd = permissions?.canAdd
  const canDelete = permissions?.canDelete
  const canManageSpeedGrader = permissions?.canManageSpeedGrader
  const canDirectShare = permissions?.canDirectShare

  const isNotSpecialType = !isBasic && !isFile && !isExternalTool
  const showSpeedGrader =
    canManageSpeedGrader &&
    (itemType === 'Assignment' ||
      itemType === 'Quiz' ||
      (content?.assignment && itemType === 'Discussion')) &&
    published
  const showAssignTo = !!content?.canManageAssignTo
  const showDirectShare = canDirectShare && !isBasic && !isExternalTool

  const publishingContext = usePublishing()
  const publishingInProgress = !!publishingContext?.publishingInProgress

  const renderMenuItem = (condition: boolean, handler: () => void, icon: any, label: string) => {
    if (!condition) return null
    return (
      <Menu.Item onClick={isModuleLoading ? undefined : handler} disabled={isModuleLoading}>
        <Flex>
          <Flex.Item>{icon}</Flex.Item>
          <Flex.Item margin="0 0 0 x-small">{label}</Flex.Item>
        </Flex>
      </Menu.Item>
    )
  }

  return (
    <Menu
      onToggle={isOpen => setIsMenuOpen(isOpen)}
      open={isMenuOpen}
      disabled={publishingInProgress}
      trigger={
        <IconButton
          screenReaderLabel={t('Module Item Options')}
          renderIcon={IconMoreLine}
          withBackground={false}
          withBorder={false}
          size="small"
          data-testid="module-item-action-menu-button"
        />
      }
      data-testid="module-item-action-menu"
    >
      {renderMenuItem(canEdit, handleEdit, <IconEditLine />, t('Edit'))}
      {renderMenuItem(
        !!showSpeedGrader,
        handleSpeedGrader,
        <IconSpeedGraderLine />,
        t('SpeedGrader'),
      )}
      {renderMenuItem(showAssignTo, handleAssignTo, <IconPermissionsSolid />, t('Assign To...'))}
      {renderMenuItem(
        canAdd && canDuplicate && isNotSpecialType,
        handleDuplicate,
        <IconDuplicateLine />,
        t('Duplicate'),
      )}
      {renderMenuItem(canEdit, handleMoveTo, <IconUpdownLine />, t('Move to...'))}
      {renderMenuItem(
        canEdit && indent > 0,
        handleDecreaseIndent,
        <IconArrowStartLine />,
        t('Decrease indent'),
      )}
      {renderMenuItem(
        canEdit && indent < 5,
        handleIncreaseIndent,
        <IconArrowEndLine />,
        t('Increase indent'),
      )}
      {renderMenuItem(showDirectShare, handleSendTo, <IconUserLine />, t('Send To...'))}
      {renderMenuItem(showDirectShare, handleCopyTo, <IconDuplicateSolid />, t('Copy To...'))}
      {renderMenuItem(
        isNotSpecialType && !!masteryPathsData?.isCyoeAble,
        handleMasteryPaths,
        <IconMasteryPathsLine />,
        masteryPathsData?.isTrigger ? t('Edit Mastery Paths') : t('Add Mastery Paths'),
      )}
      {renderMenuItem(canDelete, handleRemove, <IconTrashLine />, t('Remove'))}
    </Menu>
  )
}

export default ModuleItemActionMenu
