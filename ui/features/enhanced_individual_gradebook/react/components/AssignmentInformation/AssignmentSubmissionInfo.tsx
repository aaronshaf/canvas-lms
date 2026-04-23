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
import {intersection, some} from 'es-toolkit/compat'
import {useScope as createI18nScope} from '@canvas/i18n'
import {View} from '@instructure/ui-view'
import type {AssignmentConnection} from '../../../types'
import SubmissionDownloadModal from './SubmissionDownloadModal'

const I18n = createI18nScope('enhanced_individual_gradebook')

const SUBMISSION_TYPE_LABELS: Record<string, string> = {
  discussion_topic: I18n.t('Discussion topic'),
  online_quiz: I18n.t('Online quiz'),
  on_paper: I18n.t('On paper'),
  none: I18n.t('None'),
  external_tool: I18n.t('External tool'),
  online_text_entry: I18n.t('Online text entry'),
  online_url: I18n.t('Online URL'),
  online_upload: I18n.t('Online upload'),
  media_recording: I18n.t('Media recording'),
  student_annotation: I18n.t('Student annotation'),
  peer_review: I18n.t('Peer review'),
}

const SUBMISSION_TYPES_WITH_DOWNLOADS = ['online_upload', 'online_text_entry', 'online_url']

type Props = {
  assignment: AssignmentConnection
  gradedSubmissionsCount: number
  downloadSubmissionsUrl: string
}

export function AssignmentSubmissionInfo({
  assignment,
  gradedSubmissionsCount,
  downloadSubmissionsUrl,
}: Props) {
  const {submissionTypes, hasSubmittedSubmissions} = assignment

  const readableSubmissionTypes = submissionTypes?.map(t => SUBMISSION_TYPE_LABELS[t]).join(', ')

  const showDownloadButton =
    hasSubmittedSubmissions && some(intersection(submissionTypes, SUBMISSION_TYPES_WITH_DOWNLOADS))

  return (
    <>
      {showDownloadButton && (
        <View as="div" margin="small 0 0 0">
          <SubmissionDownloadModal downloadSubmissionsUrl={downloadSubmissionsUrl} />
        </View>
      )}
      <View as="div" className="pad-box no-sides" data-testid="assignment-submission-info">
        <View as="p">
          <View as="strong">
            {I18n.t('Submission types:')} {readableSubmissionTypes}
          </View>
        </View>
        <View as="p">
          <View as="strong">
            {I18n.t('Graded submissions:')} {gradedSubmissionsCount}
          </View>
        </View>
      </View>
    </>
  )
}
