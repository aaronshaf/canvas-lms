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

import {useScope as createI18nScope} from '@canvas/i18n'
import {Flex} from '@instructure/ui-flex'
import {Heading} from '@instructure/ui-heading'
import {Img} from '@instructure/ui-img'
import {Text} from '@instructure/ui-text'
import {View} from '@instructure/ui-view'
import SpacePanda from '@instructure/platform-images/assets/SpacePanda.svg'
import React from 'react'

const I18n = createI18nScope('knowledge_check_not_ready')

export default function KnowledgeCheckNotReady() {
  return (
    <View as="div" margin="x-large auto" textAlign="center" maxWidth="500px">
      <Flex direction="column" alignItems="center" gap="medium">
        <Flex.Item>
          <Img src={SpacePanda} alt="" width="200px" />
        </Flex.Item>
        <Flex.Item>
          <Heading level="h2">{I18n.t('Not Ready Yet')}</Heading>
        </Flex.Item>
        <Flex.Item>
          <Text color="secondary" size="large">
            {I18n.t(
              'Knowledge Checks are being configured for your institution. Please check back shortly.',
            )}
          </Text>
        </Flex.Item>
      </Flex>
    </View>
  )
}
