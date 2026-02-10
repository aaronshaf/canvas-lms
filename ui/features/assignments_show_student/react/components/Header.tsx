/*
 * Copyright (C) 2018 - present Instructure, Inc.
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

import {Assignment} from '@canvas/assignments/graphql/student/Assignment'
import AssignmentAssetProcessorEula from '@canvas/assignments/react/AssignmentAssetProcessorEula'
import AssignmentDetails from './AssignmentDetails'
import PeerReviewsCounter from './PeerReviewsCounter'
import {Flex} from '@instructure/ui-flex'
import GradeDisplay from './GradeDisplay'
import {Heading} from '@instructure/ui-heading'
import {useScope as createI18nScope} from '@canvas/i18n'
import LatePolicyToolTipContent from './LatePolicyStatusDisplay/LatePolicyToolTipContent'
import React from 'react'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import StudentViewContext from '@canvas/assignments/react/StudentViewContext'
import SubmissionStatusPill from '@canvas/assignments/react/SubmissionStatusPill'
import {Submission} from '@canvas/assignments/graphql/student/Submission'
import {Tooltip} from '@instructure/ui-tooltip'
import PeerReviewNavigationLink from './PeerReviewNavigationLink'

const I18n = createI18nScope('assignments_2_student_header')

class Header extends React.Component {
  static propTypes = {
    assignment: Assignment.shape,
    submission: Submission.shape,
    reviewerSubmission: Submission.shape,
    peerReviewLinkData: Submission.shape,
  }

  static defaultProps = {
    reviewerSubmission: null,
  }

  isPeerReviewModeEnabled = () => {
    // @ts-expect-error
    return this.props.assignment.env.peerReviewModeEnabled
  }

  state = {}

  isSubmissionLate = () => {
    // @ts-expect-error
    if (!this.props.submission || this.props.submission.gradingStatus !== 'graded') {
      return false
    }
    return (
      // @ts-expect-error
      this.props.submission.latePolicyStatus === 'late' ||
      // @ts-expect-error
      this.props.submission.submissionStatus === 'late'
    )
  }

  // @ts-expect-error
  currentAssessmentIndex = assignedAssessments => {
    // @ts-expect-error
    const userId = this.props.assignment.env.revieweeId
    // @ts-expect-error
    const anonymousId = this.props.assignment.env.anonymousAssetId
    const value =
      // @ts-expect-error
      assignedAssessments?.findIndex(assessment => {
        return (
          (userId && userId === assessment.anonymizedUser._id) ||
          (anonymousId && assessment.anonymousId === anonymousId)
        )
      }) || 0
    return value + 1
  }

  renderLatestGrade = () => (
    <StudentViewContext.Consumer>
      {context => {
        const submission = context.lastSubmittedSubmission || {grade: null, gradingStatus: null}
        // @ts-expect-error
        const {assignment} = this.props
        const gradeDisplay = (
          <GradeDisplay
            // @ts-expect-error
            gradingStatus={submission.gradingStatus}
            gradingType={assignment.gradingType}
            // @ts-expect-error
            receivedGrade={submission.grade}
            // @ts-expect-error
            receivedScore={submission.score}
            pointsPossible={assignment.pointsPossible}
          />
        )

        if (
          !ENV.restrict_quantitative_data &&
          // @ts-expect-error
          this.isSubmissionLate(submission) &&
          // @ts-expect-error
          !submission.gradeHidden
        ) {
          return (
            <Tooltip
              as="div"
              renderTip={
                <LatePolicyToolTipContent
                  // @ts-expect-error
                  attempt={submission.attempt}
                  // @ts-expect-error
                  grade={submission.grade}
                  gradingType={assignment.gradingType}
                  // @ts-expect-error
                  originalGrade={submission.enteredGrade}
                  // @ts-expect-error
                  pointsDeducted={submission.deductedPoints}
                  pointsPossible={assignment.pointsPossible}
                />
              }
              on={['hover', 'focus']}
              placement="bottom"
            >
              {gradeDisplay}
            </Tooltip>
          )
        }

        return gradeDisplay
      }}
    </StudentViewContext.Consumer>
  )

  render() {
    // @ts-expect-error
    const isPeerReviewGradingAndAllocationEnabled = window.ENV.peer_review_allocation_and_grading
    let topRightComponent
    if (this.isPeerReviewModeEnabled()) {
      topRightComponent = (
        <Flex wrap="wrap">
          {/* @ts-expect-error */}
          {this.props.peerReviewLinkData ? (
            !isPeerReviewGradingAndAllocationEnabled && (
              <Flex.Item>
                <PeerReviewNavigationLink
                  // @ts-expect-error
                  assignedAssessments={this.props.peerReviewLinkData?.assignedAssessments}
                  currentAssessmentIndex={this.currentAssessmentIndex(
                    // @ts-expect-error
                    this.props.peerReviewLinkData?.assignedAssessments,
                  )}
                />
              </Flex.Item>
            )
          ) : (
            <>
              {/* EVAL-3711 Remove ICE Feature Flag */}
              {!window.ENV.FEATURES?.instui_nav && (
                <Flex.Item margin="0 small 0 0">
                  <PeerReviewsCounter
                    current={this.currentAssessmentIndex(
                      // @ts-expect-error
                      this.props.reviewerSubmission?.assignedAssessments,
                    )}
                    // @ts-expect-error
                    total={this.props.reviewerSubmission?.assignedAssessments?.length || 0}
                  />
                </Flex.Item>
              )}
              {!isPeerReviewGradingAndAllocationEnabled && (
                <Flex.Item>
                  <PeerReviewNavigationLink
                    // @ts-expect-error
                    assignedAssessments={this.props.reviewerSubmission?.assignedAssessments}
                    currentAssessmentIndex={this.currentAssessmentIndex(
                      // @ts-expect-error
                      this.props.reviewerSubmission?.assignedAssessments,
                    )}
                  />
                </Flex.Item>
              )}
            </>
          )}
        </Flex>
      )
    } else {
      topRightComponent = (
        <Flex wrap="wrap" alignItems="center">
          <Flex.Item padding="0 small 0 0">{this.renderLatestGrade()}</Flex.Item>
          {/* @ts-expect-error */}
          {this.props.submission?.assignedAssessments?.length > 0 &&
            !isPeerReviewGradingAndAllocationEnabled && (
              <Flex.Item>
                <PeerReviewNavigationLink
                  // @ts-expect-error
                  assignedAssessments={this.props.submission.assignedAssessments}
                  currentAssessmentIndex={0}
                />
              </Flex.Item>
            )}
        </Flex>
      )
    }
    return (
      <div data-testid="assignment-student-header" id="assignments-2-student-header">
        <Heading level="h1">
          {/* We hide this because in the designs, what visually looks like should
              be the h1 appears after the group/module links, but we need the
              h1 to actually come before them for a11y */}
          {/* @ts-expect-error */}
          <ScreenReaderContent> {this.props.assignment.name} </ScreenReaderContent>
        </Heading>
        {window.ENV.FEATURES?.lti_asset_processor && (
          // @ts-expect-error
          <AssignmentAssetProcessorEula launches={ENV.ASSET_PROCESSOR_EULA_LAUNCH_URLS} />
        )}
        <Flex
          margin="0"
          alignItems="start"
          padding="0 0 large 0"
          id="assignment-student-header-content"
        >
          <Flex.Item shouldShrink={true} shouldGrow={true}>
            <AssignmentDetails
              // @ts-expect-error
              assignment={this.props.assignment}
              // @ts-expect-error
              submission={this.props.submission}
            />
          </Flex.Item>
          {/* @ts-expect-error */}
          {this.props.peerReviewLinkData && <Flex.Item>{topRightComponent}</Flex.Item>}
          {/* @ts-expect-error */}
          {this.props.submission && (
            <Flex.Item>
              <Flex as="div" alignItems="center">
                {/* EVAL-3711 Remove ICE Feature Flag */}
                {!window.ENV.FEATURES?.instui_nav && (
                  <Flex.Item margin="0 x-small 0 0">
                    <SubmissionStatusPill
                      // @ts-expect-error
                      submissionStatus={this.props.submission.submissionStatus}
                      // @ts-expect-error
                      customGradeStatus={this.props.submission.customGradeStatus}
                    />
                  </Flex.Item>
                )}
                <Flex.Item>{topRightComponent}</Flex.Item>
              </Flex>
            </Flex.Item>
          )}
        </Flex>
      </div>
    )
  }
}

export default Header
