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

import React, {useState, useMemo, useCallback} from 'react'
import {View} from '@instructure/ui-view'
import {Flex} from '@instructure/ui-flex'
import {Text} from '@instructure/ui-text'
import {Avatar} from '@instructure/ui-avatar'
import {Img} from '@instructure/ui-img'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {Link} from '@instructure/ui-link'
import {useScope as createI18nScope} from '@canvas/i18n'
import type {MasteryBucket} from '@canvas/outcomes/react/hooks/useStudentMasteryScores'
import MessageStudentsWhoDialog from '@instructure/outcomes-ui/es/components/Gradebook/dialogs/MessageStudentsWhoDialog'
import type {
  Student as MSWStudent,
  SendMessageArgs,
} from '@instructure/outcomes-ui/lib/components/Gradebook/dialogs/MessageStudentsWhoDialog'
import MessageStudentsWhoHelper from '@canvas/grading/messageStudentsWhoHelper'
import {showFlashError, showFlashSuccess} from '@instructure/platform-alerts'

const I18n = createI18nScope('OutcomeManagement')

export interface StudentMasteryScoreSummaryProps {
  studentName: string
  studentId: string
  studentSortableName: string
  courseId: string
  studentAvatarUrl?: string
  masteryLevel?: {
    score: number
    text: string
    description?: string
    iconUrl: string
  }
  buckets?: {
    [key: string]: MasteryBucket
  }
}

const ResultIcon: React.FC<{url: string; alt: string; size?: string}> = ({
  url,
  alt,
  size = '100%',
}) => {
  return (
    <>
      <Img width={size} height={size} src={url} alt={alt} />
      <ScreenReaderContent>{alt}</ScreenReaderContent>
    </>
  )
}

export const StudentMasteryScoreSummary: React.FC<StudentMasteryScoreSummaryProps> = ({
  studentName,
  studentId,
  studentSortableName,
  courseId,
  studentAvatarUrl,
  masteryLevel,
  buckets,
}) => {
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false)

  const mswStudents = useMemo<MSWStudent[]>(
    () => [
      {
        id: studentId,
        name: studentName,
        sortableName: studentSortableName,
        submittedAt: null,
        workflowState: 'graded',
      },
    ],
    [studentId, studentName, studentSortableName],
  )

  const handleSendMessage = useCallback(
    ({recipientsIds, subject, body, mediaFile, attachmentIds}: SendMessageArgs) => {
      MessageStudentsWhoHelper.sendMessageStudentsWho(
        recipientsIds,
        subject,
        body,
        `course_${courseId}`,
        mediaFile,
        attachmentIds,
      )
        .then(() => showFlashSuccess(I18n.t('Message sent successfully'))())
        .catch(() => showFlashError(I18n.t('Failed to send message'))())
    },
    [courseId],
  )

  return (
    <View as="div" background="primary" data-testid="student-mastery-header" padding="xxx-small">
      {isMessageModalOpen && (
        <MessageStudentsWhoDialog
          onClose={() => setIsMessageModalOpen(false)}
          students={mswStudents}
          onSend={handleSendMessage}
          userId={ENV.current_user_id ?? ''}
        />
      )}
      <Flex justifyItems="space-between" alignItems="center">
        <Flex.Item shouldGrow>
          <Flex gap="small" alignItems="center">
            <Flex.Item>
              <Avatar
                alt={studentName}
                as="div"
                size="medium"
                name={studentName}
                src={studentAvatarUrl}
                data-testid="student-mastery-avatar"
              />
            </Flex.Item>
            <Flex.Item>
              <View>
                <Text size="x-large" lineHeight="fit">
                  {studentName}
                </Text>
                <View as="div">
                  <Link onClick={() => setIsMessageModalOpen(true)} isWithinText={false}>
                    <Text size="medium">{I18n.t('Message')}</Text>
                  </Link>
                </View>
              </View>
            </Flex.Item>
          </Flex>
        </Flex.Item>
        {masteryLevel && (
          <Flex.Item>
            <View
              shadow="resting"
              borderRadius="medium"
              display="inline-block"
              padding="small"
              data-testid="student-mastery-score"
            >
              <Flex direction="row" alignItems="center" gap="space2">
                <Flex.Item width="4rem">
                  <ResultIcon url={masteryLevel.iconUrl} alt={masteryLevel.text} size="48px" />
                </Flex.Item>
                <Flex.Item>
                  <Flex direction="column">
                    <Flex.Item>
                      <Flex direction="row" gap="xx-small">
                        <Flex.Item padding="0 0 0 space2">
                          <Text size="large" weight="bold" lineHeight="condensed">
                            {masteryLevel.score.toFixed(1)}
                          </Text>
                        </Flex.Item>
                        <Flex.Item>
                          <Text size="medium">{masteryLevel.text}</Text>
                        </Flex.Item>
                      </Flex>
                    </Flex.Item>
                    {buckets && (
                      <Flex.Item>
                        <Flex gap="space24">
                          {Object.values(buckets)
                            .reverse()
                            .map(bucket => (
                              <Flex
                                key={bucket.name}
                                direction="row"
                                alignItems="center"
                                gap="space4"
                              >
                                <ResultIcon url={bucket.iconURL} alt={bucket.name} />
                                <Text size="medium">{bucket.count}</Text>
                              </Flex>
                            ))}
                        </Flex>
                      </Flex.Item>
                    )}
                  </Flex>
                </Flex.Item>
              </Flex>
            </View>
          </Flex.Item>
        )}
      </Flex>
    </View>
  )
}
