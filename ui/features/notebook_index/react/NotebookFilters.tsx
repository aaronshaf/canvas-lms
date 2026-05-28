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

import React from 'react'
import {Flex} from '@instructure/ui-flex'
import {Text} from '@instructure/ui-text'
import {REACTION_TYPE, useReactionFilter} from '@instructure/platform-notebook'
import {useScope as createI18nScope} from '@canvas/i18n'

const I18n = createI18nScope('notebook_index')

export type NotebookFiltersProps = {
  filter: REACTION_TYPE | null
  setFilter: (filter: REACTION_TYPE | null) => void
  totalCount?: number
}

export default function NotebookFilters({filter, setFilter, totalCount}: NotebookFiltersProps) {
  const {filterElement} = useReactionFilter({filter, setFilter})

  return (
    <Flex
      as="div"
      alignItems="center"
      justifyItems="space-between"
      margin="0 0 medium 0"
      wrap="wrap"
    >
      <Flex.Item shouldShrink={false}>{filterElement}</Flex.Item>
      {totalCount !== undefined && (
        <Flex.Item shouldShrink={false}>
          <Text size="small" color="secondary" data-testid="notebook-total-results">
            {I18n.t({one: '1 result', other: '%{count} results'}, {count: totalCount})}
          </Text>
        </Flex.Item>
      )}
    </Flex>
  )
}
