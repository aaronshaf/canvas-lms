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

import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react'
import apiUserContent from '@canvas/util/jquery/apiUserContent'
import {sanitizeHTML} from '@canvas/sanitize-html'
import ErrorShip from '@instructure/platform-images/assets/ErrorShip.svg'
import {GenericErrorPage} from '@instructure/platform-generic-error-page'
import {errorPageTranslations, reportError} from '@canvas/canvas-error-page'
import {Flex} from '@instructure/ui-flex'
import {SimpleSelect} from '@instructure/ui-simple-select'
import {
  Submission,
  Assignment,
  ReviewerSubmission,
  RubricAssessmentRating,
} from '@canvas/assignments/react/AssignmentsPeerReviewsStudentTypes'
import {useScope as createI18nScope} from '@canvas/i18n'
import {View} from '@instructure/ui-view'
import {Button} from '@instructure/ui-buttons'
import {IconDiscussionLine, IconRubricLine} from '@instructure/ui-icons'
import {calculateMasqueradeHeight} from '@canvas/context-modules/differentiated-modules/utils/miscHelpers'
import UrlSubmissionDisplay from '@canvas/assignments/react/UrlSubmissionDisplay'
import FileSubmissionPreview from '@canvas/assignments/react/FileSubmissionPreview'
import StudentAnnotationPreview from '@canvas/assignments/react/StudentAnnotationPreview'
import {showFlashAlert} from '@instructure/platform-alerts'
import {useRubricAssessment} from '../hooks/useRubricAssessment'
import {RubricPanel} from './RubricPanel'
import type {RubricPanelHandle} from './RubricPanel'
import {CommentsPanel} from './CommentsPanel'
import type {CommentsPanelHandle} from './CommentsPanel'
import {MediaRecordingSubmissionDisplay} from './MediaRecordingSubmissionDisplay'

const I18n = createI18nScope('peer_reviews_student')

interface AssignmentSubmissionProps {
  submission: Submission
  assignment: Assignment
  isPeerReviewCompleted: boolean
  rubricAssessment?: {
    _id: string
    assessmentRatings: RubricAssessmentRating[]
  } | null
  reviewerSubmission?: ReviewerSubmission | null
  isMobile?: boolean
  handleNextPeerReview: () => void
  hasSeenPeerReviewModal: boolean
  isReadOnly?: boolean
  isAnonymous: boolean
  submissionUserId?: string
}

