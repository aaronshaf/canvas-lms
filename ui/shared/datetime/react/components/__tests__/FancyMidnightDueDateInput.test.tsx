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

import React, {useState} from 'react'
import {render, fireEvent, waitFor} from '@testing-library/react'
import chicago from 'timezone/America/Chicago'
import tzInTest from '@instructure/moment-utils/specHelpers'
import {showFlashAlert} from '@instructure/platform-alerts'
import FancyMidnightDueDateInput, {normalizeDueDate} from '../FancyMidnightDueDateInput'

vi.mock('@instructure/platform-alerts', () => ({
  showFlashAlert: vi.fn(),
}))

describe('normalizeDueDate', () => {
  afterEach(() => {
    tzInTest.restore()
  })

  it('returns an empty string for a missing value', () => {
    expect(normalizeDueDate(undefined)).toEqual({value: '', displayTimeChanged: false})
    expect(normalizeDueDate('')).toEqual({value: '', displayTimeChanged: false})
  })

  it('converts an explicit midnight to the second before midnight (23:59:59)', () => {
    expect(normalizeDueDate('2024-01-15T00:00:00.000Z')).toEqual({
      value: '2024-01-15T23:59:59.000Z',
      displayTimeChanged: true,
    })
  })

  it('restores the final second on a :59-minute pick without changing the displayed time', () => {
    expect(normalizeDueDate('2024-01-15T23:59:00.000Z')).toEqual({
      value: '2024-01-15T23:59:59.000Z',
      displayTimeChanged: false,
    })
  })

  it('restores the final second for any :59-minute time, not only 23:59', () => {
    expect(normalizeDueDate('2024-01-15T13:59:00.000Z')).toEqual({
      value: '2024-01-15T13:59:59.000Z',
      displayTimeChanged: false,
    })
  })

  it('passes through a non-midnight, non-:59 time unchanged', () => {
    expect(normalizeDueDate('2024-01-15T14:30:00.000Z')).toEqual({
      value: '2024-01-15T14:30:00.000Z',
      displayTimeChanged: false,
    })
  })

  it('applies fancy midnight in the user timezone', () => {
    tzInTest.changeZone(chicago, 'America/Chicago')
    // Midnight CST (06:00 UTC) becomes 23:59:59 CST that day = 05:59:59 UTC the next day.
    expect(normalizeDueDate('2024-01-15T06:00:00.000Z')).toEqual({
      value: '2024-01-16T05:59:59.000Z',
      displayTimeChanged: true,
    })
  })
})

