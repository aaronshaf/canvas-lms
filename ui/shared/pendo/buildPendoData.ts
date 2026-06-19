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

import {Visitor} from '@pendo/web-sdk'
import {GlobalEnv} from '@canvas/global/env/GlobalEnv'
import {getPrimaryRole} from './utils'
import {IGNITE_AI_FLAGS} from './constants'

type PendoAccountData = {
  id: string
  surveyOptOut: boolean
  oemAccountId?: string | null
}

export function buildVisitorData(env: GlobalEnv): Visitor {
  const visitorData: Visitor = {
    id: env.current_user_usage_metrics_id,
    canvasRoles: env.current_user_roles,
    locale: env.LOCALE || 'en',
  }

  const igniteAiFlags = IGNITE_AI_FLAGS.filter(f => env.FEATURES?.[f])
  if (igniteAiFlags.length) {
    Object.assign(visitorData, {igniteAiFlags})
  }

  if (env.FEATURES?.pendo_extended && env.USAGE_METRICS_METADATA) {
    const md = env.USAGE_METRICS_METADATA

    const instanceVars = {
      sfId: env.DOMAIN_ROOT_ACCOUNT_SFID,
      canvasInstanceDomain: md.instance_domain,
    }

    const accountVars = {
      canvasSubAccountId: md.sub_account_id,
      canvasSubAccountName: md.sub_account_name,
      canvasSubAccountSisId: md.sub_account_sis_id,
    }

    const userVars = {
      canvasPrimaryUserRole: getPrimaryRole(env.current_user_roles),
      canvasUserId: md.user_id,
      canvasUserUuid: md.user_uuid,
      canvasUserSisId: md.user_sis_id,
      canvasUserDisplayName: md.user_display_name,
      canvasUserEmail: md.user_email,
      canvasUserTimeZone: md.user_time_zone,
    }

    const courseVars = {
      canvasCourseId: md.course_id,
      canvasCourseLongName: md.course_long_name,
      canvasCourseStatus: md.course_status,
      canvasCourseIsBlueprint: md.course_is_blueprint,
      canvasCourseIsK5: md.course_is_k5,
      canvasCourseHasNoStudents: md.course_has_no_students,
      canvasCourseSisSourceId: md.course_sis_source_id,
      canvasCourseSisBatchId: md.course_sis_batch_id,
      canvasCourseEnrollmentTermId: md.course_enrollment_term_id,
      canvasCourseEnrollmentTermName: md.course_enrollment_term_name,
      canvasCourseEnrollmentTermSisId: md.course_enrollment_term_sis_id,
      canvasCourseEnrollmentTermStartAt: md.course_enrollment_term_start_at,
      canvasCourseEnrollmentTermEndAt: md.course_enrollment_term_end_at,
    }

    Object.assign(visitorData, instanceVars, accountVars, userVars, courseVars)
  }

  return visitorData
}

export function buildAccountData(env: GlobalEnv): PendoAccountData {
  const accountData: PendoAccountData = {
    id: env.DOMAIN_ROOT_ACCOUNT_UUID,
    surveyOptOut: !env.FEATURES['account_survey_notifications'],
  }
  if (env.USAGE_METRICS_METADATA?.oem_account_id) {
    accountData.oemAccountId = env.USAGE_METRICS_METADATA.oem_account_id
  }
  return accountData
}