const AssignmentSubmission: React.FC<AssignmentSubmissionProps> = ({
  submission,
  assignment,
  isPeerReviewCompleted,
  rubricAssessment,
  reviewerSubmission,
  handleNextPeerReview,
  isMobile = false,
  hasSeenPeerReviewModal,
  isReadOnly = false,
  isAnonymous,
  submissionUserId,
}) => {
  const [viewMode, setViewMode] = useState<'paper' | 'plain_text'>('paper')
  const [showComments, setShowComments] = useState(!assignment.rubric)
  const [showRubric, setShowRubric] = useState(!!assignment.rubric)
  const [rubricFocusTrigger, setRubricFocusTrigger] = useState(0)
  const [commentFocusTrigger, setCommentFocusTrigger] = useState(0)
  const [peerReviewCommentCompleted, setPeerReviewCommentCompleted] =
    useState(isPeerReviewCompleted)
  const previousSubmissionIdRef = useRef(submission._id)
  const commentsButtonRef = useRef<HTMLButtonElement | null>(null)
  const rubricButtonRef = useRef<HTMLButtonElement | null>(null)
  const pendingFocusPanel = useRef<'comments' | 'rubric' | null>(null)
  const pendingFocusAfterSubmit = useRef(false)
  const commentsPanelRef = useRef<CommentsPanelHandle | null>(null)
  const rubricPanelRef = useRef<RubricPanelHandle | null>(null)

  useEffect(() => {
    if (submission._id !== previousSubmissionIdRef.current) {
      previousSubmissionIdRef.current = submission._id
      if (pendingFocusAfterSubmit.current) {
        pendingFocusAfterSubmit.current = false
        pendingFocusPanel.current = null
        if (commentsPanelRef.current || rubricPanelRef.current) {
          commentsPanelRef.current?.focusCloseButton()
          rubricPanelRef.current?.focusCloseButton()
        } else if (assignment.rubric) {
          pendingFocusPanel.current = 'rubric'
          setShowRubric(true)
        } else {
          pendingFocusPanel.current = 'comments'
          setShowComments(true)
        }
      }
    }
  }, [submission._id])

  const {
    rubricAssessmentData,
    rubricAssessmentCompleted,
    rubricViewMode,
    setRubricViewMode,
    handleRubricSubmit,
    resetRubricAssessment,
  } = useRubricAssessment({
    assignment,
    submissionId: submission._id,
    submissionUserId: submission.user?._id,
    submissionAnonymousId: submission.anonymousId,
    rubricAssessment,
    isPeerReviewCompleted,
  })

  useEffect(() => {
    setPeerReviewCommentCompleted(isPeerReviewCompleted)
  }, [isPeerReviewCompleted])

  const isCurrentReviewCompleted = useMemo(
    () =>
      isPeerReviewCompleted ||
      (assignment.rubric ? rubricAssessmentCompleted : peerReviewCommentCompleted),
    [
      isPeerReviewCompleted,
      assignment.rubric,
      rubricAssessmentCompleted,
      peerReviewCommentCompleted,
    ],
  )

  // True when completing this review would satisfy all required peer reviews:
  // the server hasn't marked it done yet, enough reviews are allocated, and no
  // other assigned+available reviews remain for the user to complete.
  // Uses isPeerReviewCompleted (server state) rather than isCurrentReviewCompleted
  // so that the label stays "Finish Peer Reviews" even after a local comment submit.
  const isLastRequiredReview = useMemo(() => {
    if (isPeerReviewCompleted) return false
    const assessmentRequests = assignment.assessmentRequestsForCurrentUser
    const requiredCount = assignment.peerReviews?.count || 0
    if (!assessmentRequests || assessmentRequests.length < requiredCount) return false
    const currentAssessment = assessmentRequests.find(a => a.submission?._id === submission._id)
    if (!currentAssessment) return false
    return !assessmentRequests.some(
      a =>
        a.workflowState === 'assigned' && a.available === true && a._id !== currentAssessment._id,
    )
  }, [
    isPeerReviewCompleted,
    assignment.assessmentRequestsForCurrentUser,
    assignment.peerReviews?.count,
    submission._id,
  ])

  const allPeerReviewsCompleted = useMemo(() => {
    return (
      isPeerReviewCompleted &&
      !!assignment.assessmentRequestsForCurrentUser &&
      !assignment.assessmentRequestsForCurrentUser.some(
        a => a.workflowState === 'assigned' && a.available === true,
      )
    )
  }, [isPeerReviewCompleted, assignment.assessmentRequestsForCurrentUser])

  const handleToggleComments = useCallback(() => {
    if (!showComments) {
      pendingFocusPanel.current = 'comments'
      setShowRubric(false)
    }
    setShowComments(!showComments)
  }, [showComments])

  const handleToggleRubric = useCallback(() => {
    if (!showRubric) {
      pendingFocusPanel.current = 'rubric'
      setShowComments(false)
    }
    setShowRubric(!showRubric)
  }, [showRubric])

  const handleCloseComments = useCallback(() => {
    setShowComments(false)
    commentsButtonRef.current?.focus()
  }, [])

  const handleCloseRubric = useCallback(() => {
    setShowRubric(false)
    rubricButtonRef.current?.focus()
  }, [])

  const handlePeerReviewCompletion = () => {
    if (!isCurrentReviewCompleted) {
      if (assignment.rubric && !rubricAssessmentCompleted) {
        showFlashAlert({
          message: I18n.t('You must fill out the rubric in order to submit your peer review.'),
          type: 'error',
        })
        if (!showRubric) {
          pendingFocusPanel.current = null
          setShowComments(false)
          setShowRubric(true)
        }
        setRubricFocusTrigger(t => t + 1)
        return
      }

      if (!assignment.rubric && !peerReviewCommentCompleted) {
        showFlashAlert({
          message: I18n.t(
            'Before you can submit this peer review, you must leave a comment for your peer.',
          ),
          type: 'error',
        })
        if (!showComments) {
          pendingFocusPanel.current = null
          setShowComments(true)
        }
        setCommentFocusTrigger(t => t + 1)
        return
      }
    }

    pendingFocusAfterSubmit.current = true
    setPeerReviewCommentCompleted(false)
    resetRubricAssessment()
    handleNextPeerReview()
  }

  const renderTextEntry = () => {
    const submissionClass = `user_content ${viewMode}`

    return (
      <View
        as="div"
        height="100%"
        background="secondary"
        padding="small"
        overflowY={isMobile ? 'auto' : 'hidden'}
      >
        <Flex as="div" textAlign="end" margin="0 0 small 0">
          <SimpleSelect
            renderLabel=""
            value={viewMode}
            onChange={(_e, {value}) => setViewMode(value as 'paper' | 'plain_text')}
            data-testid="view-mode-selector"
          >
            <SimpleSelect.Option id="paper" value="paper">
              {I18n.t('Paper View')}
            </SimpleSelect.Option>
            <SimpleSelect.Option id="plain_text" value="plain_text">
              {I18n.t('Plain Text View')}
            </SimpleSelect.Option>
          </SimpleSelect>
        </Flex>
        <div
          id="submission_preview"
          className={submissionClass}
          data-testid="text-entry-content"
          role="document"
          style={{maxHeight: isMobile ? undefined : '43vh', overflow: 'auto'}}
          // xsslint safeString.method convert
          dangerouslySetInnerHTML={{
            __html: sanitizeHTML(apiUserContent.convert(submission.body || '')),
          }}
        />
      </View>
    )
  }

  const renderUrlEntry = () => {
    if (!submission.url) {
      return renderError(
        I18n.t('URL Submission Error'),
        I18n.t('Student Peer Review Submission Error Page.'),
        I18n.t('The URL submission is missing or invalid.'),
      )
    }

    return (
      <View
        as="div"
        height="100%"
        background="secondary"
        padding="small"
        overflowY={isMobile ? 'auto' : 'hidden'}
        data-testid="url-entry-content"
      >
        <UrlSubmissionDisplay url={submission.url} />
      </View>
    )
  }

  const renderError = (subject: string, category: string, message: string) => {
    return (
      <GenericErrorPage
        imageUrl={ErrorShip}
        onReportError={reportError}
        translations={errorPageTranslations}
        errorSubject={subject}
        errorCategory={category}
        errorMessage={message}
      />
    )
  }

  const renderSubmissionType = () => {
    switch (submission.submissionType) {
      case 'online_text_entry':
        return renderTextEntry()
      case 'online_url':
        return renderUrlEntry()
      case 'online_upload':
        return (
          <FileSubmissionPreview
            submission={submission}
            assignment={assignment}
            userId={submissionUserId}
          />
        )
      case 'student_annotation':
        return <StudentAnnotationPreview submission={submission} />
      case 'media_recording': {
        if (!submission.mediaObject?._id) {
          return renderError(
            I18n.t('Media Recording Error'),
            I18n.t('Student Peer Review Submission Error Page.'),
            I18n.t('The media recording is missing or unavailable.'),
          )
        }
        return <MediaRecordingSubmissionDisplay mediaObject={submission.mediaObject} />
      }
      default:
        return renderError(
          I18n.t('Submission type error'),
          I18n.t('Student Peer Review Submission Error Page.'),
          I18n.t('Submission type not yet supported.'),
        )
    }
  }

  return (
    <View
      as="div"
      minHeight="calc(720px - 10.75rem)"
      height={
        isAnonymous
          ? `calc(100vh - 22rem - ${calculateMasqueradeHeight() + 65}px)`
          : `calc(100vh - 24rem - ${calculateMasqueradeHeight() + 65}px)`
      }
      overflowY="hidden"
    >
      <Flex as="div" height="100%" alignItems="start">
        <Flex.Item as="div" height="100%" shouldGrow shouldShrink overflowX="hidden">
          {renderSubmissionType()}
        </Flex.Item>
        {showRubric && assignment.rubric && (
          <RubricPanel
            ref={rubricPanelRef}
            assignment={assignment}
            rubricAssessmentData={rubricAssessmentData}
            rubricViewMode={rubricViewMode}
            isPeerReviewCompleted={isPeerReviewCompleted}
            rubricAssessmentCompleted={rubricAssessmentCompleted}
            onClose={handleCloseRubric}
            onSubmit={handleRubricSubmit}
            onViewModeChange={setRubricViewMode}
            isReadOnly={isReadOnly}
            autoFocusCloseButton={pendingFocusPanel.current === 'rubric'}
            triggerValidationAndFocus={rubricFocusTrigger}
            isMobile={isMobile}
          />
        )}
        {showComments && (
          <CommentsPanel
            ref={commentsPanelRef}
            submission={submission}
            assignment={assignment}
            reviewerSubmission={reviewerSubmission}
            isMobile={isMobile}
            isOpen={showComments}
            onClose={handleCloseComments}
            onSuccessfulPeerReview={() => {
              setPeerReviewCommentCompleted(true)
            }}
            isReadOnly={isReadOnly}
            suppressSuccessAlert={true}
            autoFocusCloseButton={pendingFocusPanel.current === 'comments'}
            focusCommentInputTrigger={commentFocusTrigger}
          />
        )}
      </Flex>
      <footer
        style={{
          position: 'fixed',
          right: 0,
          left: isMobile ? '0px' : '275px',
          bottom: `${calculateMasqueradeHeight()}px`,
          padding: isMobile ? '0px' : '0px 24px 0px 0px',
          zIndex: '999',
        }}
        data-testid="peer-review-footer"
      >
        <View
          as="div"
          borderWidth="small 0 0 0"
          borderColor="primary"
          padding="small"
          background="primary"
        >
          <Flex
            direction={isMobile ? 'column' : 'row'}
            justifyItems={isMobile ? 'start' : 'space-between'}
          >
            <Flex.Item margin={isMobile ? '0 0 small 0' : '0'}>
              <Flex gap="small">
                {assignment.rubric && (
                  <Flex.Item>
                    <Button
                      elementRef={(el: Element | null) => {
                        rubricButtonRef.current = el as HTMLButtonElement
                      }}
                      renderIcon={<IconRubricLine />}
                      onClick={handleToggleRubric}
                      data-testid="toggle-rubric-button"
                      size={isMobile ? 'small' : 'medium'}
                      aria-expanded={showRubric}
                      aria-controls="rubric-panel"
                      aria-haspopup="dialog"
                    >
                      {showRubric ? I18n.t('Hide Rubric') : I18n.t('Show Rubric')}
                    </Button>
                  </Flex.Item>
                )}
                <Flex.Item>
                  <Button
                    elementRef={(el: Element | null) => {
                      commentsButtonRef.current = el as HTMLButtonElement
                    }}
                    renderIcon={<IconDiscussionLine />}
                    onClick={handleToggleComments}
                    data-testid="toggle-comments-button"
                    size={isMobile ? 'small' : 'medium'}
                    aria-expanded={showComments}
                    aria-controls="comments-panel"
                    aria-haspopup="dialog"
                  >
                    {showComments ? I18n.t('Hide Comments') : I18n.t('Show Comments')}
                  </Button>
                </Flex.Item>
              </Flex>
            </Flex.Item>
            {!isReadOnly &&
              !hasSeenPeerReviewModal &&
              !pendingFocusAfterSubmit.current &&
              !allPeerReviewsCompleted && (
                <Flex.Item>
                  <Button
                    color="primary"
                    data-testid="submit-peer-review-button"
                    size={isMobile ? 'small' : 'medium'}
                    onClick={handlePeerReviewCompletion}
                  >
                    {!isPeerReviewCompleted && isLastRequiredReview
                      ? I18n.t('Finish Peer Reviews')
                      : I18n.t('Next Peer Review')}
                  </Button>
                </Flex.Item>
              )}
          </Flex>
        </View>
      </footer>
    </View>
  )
}

export default AssignmentSubmission