describe('FancyMidnightDueDateInput', () => {
  const ControlledHarness = ({
    initialValue,
    onChange,
  }: {
    initialValue: string
    onChange?: (isoValue?: string) => void
  }) => {
    const [value, setValue] = useState(initialValue)
    return (
      <FancyMidnightDueDateInput
        timezone="UTC"
        layout="columns"
        description="Due at"
        dateRenderLabel="Date"
        timeRenderLabel="Time"
        prevMonthLabel="Previous month"
        nextMonthLabel="Next month"
        invalidDateTimeMessage="Invalid date"
        value={value}
        onChange={(_event, isoValue) => {
          setValue(isoValue || '')
          onChange?.(isoValue)
        }}
      />
    )
  }

  beforeEach(() => {
    ;(showFlashAlert as ReturnType<typeof vi.fn>).mockClear()
  })

  it('snaps a midnight pick to 23:59:59, announces it, and shows 11:59 PM after blur', async () => {
    const onChange = vi.fn()
    const {getByLabelText, getByText} = render(
      <ControlledHarness initialValue="2024-01-15T08:00:00.000Z" onChange={onChange} />,
    )

    const timeInput = getByLabelText('Time')
    fireEvent.change(timeInput, {target: {value: '12:00 AM'}})
    fireEvent.click(getByText('12:00 AM'))

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('2024-01-15T23:59:59.000Z'))
    expect(showFlashAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        srOnly: true,
        politeness: 'polite',
        type: 'info',
        message: expect.stringContaining('11:59pm'),
      }),
    )

    // The display holds the raw 12:00 AM pick until focus leaves; the blur snaps it.
    fireEvent.blur(timeInput)
    await waitFor(() => expect(timeInput).toHaveValue('11:59 PM'))
  })

  it('does not announce when the chosen time needs no adjustment', async () => {
    const onChange = vi.fn()
    const {getByLabelText, getByText} = render(
      <ControlledHarness initialValue="2024-01-15T08:00:00.000Z" onChange={onChange} />,
    )

    const timeInput = getByLabelText('Time')
    fireEvent.change(timeInput, {target: {value: '9:30 AM'}})
    fireEvent.click(getByText('9:30 AM'))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('2024-01-15T09:30:00.000Z'))
    expect(showFlashAlert).not.toHaveBeenCalled()
  })

  it('emits the corrected value to the parent immediately, before the display snap', async () => {
    const onChange = vi.fn()
    const {getByLabelText, getByText} = render(
      <ControlledHarness initialValue="2024-01-15T08:00:00.000Z" onChange={onChange} />,
    )

    const timeInput = getByLabelText('Time')
    fireEvent.change(timeInput, {target: {value: '12:00 AM'}})
    fireEvent.click(getByText('12:00 AM'))

    // InstUI wraps its onChange in setTimeout(0). Wait for that single call.
    // The parent already holds 23:59:59, while the display still shows the raw
    // 12:00 AM pick (it only snaps to 11:59 PM on blur).
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange).toHaveBeenLastCalledWith('2024-01-15T23:59:59.000Z')
    expect(timeInput).toHaveValue('12:00 AM')
  })

  it('follows an external value change', async () => {
    const baseProps = {
      timezone: 'UTC',
      layout: 'columns' as const,
      description: 'Due at',
      dateRenderLabel: 'Date',
      timeRenderLabel: 'Time',
      prevMonthLabel: 'Previous month',
      nextMonthLabel: 'Next month',
      invalidDateTimeMessage: 'Invalid date',
      onChange: () => {},
    }
    const {getByLabelText, rerender} = render(
      <FancyMidnightDueDateInput {...baseProps} value="2024-01-15T08:00:00.000Z" />,
    )
    const timeInput = getByLabelText('Time')
    await waitFor(() => expect(timeInput).toHaveValue('8:00 AM'))

    rerender(<FancyMidnightDueDateInput {...baseProps} value="2024-01-15T14:30:00.000Z" />)
    await waitFor(() => expect(timeInput).toHaveValue('2:30 PM'))
  })

  it('re-snaps to 11:59 PM on a midnight re-pick when the parent already holds 23:59:59', async () => {
    const onChange = vi.fn()
    const {getByLabelText, getByText} = render(
      <ControlledHarness initialValue="2024-01-15T23:59:59.000Z" onChange={onChange} />,
    )

    const timeInput = getByLabelText('Time')
    await waitFor(() => expect(timeInput).toHaveValue('11:59 PM'))

    fireEvent.change(timeInput, {target: {value: '12:00 AM'}})
    fireEvent.click(getByText('12:00 AM'))

    // The display must hold the raw 12:00 AM pick so the blur snap is a real change;
    // setting it straight to the unchanged corrected value would leave it stuck here.
    await waitFor(() => expect(timeInput).toHaveValue('12:00 AM'))

    fireEvent.blur(timeInput)
    await waitFor(() => expect(timeInput).toHaveValue('11:59 PM'))
  })

  it('shows a normal time picked after midnight and never flips to 11:59 PM without a blur', async () => {
    const onChange = vi.fn()
    const {getByLabelText, getByText} = render(
      <ControlledHarness initialValue="2024-01-15T08:00:00.000Z" onChange={onChange} />,
    )

    const timeInput = getByLabelText('Time')
    fireEvent.change(timeInput, {target: {value: '12:00 AM'}})
    fireEvent.click(getByText('12:00 AM'))
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('2024-01-15T23:59:59.000Z'))

    fireEvent.change(timeInput, {target: {value: '2:30 PM'}})
    fireEvent.click(getByText('2:30 PM'))

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('2024-01-15T14:30:00.000Z'))
    expect(timeInput).toHaveValue('2:30 PM')
  })
})
