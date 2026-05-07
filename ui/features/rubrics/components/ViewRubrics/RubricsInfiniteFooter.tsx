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
import {LoadingIndicator} from '@instructure/platform-loading-indicator'
import {Button} from '@instructure/ui-buttons'
import {View} from '@instructure/ui-view'

const I18n = createI18nScope('rubrics-list-infinite-footer')

export type RubricsInfiniteFooterProps = {
  loadedCount: number
  totalCount: number
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
}

export const RubricsInfiniteFooter = ({
  loadedCount,
  totalCount,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: RubricsInfiniteFooterProps) => {
  return (
    <View as="div" margin="small 0" data-testid="rubrics-infinite-footer">
      {totalCount > 0 && (
        <View as="div" textAlign="center" padding="x-small 0">
          {I18n.t('%{loaded} of %{total} displayed', {
            loaded: loadedCount,
            total: totalCount,
          })}
        </View>
      )}
      {hasNextPage && (
        <View as="div" textAlign="center" padding="x-small 0">
          {isFetchingNextPage ? (
            <LoadingIndicator />
          ) : (
            <Button
              color="secondary"
              onClick={fetchNextPage}
              data-testid="rubrics-load-more-button"
            >
              {I18n.t('Load More')}
            </Button>
          )}
        </View>
      )}
    </View>
  )
}
