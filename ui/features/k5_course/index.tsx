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
import {legacyRender} from '@canvas/react'

import K5Course from './react/K5Course'
import {registerK5Theme} from '@canvas/k5/react/k5-theme'
import ready from '@instructure/ready'

registerK5Theme()

ready(() => {
  const courseContainer = document.getElementById('course-dashboard-container')
  if (courseContainer) {
    legacyRender(
      <K5Course
        // @ts-expect-error
        canManage={ENV.PERMISSIONS.manage}
        // @ts-expect-error
        canManageGroups={ENV.PERMISSIONS.manage_groups}
        // @ts-expect-error
        canReadAsAdmin={ENV.PERMISSIONS.read_as_admin}
        // @ts-expect-error
        canReadAnnouncements={ENV.PERMISSIONS.read_announcements}
        currentUser={ENV.current_user}
        // @ts-expect-error
        id={ENV.COURSE.id}
        // @ts-expect-error
        bannerImageUrl={ENV.COURSE.banner_image_url}
        // @ts-expect-error
        cardImageUrl={ENV.COURSE.image_url}
        // @ts-expect-error
        color={ENV.COURSE.color}
        // @ts-expect-error
        name={ENV.COURSE.name}
        // @ts-expect-error
        plannerEnabled={ENV.STUDENT_PLANNER_ENABLED}
        timeZone={ENV.TIMEZONE}
        // @ts-expect-error
        courseOverview={ENV.COURSE.course_overview}
        // @ts-expect-error
        userIsStudent={ENV.COURSE.is_student_or_fake_student}
        // @ts-expect-error
        hideFinalGrades={ENV.COURSE.hide_final_grades}
        // @ts-expect-error
        showLearningMasteryGradebook={ENV.COURSE.student_outcome_gradebook_enabled}
        // @ts-expect-error
        outcomeProficiency={ENV.COURSE.outcome_proficiency}
        // @ts-expect-error
        showStudentView={ENV.COURSE.show_student_view}
        // @ts-expect-error
        studentViewPath={ENV.COURSE.student_view_path}
        // @ts-expect-error
        tabs={ENV.TABS}
        // @ts-expect-error
        settingsPath={ENV.COURSE.settings_path}
        // @ts-expect-error
        groupsPath={ENV.COURSE.groups_path}
        // @ts-expect-error
        latestAnnouncement={ENV.COURSE.latest_announcement}
        // @ts-expect-error
        pagesPath={ENV.COURSE.pages_url}
        // @ts-expect-error
        hasWikiPages={ENV.COURSE.has_wiki_pages}
        // @ts-expect-error
        hasSyllabusBody={ENV.COURSE.has_syllabus_body}
        observedUsersList={ENV.OBSERVED_USERS_LIST}
        // @ts-expect-error
        selfEnrollment={ENV.COURSE.self_enrollment}
        // @ts-expect-error
        tabContentOnly={ENV.TAB_CONTENT_ONLY}
        isMasterCourse={ENV.BLUEPRINT_COURSES_DATA?.isMasterCourse}
        // @ts-expect-error
        showImmersiveReader={ENV.SHOW_IMMERSIVE_READER}
        // @ts-expect-error
        gradingScheme={ENV.GRADING_SCHEME}
        // @ts-expect-error
        pointsBasedGradingScheme={ENV.POINTS_BASED}
        // @ts-expect-error
        restrictQuantitativeData={ENV.RESTRICT_QUANTITATIVE_DATA}
        // @ts-expect-error
        scalingFactor={ENV.SCALING_FACTOR}
      />,
      courseContainer,
    )
  }
})
