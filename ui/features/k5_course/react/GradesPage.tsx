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

import React, {useState, useCallback, useEffect, useRef} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'

import {Tabs} from '@instructure/ui-tabs'
import {Text} from '@instructure/ui-text'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'

import {showFlashError} from '@canvas/alerts/react/FlashAlert'
import useFetchApi from '@canvas/use-fetch-api-hook'
import GradingPeriodSelect from './GradingPeriodSelect'
import GradesEmptyPage from './GradesEmptyPage'
import GradeDetails from './GradeDetails'
import IndividualStudentMastery from '@canvas/grade-summary'

const I18n = createI18nScope('course_grades_page')

interface GradesPageProps {
  courseId: string
  courseName: string
  hideFinalGrades: boolean
  currentUser: {id: string}
  userIsStudent: boolean
  userIsCourseAdmin: boolean
  showLearningMasteryGradebook: boolean
  outcomeProficiency?: any
  observedUserId?: string | null
  gradingScheme?: any[]
  pointsBasedGradingScheme?: boolean
  restrictQuantitativeData?: boolean
  scalingFactor?: number
}

export const GradesPage = ({
  courseId,
  courseName,
  hideFinalGrades,
  currentUser,
  userIsStudent,
  userIsCourseAdmin,
  showLearningMasteryGradebook,
  outcomeProficiency,
  observedUserId,
  gradingScheme,
  pointsBasedGradingScheme,
  restrictQuantitativeData,
  scalingFactor,
}: GradesPageProps): React.ReactElement => {
  const [loadingGradingPeriods, setLoadingGradingPeriods] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [gradingPeriods, setGradingPeriods] = useState<any[] | null>(null)
  const [currentGradingPeriodId, setCurrentGradingPeriodId] = useState<string | null>(null)
  const [allowTotalsForAllPeriods, setAllowTotalsForAllPeriods] = useState(true)
  const [selectedGradingPeriodId, setSelectedGradingPeriodId] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState('assignments')
  const [enrollments, setEnrollments] = useState<any[]>([])
  const observedUserRef = useRef<string | null>(null)
  const include = ['grading_periods', 'current_grading_period_scores', 'total_scores']
  if (observedUserId) {
    include.push('observed_users')
  }
  useFetchApi({
    path: `/api/v1/courses/${courseId}`,
    loading: setLoadingGradingPeriods,
    success: useCallback((data: any) => {
      setGradingPeriods(data.grading_periods)
      setEnrollments(data.enrollments)
      setCurrentGradingPeriodId(data.enrollments[0]?.current_grading_period_id)
      setAllowTotalsForAllPeriods(data.enrollments[0]?.totals_for_all_grading_periods_option)
    }, []),
    error: setError,
    params: {
      include,
    },
  })

  useEffect(() => {
    if (error) {
      showFlashError(I18n.t('Failed to load grading periods for %{courseName}', {courseName}))(
        error,
      )
      setError(null)
    }
  }, [error, courseName])

  useEffect(() => {
    if (enrollments.length > 0 && observedUserId && observedUserRef.current !== observedUserId) {
      const enrollment = enrollments.find(
        (e: any) => e.user_id === observedUserId && e.type !== 'observer',
      )
      setCurrentGradingPeriodId(enrollment?.current_grading_period_id)
      setAllowTotalsForAllPeriods(enrollment?.totals_for_all_grading_periods_option)
      observedUserRef.current = observedUserId
    }
  }, [observedUserId, enrollments])

  const allGradingPeriodsSelected = gradingPeriods?.length > 0 && selectedGradingPeriodId === null
  const showTotals = !hideFinalGrades && !(allGradingPeriodsSelected && !allowTotalsForAllPeriods)

  const renderAssignments = () => (
    <>
      {(gradingPeriods?.length > 0 || loadingGradingPeriods) && (
        <GradingPeriodSelect
          loadingGradingPeriods={loadingGradingPeriods}
          gradingPeriods={gradingPeriods}
          onGradingPeriodSelected={setSelectedGradingPeriodId}
          currentGradingPeriodId={currentGradingPeriodId}
          courseName={courseName}
        />
      )}
      <GradeDetails
        courseId={courseId}
        courseName={courseName}
        selectedGradingPeriodId={selectedGradingPeriodId}
        showTotals={showTotals}
        currentUser={currentUser}
        loadingGradingPeriods={loadingGradingPeriods}
        userIsCourseAdmin={userIsCourseAdmin}
        observedUserId={observedUserId}
        gradingScheme={gradingScheme}
        pointsBasedGradingScheme={pointsBasedGradingScheme}
        restrictQuantitativeData={restrictQuantitativeData}
        scalingFactor={scalingFactor}
      />
    </>
  )

  const renderOutcomes = () => (
    <>
      <ScreenReaderContent>
        {I18n.t('Learning outcome gradebook for %{courseName}', {courseName})}
      </ScreenReaderContent>
      <div id="outcomes">
        <IndividualStudentMastery
          courseId={courseId}
          studentId={observedUserId || currentUser.id}
          outcomeProficiency={outcomeProficiency}
        />
      </div>
    </>
  )

  if (!userIsStudent && !observedUserId) {
    return (
      <GradesEmptyPage
        userIsCourseAdmin={userIsCourseAdmin}
        courseId={courseId}
        courseName={courseName}
      />
    )
  } else if (showLearningMasteryGradebook) {
    return (
      <Tabs
        variant="secondary"
        onRequestTabChange={(_e, {id}) => setSelectedTab(id as string)}
        margin="medium 0 0"
      >
        <Tabs.Panel
          renderTitle={<Text size="small">{I18n.t('Assignments')}</Text>}
          id="k5-assignments"
          isSelected={selectedTab === 'k5-assignments'}
          padding="small 0"
        >
          {renderAssignments()}
        </Tabs.Panel>
        <Tabs.Panel
          renderTitle={<Text size="small">{I18n.t('Learning Mastery')}</Text>}
          id="k5-outcomes"
          isSelected={selectedTab === 'k5-outcomes'}
          padding="small 0"
        >
          {renderOutcomes()}
        </Tabs.Panel>
      </Tabs>
    )
  } else {
    return renderAssignments()
  }
}

export default GradesPage
