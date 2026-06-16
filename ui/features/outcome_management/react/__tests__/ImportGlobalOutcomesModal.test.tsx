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
import {render, screen, fireEvent, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import ImportGlobalOutcomesModal from '../ImportGlobalOutcomesModal'

const AVAILABLE_PATH = '/api/v1/global/outcomes_import/available'
const CREATE_PATH = '/api/v1/global/outcomes_import'
const STATUS_PATH = '/api/v1/global/outcomes_import/migration_status/:migrationId'

const AVAILABLE_OUTCOMES = [
  {guid: 'AAAA-GUID', title: 'Common Core'},
  {guid: 'BBBB-GUID', title: 'Next Gen Science'},
]

const server = setupServer()

const renderModal = (props = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {queries: {retry: false}},
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ImportGlobalOutcomesModal isOpen={true} onCloseHandler={() => {}} {...props} />
    </QueryClientProvider>,
  )
}

// Loads the available outcomes, opens the select and picks the first group so
// the Start button becomes enabled.
const selectFirstGroup = async () => {
  fireEvent.click(await screen.findByLabelText('Global Outcome Group'))
  fireEvent.click(await screen.findByText('Common Core'))
}

describe('ImportGlobalOutcomesModal', () => {
  beforeAll(() => server.listen())
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  describe('loading the available global outcomes', () => {
    it('renders the available groups in the select', async () => {
      server.use(http.get(AVAILABLE_PATH, () => HttpResponse.json(AVAILABLE_OUTCOMES)))

      renderModal()

      fireEvent.click(await screen.findByLabelText('Global Outcome Group'))
      expect(await screen.findByText('Common Core')).toBeInTheDocument()
      expect(screen.getByText('Next Gen Science')).toBeInTheDocument()
    })

    it('renders an error message when the request fails', async () => {
      server.use(http.get(AVAILABLE_PATH, () => new HttpResponse('boom', {status: 500})))

      renderModal()

      expect(
        await screen.findByText(
          'There was an error loading the available global outcomes. Please try again.',
        ),
      ).toBeInTheDocument()
    })

    it('renders the error when the response is an error object instead of a list', async () => {
      server.use(
        http.get(AVAILABLE_PATH, () =>
          HttpResponse.json({error: 'Global outcomes are not configured'}),
        ),
      )

      renderModal()

      expect(await screen.findByText('Global outcomes are not configured')).toBeInTheDocument()
      expect(screen.queryByLabelText('Global Outcome Group')).not.toBeInTheDocument()
    })

    it('renders a generic error when the error object has no message', async () => {
      server.use(http.get(AVAILABLE_PATH, () => HttpResponse.json({})))

      renderModal()

      expect(
        await screen.findByText(
          'There was an error loading the available global outcomes. Please try again.',
        ),
      ).toBeInTheDocument()
    })
  })

  describe('starting the import', () => {
    it('does not submit while no group is selected', async () => {
      let createCalled = 0
      server.use(
        http.get(AVAILABLE_PATH, () => HttpResponse.json(AVAILABLE_OUTCOMES)),
        http.post(CREATE_PATH, () => {
          createCalled += 1
          return HttpResponse.json({migration_id: 1, guid: 'AAAA-GUID'})
        }),
      )

      renderModal()
      // Wait for the select to load so we are past the loading spinner.
      await screen.findByLabelText('Global Outcome Group')

      fireEvent.click(screen.getByTestId('start-button'))

      expect(createCalled).toBe(0)
    })

    it('posts the selected guid and shows progress while the import runs', async () => {
      let createBody: unknown
      server.use(
        http.get(AVAILABLE_PATH, () => HttpResponse.json(AVAILABLE_OUTCOMES)),
        http.post(CREATE_PATH, async ({request}) => {
          createBody = await request.json()
          return HttpResponse.json({migration_id: 7, guid: 'AAAA-GUID'})
        }),
        http.get(STATUS_PATH, () =>
          HttpResponse.json({id: '7', workflow_state: 'running', audit_info: {progress: 50}}),
        ),
      )

      renderModal()
      await selectFirstGroup()
      fireEvent.click(screen.getByTestId('start-button'))

      expect(await screen.findByText(/Importing outcomes\./)).toBeInTheDocument()
      // The progress bar reflects the migration's reported completion.
      expect((await screen.findAllByText('50%')).length).toBeGreaterThan(0)
      await waitFor(() => expect(createBody).toEqual({guid: 'AAAA-GUID'}))
    })

    it('shows a success message when the migration completes', async () => {
      server.use(
        http.get(AVAILABLE_PATH, () => HttpResponse.json(AVAILABLE_OUTCOMES)),
        http.post(CREATE_PATH, () => HttpResponse.json({migration_id: 7, guid: 'AAAA-GUID'})),
        http.get(STATUS_PATH, () => HttpResponse.json({id: '7', workflow_state: 'completed'})),
      )

      renderModal()
      await selectFirstGroup()
      fireEvent.click(screen.getByTestId('start-button'))

      expect(
        await screen.findByText('The outcomes were imported successfully.'),
      ).toBeInTheDocument()
      // The Start action is removed once the import has finished.
      expect(screen.queryByTestId('start-button')).not.toBeInTheDocument()
    })

    it('shows an error message when the migration fails', async () => {
      server.use(
        http.get(AVAILABLE_PATH, () => HttpResponse.json(AVAILABLE_OUTCOMES)),
        http.post(CREATE_PATH, () => HttpResponse.json({migration_id: 7, guid: 'AAAA-GUID'})),
        http.get(STATUS_PATH, () => HttpResponse.json({id: '7', workflow_state: 'failed'})),
      )

      renderModal()
      await selectFirstGroup()
      fireEvent.click(screen.getByTestId('start-button'))

      expect(await screen.findByText('The import failed. Please try again.')).toBeInTheDocument()
    })

    it('surfaces the error when the import fails to queue', async () => {
      server.use(
        http.get(AVAILABLE_PATH, () => HttpResponse.json(AVAILABLE_OUTCOMES)),
        http.post(CREATE_PATH, () => HttpResponse.json({error: 'Import failed to queue: nope'})),
      )

      renderModal()
      await selectFirstGroup()
      fireEvent.click(screen.getByTestId('start-button'))

      expect(await screen.findByText('Import failed to queue: nope')).toBeInTheDocument()
      // Still showing the select so the user can retry.
      expect(screen.getByLabelText('Global Outcome Group')).toBeInTheDocument()
    })
  })
})
