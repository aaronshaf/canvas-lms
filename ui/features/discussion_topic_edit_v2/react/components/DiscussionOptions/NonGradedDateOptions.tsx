/*
 * Copyright (C) 2024 - present Instructure, Inc.
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

import React, {useEffect, useState} from 'react'
import {useTranslation} from '@canvas/i18next'

import {FormFieldGroup, type FormMessageType} from '@instructure/ui-form-field'
import {DateTimeInput} from '@instructure/ui-date-time-input'

import {validateAvailability} from '../../util/formValidation'
import {Button} from '@instructure/ui-buttons'
import {Flex} from '@instructure/ui-flex'
import {Alert} from '@instructure/ui-alerts'
import {View} from '@instructure/ui-view'
import {InstUISettingsProvider} from '@instructure/emotion'

type Props = {
  availableFrom: string
  setAvailableFrom: (value: string | null) => void
  availableUntil: string
  setAvailableUntil: (value: string | null) => void
  isAnnouncement: boolean
  isGraded: boolean
  availabilityValidationMessages: {text: string; type: FormMessageType}[]
  setAvailabilityValidationMessages: (value: {text: string; type: string}[]) => void
  inputWidth: string
  setDateInputRef: (el: HTMLInputElement | null) => void
}

export const NonGradedDateOptions = ({
  availableFrom,
  setAvailableFrom,
  availableUntil,
  setAvailableUntil,
  isAnnouncement,
  isGraded,
  setAvailabilityValidationMessages,
  availabilityValidationMessages,
  inputWidth,
  setDateInputRef,
}: Props) => {
  const {t} = useTranslation('discussion_create')
  const [availableFromDateRef, setAvailableFromDateRef] = useState<HTMLInputElement | null>(null)
  const [availableFromTimeRef, setAvailableFromTimeRef] = useState<HTMLInputElement | null>(null)
  const [availableUntilDateRef, setAvailableUntilDateRef] = useState<HTMLInputElement | null>(null)
  const [availableUntilTimeRef, setAvailableUntilTimeRef] = useState<HTMLInputElement | null>(null)

  const testIdPrefix = isAnnouncement ? 'announcement' : 'group-discussion'

  useEffect(() => {
    availableFromDateRef?.setAttribute('data-testid', `${testIdPrefix}-available-from-date`)
    availableFromTimeRef?.setAttribute('data-testid', `${testIdPrefix}-available-from-time`)
    availableUntilDateRef?.setAttribute('data-testid', `${testIdPrefix}-available-until-date`)
    availableUntilTimeRef?.setAttribute('data-testid', `${testIdPrefix}-available-until-time`)
  })

  const defaultEndTime = () => {
    if (isAnnouncement) {
      return '23:59'
    }
  }

  return (
    <FormFieldGroup description="" width={inputWidth}>
      <Flex gap="medium" alignItems="start">
        <Flex.Item shouldGrow={true}>
          <DateTimeInput
            timezone={ENV.TIMEZONE}
            description={t('Available from')}
            dateRenderLabel={t('Date')}
            timeRenderLabel={t('Time')}
            prevMonthLabel={t('previous')}
            nextMonthLabel={t('next')}
            value={availableFrom}
            onChange={(_event, newAvailableFrom = '') => {
              const value = newAvailableFrom === '' ? null : newAvailableFrom
              validateAvailability(
                value,
                availableUntil,
                isGraded,
                setAvailabilityValidationMessages,
              )
              setAvailableFrom(value)
            }}
            datePlaceholder={t('Select Date')}
            invalidDateTimeMessage={t('Invalid date and time')}
            layout="columns"
            allowNonStepInput={true}
            dateInputRef={ref => {
              setAvailableFromDateRef(ref)
              setDateInputRef(ref)
            }}
            timeInputRef={ref => {
              setAvailableFromTimeRef(ref)
            }}
          />
        </Flex.Item>
        <Flex.Item>
          <InstUISettingsProvider
            theme={{
              componentOverrides: {
                View: {marginLarge: '62.5px'},
              },
            }}
          >
            <View as="div" margin="large 0 0 0">
              <Button
                type="button"
                color="secondary"
                onClick={() => {
                  setAvailableFrom(null)
                }}
                aria-label={t('Reset available from')}
                data-testid="reset-available-from-button"
              >
                {t('Reset')}
              </Button>
            </View>
          </InstUISettingsProvider>
        </Flex.Item>
      </Flex>
      {isAnnouncement && availableFrom && !ENV.DISCUSSION_TOPIC?.ATTRIBUTES.course_published && (
        <View as="div" minWidth="296px" maxWidth="815px">
          <Alert
            variant="info"
            data-testid="schedule-info-alert"
            variantScreenReaderLabel="Information, "
          >
            {t(
              'Notifications will only be sent to students who have been enrolled. Please allow time for this process to finish after publishing your course before scheduling this announcement.',
            )}
          </Alert>
        </View>
      )}
      <Flex gap="medium" alignItems="start">
        <Flex.Item shouldGrow={true}>
          <DateTimeInput
            timezone={ENV.TIMEZONE}
            description={t('Until')}
            dateRenderLabel={t('Date')}
            timeRenderLabel={t('Time')}
            prevMonthLabel={t('previous')}
            nextMonthLabel={t('next')}
            value={availableUntil}
            onChange={(_event, newAvailableUntil = '') => {
              const value = newAvailableUntil === '' ? null : newAvailableUntil
              validateAvailability(
                availableFrom,
                value,
                isGraded,
                setAvailabilityValidationMessages,
              )
              setAvailableUntil(value)
            }}
            datePlaceholder={t('Select Date')}
            invalidDateTimeMessage={t('Invalid date and time')}
            messages={availabilityValidationMessages}
            layout="columns"
            allowNonStepInput={true}
            dateInputRef={ref => {
              setAvailableUntilDateRef(ref)
              setDateInputRef(ref)
            }}
            timeInputRef={ref => {
              setAvailableUntilTimeRef(ref)
            }}
            initialTimeForNewDate={defaultEndTime()}
          />
        </Flex.Item>
        <Flex.Item>
          <InstUISettingsProvider
            theme={{
              componentOverrides: {
                View: {marginLarge: '62.5px'},
              },
            }}
          >
            <View as="div" margin="large 0 0 0">
              <Button
                type="button"
                color="secondary"
                onClick={() => {
                  setAvailableUntil(null)
                }}
                aria-label={t('Reset available until')}
                data-testid="reset-available-until-button"
              >
                {t('Reset')}
              </Button>
            </View>
          </InstUISettingsProvider>
        </Flex.Item>
      </Flex>
    </FormFieldGroup>
  )
}
