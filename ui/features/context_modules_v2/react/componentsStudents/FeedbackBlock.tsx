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
import {useTranslation} from '@canvas/i18next'
import {Link} from '@instructure/ui-link'
import {View} from '@instructure/ui-view'
import {Text} from '@instructure/ui-text'

const FeedbackBlock: React.FC = () => {
  const {t} = useTranslation('context_modules_v2')
  return (
    <View
      background="secondary"
      maxWidth="25rem"
      borderRadius="medium"
      as="div"
      padding="small"
      margin="small 0"
    >
      <Text>{t('What do you think of the new Modules experience?')}</Text>
      <br />
      <Text>
        <Link href="https://forms.gle/npPQgCxGBUQormAo8" target="_blank" isWithinText={false}>
          {t('Please share your feedback')}
        </Link>
      </Text>
    </View>
  )
}

export default FeedbackBlock
