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
import React, {useEffect, useRef, useState} from 'react'
import {useTranslation} from '@canvas/i18next'
import sanitizeUrl from '@canvas/util/sanitizeUrl'
import type {File} from '../../../interfaces/File'

const sandboxSettings = (item: File) => {
  const commonSettings = ['allow-downloads', 'allow-same-origin']

  if (item.mime_class !== 'html') {
    commonSettings.push('allow-scripts')
  }

  return commonSettings.join(' ')
}

const FilePreviewIframe = ({item}: {item: File}) => {
  const {t} = useTranslation('files_v2')
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [isChildFocused, setIsChildFocused] = useState(false)

  useEffect(() => {
    const checkFocus = () => {
      setIsChildFocused(document.activeElement === iframeRef.current)
    }

    window.addEventListener('focus', checkFocus)
    window.addEventListener('blur', checkFocus)

    return () => {
      window.removeEventListener('focus', checkFocus)
      window.removeEventListener('blur', checkFocus)
    }
  }, [iframeRef])

  return (
    <iframe
      ref={iframeRef}
      id="file-preview-iframe"
      key={item.id}
      sandbox={sandboxSettings(item)}
      allowFullScreen
      src={sanitizeUrl(item.preview_url)}
      style={{
        ...(item.mime_class === 'html' ? {backgroundColor: '#F2F4F4'} : {}),
        ...(isChildFocused ? {border: '2px solid #FFFFFF'} : {border: 'none'}),
        boxSizing: 'border-box',
        width: '100%',
        height: '100%',
        display: 'block',
      }}
      title={t('Preview for file: {{name}}', {
        name: item.display_name,
      })}
    />
  )
}

export default FilePreviewIframe
