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

import {useTranslation} from '@canvas/i18next'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {
  AssetProcessors,
  AssetProcessorsProps,
} from '@canvas/lti-asset-processor/react/AssetProcessors'
import {useShouldShowAssetProcessors} from '@canvas/lti-asset-processor/react/hooks/AssetProcessorsState'
import {Heading} from '@instructure/ui-heading'
import {View} from '@instructure/ui-view'
import {AssetProcessorType} from '@canvas/lti/model/AssetProcessor'

type AssetProcessorsForDiscussionProps = Omit<AssetProcessorsProps, 'type'>

const queryClient = new QueryClient()

function AssetProcessorsWithoutQueryClient(props: AssetProcessorsForDiscussionProps) {
  const {t} = useTranslation('discussion_create')
  // useShouldShowAssetProcessors uses tanstack query to fetch tools,
  // so this component needs to be wrapped in a QueryClientProvider
  const shouldShow = useShouldShowAssetProcessors(
    props.courseId,
    'ActivityAssetProcessorContribution',
  )

  if (!shouldShow) {
    return null
  }

  return (
    <View as="div" margin="medium 0">
      <Heading level="h4" margin="medium 0 x-small 0" color="primary">
        {t('Document Processing App(s)')}
      </Heading>
      <View
        as="div"
        padding="small"
        borderWidth="small"
        borderColor="primary"
        borderRadius="none medium medium none"
      >
        <AssetProcessors {...props} type="ActivityAssetProcessorContribution" />
      </View>
    </View>
  )
}

export function AssetProcessorsForDiscussion(props: AssetProcessorsForDiscussionProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AssetProcessorsWithoutQueryClient {...props} />
    </QueryClientProvider>
  )
}
