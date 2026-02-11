/*
 * Copyright (C) 2021 - present Instructure, Inc.
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

import {View} from '@instructure/ui-view'

import K5Announcement, {
  K5AnnouncementLoadingMask,
  type K5AnnouncementType,
} from '@canvas/k5/react/K5Announcement'
import LoadingWrapper from '@canvas/k5/react/LoadingWrapper'

interface HomeroomAnnouncement {
  courseId: string
  courseName: string
  courseUrl: string
  published?: boolean
  canEdit?: boolean
  canReadAnnouncements?: boolean
  announcement?: K5AnnouncementType
}

interface HomeroomAnnouncementsLayoutProps {
  homeroomAnnouncements?: HomeroomAnnouncement[]
  loading: boolean
}

export default function HomeroomAnnouncementsLayout({
  homeroomAnnouncements,
  loading,
}: HomeroomAnnouncementsLayoutProps) {
  return (
    <LoadingWrapper
      id="homeroom-announcements"
      isLoading={loading}
      renderCustomSkeleton={K5AnnouncementLoadingMask}
      skeletonsNum={homeroomAnnouncements?.filter(h => h.announcement || h.canEdit)?.length} // if there is no homeroom course set, this loading mask shouldn't appear
    >
      <View>
        {homeroomAnnouncements?.map(homeroom => {
          return (
            <View key={homeroom.courseId}>
              <K5Announcement
                courseId={homeroom.courseId}
                courseName={homeroom.courseName}
                courseUrl={homeroom.courseUrl}
                canEdit={homeroom.canEdit}
                canReadAnnouncements={homeroom.canReadAnnouncements}
                published={homeroom.published}
                showCourseDetails={true}
                firstAnnouncement={homeroom.announcement}
              />
            </View>
          )
        })}
      </View>
    </LoadingWrapper>
  )
}
