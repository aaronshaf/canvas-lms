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
import {render, screen} from '@testing-library/react'
import UsageRightsSelectBox from '../UsageRightsSelectBox'

function makeState(overrides = {}) {
  return {
    usageRight: 'choose',
    ccLicense: '',
    copyrightHolder: '',
    ...overrides,
  }
}

function renderBox(stateOverrides = {}, propOverrides = {}) {
  const setUsageRightsState = vi.fn()
  const props = {
    contextType: 'course',
    contextId: '1',
    showMessage: false,
    usageRightsState: makeState(stateOverrides),
    setUsageRightsState,
    ...propOverrides,
  }
  render(<UsageRightsSelectBox {...props} />)
  return {setUsageRightsState}
}

beforeEach(() => {
  // suppress the fetch call made in useEffect — errors are swallowed by the component
  vi.spyOn(global, 'fetch').mockResolvedValue({
    text: () => Promise.resolve('[]'),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('UsageRightsSelectBox', () => {
  it('renders the Usage Right select label', () => {
    renderBox()
    expect(screen.getByText('Usage Right:')).toBeInTheDocument()
  })

  it('renders CONTENT_OPTIONS inside the component (regression: b2d60bcc0517)', () => {
    // Before fix: CONTENT_OPTIONS was defined at module scope, so formatMessage ran
    // before the locale was loaded — options were untranslated in non-English locales.
    // After fix: CONTENT_OPTIONS is defined inside the component function, so
    // formatMessage runs with the current locale on every render.
    // SimpleSelect renders the selected option as an input value/title attribute.
    renderBox()
    expect(screen.getByDisplayValue('Choose usage rights...')).toBeInTheDocument()
  })

  it('renders the Copyright Holder text input', () => {
    renderBox()
    expect(screen.getByText('Copyright Holder:')).toBeInTheDocument()
  })

  it('does not show the unpublish warning when showMessage is false', () => {
    renderBox({usageRight: 'choose'}, {showMessage: false})
    expect(screen.queryByText(/will be unpublished/)).not.toBeInTheDocument()
  })

  it('shows the unpublish warning when showMessage=true and usageRight is choose', () => {
    renderBox({usageRight: 'choose'}, {showMessage: true})
    expect(
      screen.getByText(/this file will be unpublished after it's uploaded/),
    ).toBeInTheDocument()
  })
})
