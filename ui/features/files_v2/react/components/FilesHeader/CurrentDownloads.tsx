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

import {useCallback, useEffect, useState} from 'react'
import type {TFunction} from 'i18next'
import {useTranslation} from '@canvas/i18next'
import {useFileManagement} from '../../contexts/FileManagementContext'
import {Flex} from '@instructure/ui-flex'
import {View} from '@instructure/ui-view'
import {Text} from '@instructure/ui-text'
import {ProgressBar} from '@instructure/ui-progress'
import {
  addDownloadListener,
  removeDownloadListener,
  performRequest,
} from '../../../utils/downloadUtils'
import {showFlashError} from '@instructure/platform-alerts'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {type File, type Folder} from '../../../interfaces/File'
import pluralize from '@canvas/util/stringPluralize'

const progressMessage = (progress: number, t: TFunction) =>
  t('Preparing download: {{percent}}% complete', {
    percent: progress,
  })

const DownloadProgress = ({progress}: {progress: number}) => {
  const {t} = useTranslation('files_v2')
  return (
    <Flex gap="medium">
      <Flex.Item shouldGrow>
        <Flex direction="column" gap="small">
          <Flex.Item>
            <Text>{progressMessage(progress, t)}</Text>
          </Flex.Item>

          <Flex.Item>
            <ProgressBar
              meterColor={'info'}
              size="x-small"
              screenReaderLabel={t('Downloading')}
              valueNow={progress}
              valueMax={100}
              shouldAnimate
            />
          </Flex.Item>
        </Flex>
      </Flex.Item>
    </Flex>
  )
}

interface CurrentDownloadsProps {
  rows: (File | Folder)[]
}

const CurrentDownloads = ({rows}: CurrentDownloadsProps) => {
  const {t} = useTranslation('files_v2')
  const [isDownloading, setIsDownloading] = useState(false)
  const [progress, setProgress] = useState(0)

  const {contextId, contextType} = useFileManagement()

  const handleDownloadAction = useCallback(
    (e: Event) => {
      if (isDownloading) {
        showFlashError(t('Download already in progress.'))()
        return
      }
      if (
        performRequest({
          contextType: pluralize(contextType),
          contextId: contextId,
          items: (e as CustomEvent).detail.items,
          rows: rows,
          onProgress: (p: number) => setProgress(p),
          onComplete: () => setIsDownloading(false),
        })
      ) {
        setProgress(0)
        setIsDownloading(true)
      }
    },
    [isDownloading, contextType, contextId, rows],
  )

  useEffect(() => {
    addDownloadListener(handleDownloadAction)
    return () => removeDownloadListener(handleDownloadAction)
  }, [handleDownloadAction])

  if (!isDownloading) return null

  return (
    <View as="div" data-testid="current-downloads" className="current_downloads" padding="medium">
      <Flex direction="column" gap="medium">
        <Flex.Item>
          <DownloadProgress progress={progress} />
        </Flex.Item>
      </Flex>
      <ScreenReaderContent aria-live="polite" aria-relevant="all">
        {progressMessage(progress, t)}
      </ScreenReaderContent>
    </View>
  )
}

export default CurrentDownloads
