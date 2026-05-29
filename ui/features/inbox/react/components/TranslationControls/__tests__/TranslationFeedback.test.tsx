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
import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {setupServer} from 'msw/node'
import {http, HttpResponse} from 'msw'
import TranslationFeedback from '../TranslationFeedback'
import {TranslationContext, TranslationContextValue} from '../../../hooks/useTranslationContext'

const server = setupServer()

beforeAll(() => server.listen({onUnhandledRequest: 'error'}))
beforeEach(() => {
  ;(ENV as {inbox_translation_feedback?: boolean}).inbox_translation_feedback = true
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const renderWithContext = (overrides: Partial<TranslationContextValue> = {}) =>
  render(
    <TranslationContext.Provider
      value={
        {
          translationTargetLanguage: 'es',
          translationCompleted: true,
          translationNonce: 1,
          ...overrides,
        } as TranslationContextValue
      }
    >
      <TranslationFeedback />
    </TranslationContext.Provider>,
  )

describe('TranslationFeedback', () => {
  it('renders the prompt with like and dislike buttons', () => {
    renderWithContext()
    expect(screen.getByText('Was this translation helpful?')).toBeInTheDocument()
    expect(screen.getByTestId('inbox-translation-like-button')).toBeInTheDocument()
    expect(screen.getByTestId('inbox-translation-dislike-button')).toBeInTheDocument()
  })

  it('renders nothing without a target language', () => {
    const {container} = renderWithContext({translationTargetLanguage: null})
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing before a translation has completed', () => {
    const {container} = renderWithContext({translationCompleted: false})
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the feedback flag is off', () => {
    ;(ENV as {inbox_translation_feedback?: boolean}).inbox_translation_feedback = false
    const {container} = renderWithContext()
    expect(container).toBeEmptyDOMElement()
  })

  it('records a like and shows the thank-you message', async () => {
    let received: any = null
    server.use(
      http.post('/translate/inbox/feedback', async ({request}) => {
        received = await request.json()
        return HttpResponse.json({id: 7, liked: true, disliked: false})
      }),
    )

    renderWithContext()
    await userEvent.click(screen.getByTestId('inbox-translation-like-button'))

    await waitFor(() => expect(screen.getByText('Thank you for sharing!')).toBeInTheDocument())
    expect(received).toMatchObject({_action: 'like', target_language: 'es'})
  })

  it('reveals the explanation input on dislike and submits notes', async () => {
    const bodies: any[] = []
    server.use(
      http.post('/translate/inbox/feedback', async ({request}) => {
        const body = await request.json()
        bodies.push(body)
        return HttpResponse.json({id: 9, liked: false, disliked: true})
      }),
    )

    renderWithContext()
    await userEvent.click(screen.getByTestId('inbox-translation-dislike-button'))

    const input = await screen.findByTestId('inbox-translation-feedback-input')
    await userEvent.type(input, 'Wrong language')
    await userEvent.click(screen.getByTestId('inbox-translation-feedback-submit'))

    await waitFor(() => expect(bodies).toHaveLength(2))
    expect(bodies[0]).toMatchObject({_action: 'dislike', target_language: 'es'})
    expect(bodies[1]).toMatchObject({_action: 'dislike', notes: 'Wrong language', id: 9})
  })

  it('toggles a like off with reset_like', async () => {
    const actions: string[] = []
    server.use(
      http.post('/translate/inbox/feedback', async ({request}) => {
        const body: any = await request.json()
        actions.push(body._action)
        const liked = body._action === 'like'
        return HttpResponse.json({id: 3, liked, disliked: false})
      }),
    )

    renderWithContext()
    const likeButton = screen.getByTestId('inbox-translation-like-button')
    await userEvent.click(likeButton)
    await waitFor(() => expect(screen.getByText('Thank you for sharing!')).toBeInTheDocument())
    await userEvent.click(likeButton)

    await waitFor(() => expect(actions).toEqual(['like', 'reset_like']))
  })
})
