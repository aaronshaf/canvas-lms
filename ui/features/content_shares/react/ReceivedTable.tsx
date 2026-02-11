/*
 * Copyright (C) 2019 - present Instructure, Inc.
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
import {useScope as createI18nScope} from '@canvas/i18n'
import {Table} from '@instructure/ui-table'
import {Menu} from '@instructure/ui-menu'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {IconButton} from '@instructure/ui-buttons'
import {Link} from '@instructure/ui-link'
import {IconMoreLine, IconEyeLine, IconImportLine, IconTrashLine} from '@instructure/ui-icons'
import {View} from '@instructure/ui-view'
import FriendlyDatetime from '@canvas/datetime/react/components/FriendlyDatetime'
import {Avatar} from '@instructure/ui-avatar'
import {Text} from '@instructure/ui-text'
import {Tooltip} from '@instructure/ui-tooltip'

const I18n = createI18nScope('content_share')

type ContentShareType = 'assignment' | 'attachment' | 'discussion_topic' | 'page' | 'quiz' | 'module' | 'module_item'

interface Attachment {
  id?: string
  display_name?: string
  url?: string
}

interface ContentExport {
  id: string
  progress_url?: string
  user_id?: string
  workflow_state?: 'created' | 'exporting' | 'exported' | 'failed' | 'deleted'
  attachment?: Attachment
  created_at?: string
}

interface DisplayUser {
  id?: string
  display_name?: string
  avatar_image_url?: string
}

interface ContentShare {
  id: string
  name: string
  content_type: ContentShareType
  created_at: string
  updated_at: string
  read_state: string
  sender?: DisplayUser
  content_export?: ContentExport
}

const friendlyShareNames: Record<ContentShareType, string> = {
  assignment: I18n.t('Assignment'),
  attachment: I18n.t('File'),
  discussion_topic: I18n.t('Discussion Topic'),
  module: I18n.t('Module'),
  page: I18n.t('Page'),
  quiz: I18n.t('Quiz'),
  module_item: I18n.t('Module Item'),
}

interface ReceivedTableProps {
  shares?: ContentShare[]
  onPreview?: (share: ContentShare) => void
  onImport?: (share: ContentShare) => void
  onRemove?: (share: ContentShare) => void
  onUpdate?: (share_id: string, updateParms: {read_state: string}) => void
}

export default function ReceivedTable({shares = [], onPreview, onImport, onRemove, onUpdate}: ReceivedTableProps) {
  function renderActionMenu(share: ContentShare) {
    const items: JSX.Element[] = []
    if (share.content_export?.workflow_state === 'exported') {
      items.push(
        // @ts-expect-error
        <Menu.Item key="prv" data-testid="preview-menu-action" onSelect={() => onPreview?.(share)}>
          {/* @ts-expect-error */}
          <IconEyeLine /> <View margin="0 0 0 x-small">{I18n.t('Preview')}</View>
        </Menu.Item>,
      )
      items.push(
        // @ts-expect-error
        <Menu.Item key="imp" data-testid="import-menu-action" onSelect={() => onImport?.(share)}>
          {/* @ts-expect-error */}
          <IconImportLine /> <View margin="0 0 0 x-small">{I18n.t('Import')}</View>
        </Menu.Item>,
      )
    }
    items.push(
      // @ts-expect-error
      <Menu.Item key="rmv" data-testid="remove-menu-action" onSelect={() => onRemove?.(share)}>
        {/* @ts-expect-error */}
        <IconTrashLine /> <View margin="0 0 0 x-small">{I18n.t('Remove')}</View>
      </Menu.Item>,
    )
    return (
      <Menu
        data-testid="action-menu"
        trigger={
          <IconButton
            // @ts-expect-error
            size="small"
            // @ts-expect-error
            withBackground={false}
            // @ts-expect-error
            withBorder={false}
            renderIcon={IconMoreLine}
            screenReaderLabel={I18n.t('Manage options for %{name}', {name: share.name})}
          />
        }
      >
        {items}
      </Menu>
    )
  }

  function renderUnreadBadge({id, name, read_state}: ContentShare) {
    function setReadState() {
      if (typeof onUpdate === 'function') onUpdate(id, {read_state: 'read'})
    }
    function setUnreadState() {
      if (typeof onUpdate === 'function') onUpdate(id, {read_state: 'unread'})
    }

    function srText() {
      if (read_state === 'unread') {
        return I18n.t('%{name} mark as read', {name})
      }
      return I18n.t('%{name} mark as unread', {name})
    }

    if (read_state !== 'read') {
      return (
        // @ts-expect-error
        <Tooltip renderTip={srText()}>
          {/* @ts-expect-error */}
          <Link data-testid="received-table-row-unread" onClick={setReadState} margin="0 small">
            {/* unread indicator, until we can use InstUI Badge for both unread and read indicators */}
            {/* @ts-expect-error */}
            <View
              display="block"
              // @ts-expect-error
              borderWidth="medium"
              width="1rem"
              height="1rem"
              // @ts-expect-error
              borderRadius="circle"
              // @ts-expect-error
              borderColor="info"
              // @ts-expect-error
              background="info"
            />
            <ScreenReaderContent>{srText()}</ScreenReaderContent>
          </Link>
        </Tooltip>
      )
    } else {
      return (
        // @ts-expect-error
        <Tooltip renderTip={srText()}>
          {/* @ts-expect-error */}
          <Link data-testid="received-table-row-read" onClick={setUnreadState} margin="0 small">
            {/* @ts-expect-error */}
            <View
              display="block"
              // @ts-expect-error
              borderWidth="medium"
              width="1rem"
              height="1rem"
              // @ts-expect-error
              borderRadius="circle"
              // @ts-expect-error
              borderColor="info"
            />
            <ScreenReaderContent>{srText()}</ScreenReaderContent>
          </Link>
        </Tooltip>
      )
    }
  }

  function renderReceivedColumn(content_export?: ContentExport) {
    if (content_export && content_export.workflow_state === 'exported') {
      return <FriendlyDatetime dateTime={content_export.created_at} />
    } else if (
      !content_export ||
      content_export.workflow_state === 'failed' ||
      content_export.workflow_state === 'deleted'
    ) {
      return (
        // @ts-expect-error
        <Text color="danger">
          <em>{I18n.t('Failed')}</em>
        </Text>
      )
    } else {
      return (
        // @ts-expect-error
        <Text color="secondary">
          <em>{I18n.t('Pending')}</em>
        </Text>
      )
    }
  }

  function renderRow(share: ContentShare) {
    return (
      <Table.Row key={share.id}>
        {/* @ts-expect-error */}
        <Table.Cell textAlign="end">{renderUnreadBadge(share)}</Table.Cell>
        <Table.Cell>{share.name}</Table.Cell>
        <Table.Cell>
          <Text>{friendlyShareNames[share.content_type]}</Text>
        </Table.Cell>
        <Table.Cell>
          <Avatar
            // @ts-expect-error
            margin="0 small 0 0"
            // @ts-expect-error
            size="small"
            name={share.sender ? share.sender?.display_name : I18n.t('unknown sender')}
            src={share.sender ? share.sender?.avatar_image_url : '/images/messages/avatar-50.png'}
            data-fs-exclude={true}
          />{' '}
          {share.sender ? share.sender?.display_name : '--'}
        </Table.Cell>
        <Table.Cell>{renderReceivedColumn(share.content_export)}</Table.Cell>
        <Table.Cell>{renderActionMenu(share)}</Table.Cell>
      </Table.Row>
    )
  }

  return (
    // @ts-expect-error
    <Table caption={I18n.t('Content shared by others to you')} layout="auto" hover={true}>
      <Table.Head>
        <Table.Row>
          <Table.ColHeader id="unread">
            <ScreenReaderContent>{I18n.t('Status')}</ScreenReaderContent>
          </Table.ColHeader>
          <Table.ColHeader id="title">{I18n.t('Title')}</Table.ColHeader>
          <Table.ColHeader id="type">{I18n.t('Type')}</Table.ColHeader>
          <Table.ColHeader id="from">{I18n.t('From')}</Table.ColHeader>
          <Table.ColHeader id="received">{I18n.t('Received')}</Table.ColHeader>
          <Table.ColHeader id="actions">{I18n.t('Actions')}</Table.ColHeader>
        </Table.Row>
      </Table.Head>
      <Table.Body>{shares.map(share => renderRow(share))}</Table.Body>
    </Table>
  )
}
