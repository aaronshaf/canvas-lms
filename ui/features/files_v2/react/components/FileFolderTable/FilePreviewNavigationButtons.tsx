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

import {Flex} from '@instructure/ui-flex'
import {Button} from '@instructure/ui-buttons'
import {IconArrowEndLine, IconArrowStartLine} from '@instructure/ui-icons'
import {useTranslation} from '@canvas/i18next'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'

interface FilePreviewNavigationButtonsProps {
  handleNext: () => void
  handlePrevious: () => void
}

export const FilePreviewNavigationButtons = ({
  handleNext,
  handlePrevious,
}: FilePreviewNavigationButtonsProps) => {
  const {t} = useTranslation('files_v2')
  return (
    <Flex gap="x-small">
      <Flex.Item>
        <Button
          onClick={handlePrevious}
          withBackground={false}
          color="primary-inverse"
          data-testid="previous-button"
        >
          <Flex gap="x-small">
            <Flex.Item>
              <IconArrowStartLine />
            </Flex.Item>
            <Flex.Item>
              {t('Previous')} <ScreenReaderContent>{t('File')}</ScreenReaderContent>
            </Flex.Item>
          </Flex>
        </Button>
      </Flex.Item>
      <Flex.Item>
        <Button
          onClick={handleNext}
          withBackground={false}
          color="primary-inverse"
          data-testid="next-button"
        >
          <Flex gap="x-small">
            <Flex.Item>
              {t('Next')} <ScreenReaderContent>{t('File')}</ScreenReaderContent>
            </Flex.Item>
            <Flex.Item>
              <IconArrowEndLine />
            </Flex.Item>
          </Flex>
        </Button>
      </Flex.Item>
    </Flex>
  )
}
