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

import React from 'react'
import {render, screen, act, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {get} from 'es-toolkit/compat'

import AdditionalSettings from '../AdditionalSettings'

const props = ({overrides = {}, additionalSettingsOverrides = {}, settingsOverrides = {}}) => {
  return {
    additionalSettings: {
      domain: 'www.example.com',
      tool_id: 'asdf',
      settings: {
        icon_url: 'http://example.com/icon',
        text: 'Text',
        selection_height: 10,
        selection_width: 10,
        ...settingsOverrides,
      },
      ...additionalSettingsOverrides,
    },
    custom_fields: {},
    ...overrides,
  }
}

it('generates the toolConfiguration', () => {
  const ref = React.createRef()
  render(<AdditionalSettings {...props({overrides: {ref}})} />)
  const toolConfig = ref.current.generateToolConfigurationPart()
  expect(toolConfig.extensions).toHaveLength(1)
  const ext = toolConfig.extensions[0]
  expect(ext.domain).toEqual('www.example.com')
  expect(Object.keys(ext.settings)).toHaveLength(4)
})

const checkToolConfigPart = (toolConfig, path, value) => {
  expect(get(toolConfig, path)).toEqual(value)
}

const checkChange = async (path, funcName, in_value, out_value) => {
  out_value = out_value || in_value
  const ref = React.createRef()
  render(<AdditionalSettings {...props({overrides: {ref}})} />)

  act(() => {
    ref.current[funcName]({target: {value: in_value}})
  })
  await waitFor(() => {
    checkToolConfigPart(ref.current.generateToolConfigurationPart(), path, out_value)
  })
}

it('is valid when valid', () => {
  const ref = React.createRef()
  render(<AdditionalSettings {...props({overrides: {ref}})} />)
  expect(ref.current.valid()).toBe(true)
})

it('is invalid with invalid inputs', async () => {
  const ref = React.createRef()
  render(
    <AdditionalSettings
      {...props({
        additionalSettingsOverrides: {settings: {icon_url: 'not_a_url'}},
        overrides: {ref, showMessages: true},
      })}
    />,
  )
  await userEvent.click(screen.getByText('Additional Settings').closest('button'))
  await screen.findByText('Icon Url')
  let isValid
  act(() => {
    isValid = ref.current.valid()
  })
  expect(isValid).toBe(false)
  await waitFor(() => {
    expect(
      screen.getByText('Please enter a valid URL (e.g. https://example.com)'),
    ).toBeInTheDocument()
  })
})

it('changes the output when domain changes', async () => {
  await checkChange(['extensions', '0', 'domain'], 'handleDomainChange', 'new.example.com')
})

it('changes the output when tool_id changes', async () => {
  await checkChange(['extensions', '0', 'tool_id'], 'handleToolIdChange', 'qwerty')
})

it('changes the output when icon_url changes', async () => {
  await checkChange(
    ['extensions', '0', 'settings', 'icon_url'],
    'handleIconUrlChange',
    'http://example.com/new_icon',
  )
})

it('changes the output when text changes', async () => {
  await checkChange(['extensions', '0', 'settings', 'text'], 'handleTextChange', 'New Text')
})

it('changes the output when selection_height changes', async () => {
  await checkChange(
    ['extensions', '0', 'settings', 'selection_height'],
    'handleSelectionHeightChange',
    250,
  )
})

it('changes the output when selection_width changes', async () => {
  await checkChange(
    ['extensions', '0', 'settings', 'selection_width'],
    'handleSelectionWidthChange',
    250,
  )
})

it('changes the output when custom_fields changes', async () => {
  await checkChange(['custom_fields'], 'handleCustomFieldsChange', 'foo=bar', {foo: 'bar'})
})

it('changes the output when domain is cleared', async () => {
  await checkChange(['extensions', '0', 'domain'], 'handleDomainChange', '')
})
