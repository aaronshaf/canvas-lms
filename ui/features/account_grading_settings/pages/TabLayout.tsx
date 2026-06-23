/*
 * Copyright (C) 2023 - present Instructure, Inc.
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
import {Outlet, useNavigate, useMatch} from 'react-router-dom'
import {Tabs} from '@instructure/ui-tabs'
import {useTranslation} from '@canvas/i18next'
import {Portal} from '@instructure/ui-portal'
import {TabLayoutPanel} from '../types/tabLayout'

export const Component = () => {
  const {t} = useTranslation('gradingCourseTabContainer')
  const navigate = useNavigate()
  const isCustomGradebookStatusesEnabled = !!ENV.CUSTOM_GRADEBOOK_STATUSES_ENABLED

  const pathMatch = useMatch({
    path: '/accounts/:accountId/grading_settings/:tabPath',
    end: false,
  })
  const selectedTab = pathMatch?.params?.tabPath
  const accountId = pathMatch?.params?.accountId

  const mountPoint: HTMLElement | null = document.querySelector('#content')
  if (!mountPoint) {
    return null
  }

  const handleTabChange = (index: number) => {
    if (!accountId) return

    switch (index) {
      case TabLayoutPanel.GRADING_PERIODS:
        navigate(`/accounts/${accountId}/grading_settings/periods`)
        break
      case TabLayoutPanel.GRADING_SCHEMES:
        navigate(`/accounts/${accountId}/grading_settings/schemes`)
        break
      case TabLayoutPanel.GRADING_STATUSES:
        navigate(`/accounts/${accountId}/grading_settings/statuses`)
        break
    }
  }
  if (!selectedTab) {
    // Outlet is required in order for react router to load the '/' path.
    // This oddness is due to inst-ui's approach to tabs, which requires
    // conditional inclusion of <Outlet> on only the active Tab.Panel.
    return <Outlet />
  }
  return (
    <Portal open={true} mountNode={mountPoint}>
      <h1>{t('Account Grading Settings')}</h1>
      <Tabs
        margin="large auto"
        padding="medium"
        onRequestTabChange={(_event: any, {index}: {index: number}) => handleTabChange(index)}
      >
        <Tabs.Panel
          id="gradingPeriodTab"
          renderTitle={t('Grading Periods')}
          isSelected={selectedTab === 'periods'}
        >
          {selectedTab === 'periods' ? <Outlet /> : null}
        </Tabs.Panel>
        <Tabs.Panel
          id="gradingSchemeTab"
          renderTitle={t('Grading Schemes')}
          isSelected={selectedTab === 'schemes'}
        >
          {selectedTab === 'schemes' ? <Outlet /> : null}
        </Tabs.Panel>
        {isCustomGradebookStatusesEnabled && (
          <Tabs.Panel
            id="gradingStatusTab"
            renderTitle={t('Statuses')}
            isSelected={selectedTab === 'statuses'}
          >
            {selectedTab === 'statuses' ? <Outlet /> : null}
          </Tabs.Panel>
        )}
      </Tabs>
    </Portal>
  )
}
