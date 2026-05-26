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
import {Alert} from '@instructure/ui-alerts'
import {Flex} from '@instructure/ui-flex'
import {Text} from '@instructure/ui-text'
import {Button} from '@instructure/ui-buttons'
import {useScope as createI18nScope} from '@canvas/i18n'

const I18n = createI18nScope('eportfolio')

interface Props {
  open?: boolean
}

const DeprecationNoticeAlert: React.FC<Props> = ({open = true}) => {
  if (!open) return null
  const title = I18n.t('ePortfolios Will Be Sunset')
  const body = I18n.t(
    'Legacy ePortfolio will now be retired on December 30, 2026. Export your ePortfolios before the end of the year to avoid losing access.',
  )
  const communityUrl =
    'https://community.instructure.com/en/kb/articles/662836-unknown#download-eportfolio'
  return (
    <Alert variant="warning" open={true} data-testid="eportfolio-deprecation-notice">
      <Flex direction="column" gap="x-small">
        <Text weight="bold">{title}</Text>
        <Text>{body}</Text>
        <Flex justifyItems="start">
          <Button
            href={communityUrl}
            target="_blank"
            rel="noopener noreferrer"
            color="primary"
            data-testid="eportfolio-deprecation-community-link"
          >
            {I18n.t('Learn how to export your ePortfolios')}
          </Button>
        </Flex>
      </Flex>
    </Alert>
  )
}

export default DeprecationNoticeAlert
