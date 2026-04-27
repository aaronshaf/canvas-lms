/*
 * Copyright (C) 2020 - present Instructure, Inc.
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
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {func, string} from 'prop-types'
import moment from 'moment-timezone'
import produce from 'immer'
import {DateTime} from '@instructure/ui-i18n'
import {InlineAlert as CanvasInlineAlert} from '@instructure/platform-alerts'
import {LoadingIndicator} from '@instructure/platform-loading-indicator'
import useFetchApi from '@canvas/use-fetch-api-hook'
import BulkEditDateSelect from './BulkEditDateSelect'
import BulkEditHeader from './BulkEditHeader'
import BulkEditTable from './BulkEditTable'
import MoveDatesModal from './MoveDatesModal'
import useSaveAssignments from './hooks/useSaveAssignments'
import useMonitorJobCompletion from './hooks/useMonitorJobCompletion'
import DateValidator from '@canvas/grading/DateValidator'
import GradingPeriodsAPI from '@canvas/grading/jquery/gradingPeriodsApi'
import {originalDateField, canEditAll, anyAssignmentEdited} from './utils'

const I18n = createI18nScope('assignments_bulk_edit')

type PeerReviewDateDraft = {
  base?: boolean
  due_at: string | null
  parent_override_id?: string
  errors?: any
  [key: string]: unknown
}

type DateOverrideDraft = {
  id?: string
  base?: boolean
  due_at?: string | null
  unlock_at?: string | null
  lock_at?: string | null
  [key: string]: unknown
}

BulkEdit.propTypes = {
  courseId: string.isRequired,
  onCancel: func.isRequired,
  onSave: func, // for now, this is just informational that save has been clicked
  defaultDueTime: string,
}

BulkEdit.defaultProps = {
  onSave: () => {},
}

// @ts-expect-error
export default function BulkEdit({courseId, onCancel, onSave, defaultDueTime}) {
  const dateValidator = useMemo(
    () =>
      new DateValidator({
        date_range: ENV.VALID_DATE_RANGE || {
          start_at: {date: null, date_context: 'term'},
          end_at: {date: null, date_context: 'term'},
        },
        hasGradingPeriods: !!ENV.HAS_GRADING_PERIODS,
        gradingPeriods: GradingPeriodsAPI.deserializePeriods(ENV.active_grading_periods || []),
        userIsAdmin: ENV.current_user_is_admin,
      }),
    [],
  )
  const [assignments, setAssignments] = useState([])
  const [loadingError, setLoadingError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [moveDatesModalOpen, setMoveDatesModalOpen] = useState(false)
  const [noAssignmentsSelectedError, setNoAssignmentsSelectedError] = useState(false)
  const [noAssignmentsEditedError, setNoAssignmentsEditedError] = useState(false)
  const {saveAssignments, startingSave, startingSaveError, progressUrl, setProgressUrl} =
    useSaveAssignments(courseId)
  const {jobCompletion, jobRunning, jobSuccess, jobErrors, setJobSuccess} = useMonitorJobCompletion(
    {
      progressUrl,
    },
  )

  const peerReviewAllocationAndGradingEnabled = !!ENV.PEER_REVIEW_ALLOCATION_AND_GRADING_ENABLED

  // @ts-expect-error
  const filterAssignments = useCallback(assignments => {
    // @ts-expect-error
    assignments.forEach(assignment => {
      if (!assignment.hasOwnProperty('all_dates')) {
        assignment.all_dates = []
      }
    })

    return assignments
  }, [])

  useFetchApi({
    success: setAssignments,
    // @ts-expect-error
    error: setLoadingError,
    loading: setLoading,
    convert: filterAssignments,
    path: `/api/v1/courses/${courseId}/assignments/`,
    fetchAllPages: true,
    params: {
      per_page: 50,
      include: ['all_dates', 'can_edit', ...(peerReviewAllocationAndGradingEnabled ? ['peer_review'] : [])],
      order_by: 'due_at',
      exclude_checkpoints: true,
    },
  })

  useEffect(() => {
    function clearOriginalDates() {
      setAssignments(currentAssignments =>
        produce(currentAssignments, draftAssignments => {
          // @ts-expect-error
          const draftOverrides = draftAssignments.flatMap(assignment => assignment.all_dates)
          draftOverrides.forEach(draftOverride => {
            delete draftOverride[originalDateField('due_at')]
            delete draftOverride[originalDateField('unlock_at')]
            delete draftOverride[originalDateField('lock_at')]
          })
          if (peerReviewAllocationAndGradingEnabled) {
            draftAssignments.forEach(draftAssignment => {
              const peerReviewDates = (draftAssignment as any).peer_review_sub_assignment?.all_dates as PeerReviewDateDraft[] | undefined
              if (peerReviewDates) {
                peerReviewDates.forEach(peerReviewDate => {
                  delete peerReviewDate[originalDateField('due_at')]
                })
              }
            })
          }
        }),
      )
    }

    if (jobSuccess) clearOriginalDates()
  }, [jobSuccess])

  useEffect(() => {
    // @ts-expect-error
    function recordJobErrors(errors) {
      setAssignments(currentAssignments =>
        produce(currentAssignments, draftAssignments => {
          draftAssignments.forEach(draftAssignment => {
            // @ts-expect-error
            draftAssignment.all_dates.forEach(draftOverride => {
              let error
              if (draftOverride.base) {
                error = errors.find(
                  // @ts-expect-error
                  e => e.assignment_id == draftAssignment.id && !e.assignment_override_id,
                )
              } else {
                // @ts-expect-error
                error = errors.find(e => e.assignment_override_id == draftOverride.id)
              }
              if (error && error.errors) {
                draftOverride.errors = {}
                for (const dateKey in error.errors) {
                  draftOverride.errors[dateKey] = error.errors[dateKey][0].message
                }
              } else {
                delete draftOverride.errors
              }
            })
          })
        }),
      )
    }
    // @ts-expect-error
    if (jobErrors && !jobErrors.hasOwnProperty('message')) recordJobErrors(jobErrors)
  }, [jobErrors])

  const setDateOnOverride = useCallback(
    // @ts-expect-error
    (override, dateFieldName, newDate) => {
      const currentDate = override[dateFieldName]
      const newDateISO = newDate?.toISOString() || null
      if (currentDate === newDateISO || moment(currentDate).isSame(moment(newDateISO))) return

      const originalField = originalDateField(dateFieldName)
      if (!override.hasOwnProperty(originalField)) {
        override[originalField] = override[dateFieldName]
      }
      override[dateFieldName] = newDateISO
      override.persisted = false
      override.errors = dateValidator.validateDatetimes(override)
    },
    [dateValidator],
  )

  const shiftDateOnOverride = useCallback(
    // @ts-expect-error
    (override, dateFieldName, nDays) => {
      const currentDate = override[dateFieldName]
      if (currentDate) {
        const newDate = moment(currentDate).add(nDays, 'days').toDate()
        setDateOnOverride(override, dateFieldName, newDate)
      }
    },
    [setDateOnOverride],
  )

  const clearPreviousSave = useCallback(() => {
    // Clear anything from the previous save operation so those elements don't show anymore and so
    // the above effect doesn't try to clear the original dates.
    setJobSuccess(false)
    setProgressUrl(null)
  }, [setJobSuccess, setProgressUrl])

  const findOverride = useCallback(
    (
      someAssignments: any[],
      assignmentId: string,
      overrideId: string | null,
    ): DateOverrideDraft | undefined => {
      const isBaseOverride = !overrideId
      const assignment = someAssignments.find((a: {id: string}) => a.id === assignmentId)
      return assignment?.all_dates.find((o: DateOverrideDraft) =>
        isBaseOverride ? o.base : o.id === overrideId,
      )
    },
    [],
  )

  const findPeerReviewDate = useCallback(
    (someAssignments: any[], assignmentId: string, overrideId: string | null) => {
      const assignment = someAssignments.find((a: {id: string}) => a.id === assignmentId)
      const peerReviewSub: {all_dates?: PeerReviewDateDraft[]} | undefined = assignment?.peer_review_sub_assignment
      if (!peerReviewSub?.all_dates) return null
      const isBase = !overrideId
      return peerReviewSub.all_dates.find(d => (isBase ? d.base : d.parent_override_id === overrideId)) || null
    },
    [],
  )

  const validatePeerReviewDate = useCallback(
    (peerReviewDate: PeerReviewDateDraft, parentOverride: DateOverrideDraft) => {
      const errors = dateValidator.validateDatetimes({
        due_at: parentOverride.due_at,
        unlock_at: parentOverride.unlock_at,
        lock_at: parentOverride.lock_at,
        peer_review_due_at: peerReviewDate.due_at,
      })
      peerReviewDate.errors = errors.peer_review_due_at ? {due_at: errors.peer_review_due_at} : {}
    },
    [dateValidator],
  )

  // Validates pre-existing peer review dates once after load to disable Save on already-invalid
  // rows; without this, `errors` only populates on user edits and stale invalid rows slip through.
  const hasValidatedOnLoadRef = useRef(false)
  useEffect(() => {
    if (loading || !peerReviewAllocationAndGradingEnabled || hasValidatedOnLoadRef.current) return
    hasValidatedOnLoadRef.current = true
    setAssignments(currentAssignments =>
      produce(currentAssignments, draftAssignments => {
        draftAssignments.forEach(draftAssignment => {
          const assignment = draftAssignment as any
          const peerReviewDates = assignment.peer_review_sub_assignment?.all_dates as
            | PeerReviewDateDraft[]
            | undefined
          if (!peerReviewDates) return
          peerReviewDates.forEach(peerReviewDate => {
            const parentOverride = assignment.all_dates.find((d: DateOverrideDraft) =>
              peerReviewDate.base ? d.base : d.id === peerReviewDate.parent_override_id,
            ) as DateOverrideDraft | undefined
            if (parentOverride) validatePeerReviewDate(peerReviewDate, parentOverride)
          })
        })
      }),
    )
  }, [loading, peerReviewAllocationAndGradingEnabled, validatePeerReviewDate])

  const updatePeerReviewDate = useCallback(
    ({
      dateKey,
      newDate,
      assignmentId,
      overrideId,
    }: {
      dateKey: string
      newDate: Date | null
      assignmentId: string
      overrideId: string | null
    }) => {
      clearPreviousSave()
      setAssignments(currentAssignments =>
        produce(currentAssignments, draftAssignments => {
          const peerReviewDate = findPeerReviewDate(draftAssignments, assignmentId, overrideId)
          if (!peerReviewDate) return
          setDateOnOverride(peerReviewDate, dateKey, newDate)
          const parentOverride = findOverride(draftAssignments, assignmentId, overrideId)
          if (parentOverride) validatePeerReviewDate(peerReviewDate, parentOverride)
        }),
      )
    },
    [
      clearPreviousSave,
      findOverride,
      findPeerReviewDate,
      setDateOnOverride,
      validatePeerReviewDate,
    ],
  )

  const updateAssignmentDate = useCallback(
    // @ts-expect-error
    ({dateKey, newDate, assignmentId, overrideId}) => {
      clearPreviousSave()
      setAssignments(currentAssignments =>
        produce(currentAssignments, draftAssignments => {
          const override = findOverride(draftAssignments, assignmentId, overrideId)
          if (!override) return
          setDateOnOverride(override, dateKey, newDate)
          if (peerReviewAllocationAndGradingEnabled) {
            const peerReviewDate = findPeerReviewDate(draftAssignments, assignmentId, overrideId)
            if (peerReviewDate) validatePeerReviewDate(peerReviewDate, override)
          }
        }),
      )
    },
    [
      clearPreviousSave,
      findOverride,
      findPeerReviewDate,
      peerReviewAllocationAndGradingEnabled,
      setDateOnOverride,
      validatePeerReviewDate,
    ],
  )

  const clearOverrideEdits = useCallback(
    // @ts-expect-error
    ({assignmentId, overrideId}) => {
      setAssignments(currentAssignments =>
        produce(currentAssignments, draftAssignments => {
          const override = findOverride(draftAssignments, assignmentId, overrideId)
          if (!override) return
          ;['due_at', 'unlock_at', 'lock_at'].forEach(dateField => {
            const originalField = originalDateField(dateField)
            if (override.hasOwnProperty(originalField)) {
              override[dateField] = override[originalField]
              delete override[originalField]
            }
          })
          delete override.errors
          delete override.persisted

          const peerReviewDate = findPeerReviewDate(draftAssignments, assignmentId, overrideId)
          if (peerReviewDate) {
            const originalField = originalDateField('due_at')
            if (peerReviewDate.hasOwnProperty(originalField)) {
              peerReviewDate.due_at = peerReviewDate[originalField] as string | null
              delete peerReviewDate[originalField]
            }
            delete peerReviewDate.errors
            delete peerReviewDate.persisted
          }
        }),
      )
    },
    [findOverride, findPeerReviewDate],
  )

  // @ts-expect-error
  const setAssignmentSelected = useCallback((assignmentId, selected) => {
    setAssignments(currentAssignments =>
      produce(currentAssignments, draftAssignments => {
        // @ts-expect-error
        const assignment = draftAssignments.find(a => a.id === assignmentId)
        // @ts-expect-error
        assignment.selected = selected
      }),
    )
  }, [])

  // @ts-expect-error
  const selectAllAssignments = useCallback(selected => {
    setAssignments(currentAssignments =>
      produce(currentAssignments, draftAssignments => {
        draftAssignments.forEach(a => {
          // @ts-expect-error
          if (canEditAll(a)) a.selected = selected
        })
      }),
    )
  }, [])

  // @ts-expect-error
  const selectDateRange = useCallback((startDate, endDate) => {
    const timezone = ENV?.TIMEZONE || DateTime.browserTimeZone()
    const startMoment = moment.tz(startDate, timezone).startOf('day')
    const endMoment = moment.tz(endDate, timezone).endOf('day')
    setAssignments(currentAssignments =>
      produce(currentAssignments, draftAssignments => {
        draftAssignments.forEach(draftAssignment => {
          // @ts-expect-error
          const shouldSelect = draftAssignment.all_dates.some(draftOverride =>
            ['due_at', 'lock_at', 'unlock_at'].some(dateField =>
              moment(draftOverride[dateField]).isBetween(startMoment, endMoment, null, '[]'),
            ),
          )
          // @ts-expect-error
          draftAssignment.selected = shouldSelect
        })
      }),
    )
  }, [])

  const handleSave = useCallback(() => {
    const assignmentEdited = anyAssignmentEdited(assignments)
    if (assignmentEdited) {
      onSave()
      saveAssignments(assignments)
    } else {
      setNoAssignmentsEditedError(true)
    }
  }, [assignments, onSave, saveAssignments])

  const handleOpenBatchEdit = useCallback(
    (value = true) => {
      // @ts-expect-error
      const selectedAssignmentsCount = assignments.filter(a => a.selected).length
      if (value && selectedAssignmentsCount === 0) {
        setNoAssignmentsSelectedError(true)
        return
      }
      setNoAssignmentsSelectedError(false)
      setMoveDatesModalOpen(!!value)
    },
    [assignments],
  )

  const handleBatchEditShift = useCallback(
    // @ts-expect-error
    nDays => {
      setAssignments(currentAssignments =>
        produce(currentAssignments, draftAssignments => {
          draftAssignments.forEach(draftAssignment => {
            // @ts-expect-error
            if (draftAssignment.selected) {
              // @ts-expect-error
              draftAssignment.all_dates.forEach(draftOverride => {
                shiftDateOnOverride(draftOverride, 'due_at', nDays)
                shiftDateOnOverride(draftOverride, 'unlock_at', nDays)
                shiftDateOnOverride(draftOverride, 'lock_at', nDays)
              })
              const assignment = draftAssignment as any
              if (peerReviewAllocationAndGradingEnabled) {
                const peerReviewDates = assignment.peer_review_sub_assignment?.all_dates as PeerReviewDateDraft[] | undefined
                if (peerReviewDates) {
                  peerReviewDates.forEach(peerReviewDate => {
                    shiftDateOnOverride(peerReviewDate, 'due_at', nDays)
                    const parentOverride = assignment.all_dates.find((d: DateOverrideDraft) =>
                      peerReviewDate.base ? d.base : d.id === peerReviewDate.parent_override_id,
                    ) as DateOverrideDraft | undefined
                    if (parentOverride) validatePeerReviewDate(peerReviewDate, parentOverride)
                  })
                }
              }
            }
          })
        }),
      )
      setMoveDatesModalOpen(false)
    },
    [peerReviewAllocationAndGradingEnabled, shiftDateOnOverride, validatePeerReviewDate],
  )
  const handleBatchEditRemove = useCallback(
    // @ts-expect-error
    datesToRemove => {
      setAssignments(currentAssignments =>
        produce(currentAssignments, draftAssignments => {
          draftAssignments.forEach(draftAssignment => {
            // @ts-expect-error
            if (draftAssignment.selected) {
              // @ts-expect-error
              draftAssignment.all_dates.forEach(draftOverride => {
                if (datesToRemove.includes('due_at'))
                  setDateOnOverride(draftOverride, 'due_at', null)
                if (datesToRemove.includes('unlock_at'))
                  setDateOnOverride(draftOverride, 'unlock_at', null)
                if (datesToRemove.includes('lock_at'))
                  setDateOnOverride(draftOverride, 'lock_at', null)
              })
              const assignment = draftAssignment as any
              if (peerReviewAllocationAndGradingEnabled) {
                const peerReviewDates = assignment.peer_review_sub_assignment?.all_dates as PeerReviewDateDraft[] | undefined
                if (peerReviewDates) {
                  peerReviewDates.forEach(peerReviewDate => {
                    if (datesToRemove.includes('due_at'))
                      setDateOnOverride(peerReviewDate, 'due_at', null)
                    // unlock_at/lock_at are derived from the parent override in useSaveAssignments,
                    // so we don't need to clear them on the peer review date itself.
                    const parentOverride = assignment.all_dates.find((d: DateOverrideDraft) =>
                      peerReviewDate.base ? d.base : d.id === peerReviewDate.parent_override_id,
                    ) as DateOverrideDraft | undefined
                    if (parentOverride) validatePeerReviewDate(peerReviewDate, parentOverride)
                  })
                }
              }
            }
          })
        }),
      )
      setMoveDatesModalOpen(false)
    },
    [peerReviewAllocationAndGradingEnabled, setDateOnOverride, validatePeerReviewDate],
  )

  function renderHeader() {
    const headerProps = {
      assignments,
      startingSave,
      jobRunning,
      jobCompletion,
      jobSuccess,
      onSave: handleSave,
      onCancel,
      onOpenBatchEdit: handleOpenBatchEdit,
    }
    return <BulkEditHeader {...headerProps} />
  }

  function renderDateSelect() {
    return <BulkEditDateSelect selectDateRange={selectDateRange} />
  }

  function renderSaveSuccess() {
    if (jobSuccess) {
      return (
        // @ts-expect-error
        <CanvasInlineAlert variant="success" liveAlert={true}>
          {I18n.t('Assignment dates saved successfully.')}
        </CanvasInlineAlert>
      )
    }
  }

  function renderFetchError() {
    return (
      // @ts-expect-error
      <CanvasInlineAlert variant="error" liveAlert={true}>
        {I18n.t('There was an error retrieving assignment dates.')}
      </CanvasInlineAlert>
    )
  }

  function renderNoAssignmentsSelectedError() {
    if (noAssignmentsSelectedError) {
      return (
        // @ts-expect-error
        <CanvasInlineAlert
          variant="error"
          liveAlert={true}
          renderCloseButtonLabel={() => I18n.t('Close')}
          onDismiss={() => setNoAssignmentsSelectedError(false)}
          timeout={5000}
        >
          {I18n.t('Use checkboxes to select one or more assignments to batch edit.')}
        </CanvasInlineAlert>
      )
    }
  }

  function renderNoAssignmentsEditedError() {
    if (noAssignmentsEditedError) {
      return (
        // @ts-expect-error
        <CanvasInlineAlert
          variant="error"
          liveAlert={true}
          renderCloseButtonLabel={() => I18n.t('Close')}
          onDismiss={() => setNoAssignmentsEditedError(false)}
          timeout={5000}
        >
          {I18n.t('Update at least one date to save changes.')}
        </CanvasInlineAlert>
      )
    }
  }

  function renderSaveError() {
    if (startingSaveError) {
      return (
        // @ts-expect-error
        <CanvasInlineAlert variant="error" liveAlert={true}>
          {I18n.t('Error starting save operation:')} {startingSaveError}
        </CanvasInlineAlert>
      )
    } else if (jobErrors) {
      return (
        // @ts-expect-error
        <CanvasInlineAlert variant="error" liveAlert={true}>
          {/* @ts-expect-error */}
          {jobErrors.hasOwnProperty('message')
            ? // @ts-expect-error
              I18n.t('Error saving assignment dates: ') + jobErrors.message
            : I18n.t('Invalid dates were found. Please correct them and try again.')}
        </CanvasInlineAlert>
      )
    }
  }

  function renderMoveDatesModal() {
    return (
      <MoveDatesModal
        open={moveDatesModalOpen}
        onShiftDays={handleBatchEditShift}
        onRemoveDates={handleBatchEditRemove}
        onCancel={() => handleOpenBatchEdit(false)}
      />
    )
  }

  function renderBody() {
    if (loading) {
      return (
        <>
          <CanvasInlineAlert liveAlert={true} screenReaderOnly={true} hasShadow={false}>
            {I18n.t('Loading assignments')}
          </CanvasInlineAlert>
          <LoadingIndicator />
        </>
      )
    }

    if (loadingError) return renderFetchError()

    return (
      <>
        <CanvasInlineAlert liveAlert={true} screenReaderOnly={true} hasShadow={false}>
          {I18n.t('Assignments loaded')}
        </CanvasInlineAlert>
        <BulkEditTable
          assignments={assignments}
          updateAssignmentDate={updateAssignmentDate}
          updatePeerReviewDate={updatePeerReviewDate}
          setAssignmentSelected={setAssignmentSelected}
          selectAllAssignments={selectAllAssignments}
          clearOverrideEdits={clearOverrideEdits}
          defaultDueTime={defaultDueTime}
          peerReviewAllocationAndGradingEnabled={peerReviewAllocationAndGradingEnabled}
        />
      </>
    )
  }
  return (
    <>
      {renderMoveDatesModal()}
      {renderSaveSuccess()}
      {renderSaveError()}
      {renderNoAssignmentsSelectedError()}
      {renderNoAssignmentsEditedError()}
      {renderHeader()}
      {renderDateSelect()}
      {renderBody()}
    </>
  )
}
