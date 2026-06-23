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
import {Pagination} from '@instructure/ui-pagination'
import {View} from '@instructure/ui-view'
import {useTranslation} from '@canvas/i18next'
import {Spinner} from '@instructure/ui-spinner'
import {Flex} from '@instructure/ui-flex'

interface PaginatedNavigationProps {
  isLoading: boolean
  currentPage: number
  onPageChange: (page: number, previousPage?: number) => void
  visiblePageInfo: {start: number; end: number; total: number; totalPages: number}
}

const PaginatedNavigation: React.FC<PaginatedNavigationProps> = ({
  isLoading,
  currentPage,
  onPageChange,
  visiblePageInfo,
}) => {
  const {t} = useTranslation('context_modules_v2')
  if (visiblePageInfo.totalPages <= 1) return

  return (
    <View
      as="div"
      padding="medium small"
      margin="x-small"
      textAlign="center"
      data-testid="pagination-container"
    >
      <Flex as="span" justifyItems="center" alignItems="center">
        <View as="span" display="flex" textAlign="end">
          {isLoading && <Spinner size="x-small" renderTitle="Loading module items..." />}
        </View>
        <View as="span" display="block" textAlign="center">
          <Pagination
            as="nav"
            margin="x-small"
            variant="compact"
            labelNext={t('Next page')}
            labelPrev={t('Previous page')}
            currentPage={currentPage}
            totalPageNumber={visiblePageInfo.totalPages}
            onPageChange={onPageChange}
            aria-label={t('Module items pagination')}
          />
        </View>
      </Flex>
      <View as="div" textAlign="center" data-testid="pagination-info-text">
        {t('Showing {{start}}-{{end}} of {{total}} items', {
          start: visiblePageInfo.start,
          end: visiblePageInfo.end,
          total: visiblePageInfo.total,
        })}
      </View>
    </View>
  )
}

export default PaginatedNavigation
