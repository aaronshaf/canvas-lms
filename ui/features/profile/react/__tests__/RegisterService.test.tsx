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

import React from 'react'
import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {setupServer} from 'msw/node'
import {http, HttpResponse} from 'msw'
import RegisterService, {serviceConfigByName, USERNAME_MAX_LENGTH} from '../RegisterService'

const server = setupServer()

describe('RegisterService', () => {
  const onClose = vi.fn()
  const onSubmit = vi.fn()
  const mockUrl = 'mock-url'
  const USER_SERVICE_URI = '/profile/user_services'

  beforeAll(() => {
    window.ENV.google_drive_oauth_url = mockUrl
    server.listen()
  })

  afterAll(() => {
    ;(window as any).ENV = {}
    server.close()
  })

  afterEach(() => {
    server.resetHandlers()
  })

  describe('when the service is Google Drive', () => {
    const serviceName = 'google_drive'
    const config = serviceConfigByName[serviceName]

    it('should render correctly', () => {
      render(<RegisterService serviceName={serviceName} onSubmit={onSubmit} onClose={onClose} />)
      const title = screen.getByText(config.title)
      const description = screen.getByText(config.description)
      const logo = screen.getByAltText(config.image.alt)
      const button = screen.getByLabelText('Authorize Google Drive Access')

      expect(title).toBeInTheDocument()
      expect(description).toBeInTheDocument()
      expect(logo).toBeInTheDocument()
      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute('href', mockUrl)
    })
  })
})
