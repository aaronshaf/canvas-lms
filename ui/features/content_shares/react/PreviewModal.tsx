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
import {Button} from '@instructure/ui-buttons'
import CanvasModal from '@canvas/instui-bindings/react/Modal'

const I18n = createI18nScope('content_share_preview_overlay')

type ContentShareType =
  | 'assignment'
  | 'attachment'
  | 'discussion_topic'
  | 'page'
  | 'quiz'
  | 'module'
  | 'module_item'

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

interface PreviewModalProps {
  open?: boolean
  share?: ContentShare | null
  onDismiss?: () => void
}

export default function PreviewModal({open, share, onDismiss}: PreviewModalProps) {
  function sharePreviewUrl(): string | null {
    if (!share?.content_export?.attachment?.url) return null
    const downloadUrl = encodeURIComponent(share.content_export.attachment.url)
    // @ts-expect-error
    return `${ENV.COMMON_CARTRIDGE_VIEWER_URL}?cartridge=${downloadUrl}`
  }

  function Footer() {
    return <Button onClick={onDismiss}>{I18n.t('Close')}</Button>
  }

  return (
    <CanvasModal
      open={open}
      size="fullscreen"
      padding="0"
      closeButtonSize="medium"
      label={I18n.t('Preview')}
      footer={Footer}
      onDismiss={onDismiss}
    >
      <iframe
        style={{width: '100%', height: '100%', border: 'none', display: 'block'}}
        title={I18n.t('Content Share Preview')}
        src={sharePreviewUrl() ?? undefined}
      />
    </CanvasModal>
  )
}
