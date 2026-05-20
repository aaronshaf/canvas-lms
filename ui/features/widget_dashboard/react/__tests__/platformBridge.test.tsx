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
import {TranslationsProvider, useTranslations} from '@instructure/platform-widget-dashboard'
import {translate, translations} from '../platformBridge'

const Probe = ({tKey, opts}: {tKey: string; opts?: Record<string, unknown>}) => {
  const {translate: t} = useTranslations()
  return <span data-testid="out">{t(tKey, opts)}</span>
}

const renderInProvider = (node: React.ReactNode) =>
  render(
    <TranslationsProvider
      translations={translations}
      translate={translate}
      announceForScreenReader={() => {}}
    >
      {node}
    </TranslationsProvider>,
  )

describe('platformBridge translation', () => {
  describe('translations Proxy (static lookups)', () => {
    it('returns the translated string for a known camelCase key', () => {
      expect(translations.loading).toBe('Loading')
    })

    it('returns the raw key for an unknown lookup so missing thunks surface as visible identifiers', () => {
      // Cast through unknown to bypass the index signature for this deliberate miss
      expect((translations as unknown as Record<string, string>).thisKeyDoesNotExist).toBe(
        'thisKeyDoesNotExist',
      )
    })
  })

  describe('translate() with named thunks', () => {
    it('calls the registered thunk for a camelCase key', () => {
      expect(translate('loading')).toBe('Loading')
    })

    it('interpolates options through I18n.t for an interpolated camelCase thunk', () => {
      expect(translate('sentBy', {authorName: 'Alice'})).toBe('Sent by Alice')
    })
  })

  describe('translate() with literal-string keys', () => {
    it('routes "%{points} pts" through I18n.t and interpolates the value', () => {
      expect(translate('%{points} pts', {points: 25})).toBe('25 pts')
    })

    it('routes "%{date} %{time}" through I18n.t and interpolates both placeholders', () => {
      expect(translate('%{date} %{time}', {date: '6/4/2026', time: '3:05 PM'})).toBe(
        '6/4/2026 3:05 PM',
      )
    })

    it('renders the non-interpolated literal "Excused" via its registered thunk', () => {
      expect(translate('Excused')).toBe('Excused')
    })

    it('uses I18n.t plural forms for "Due in %{count} hours"', () => {
      expect(translate('Due in %{count} hours', {count: 1})).toBe('Due in 1 hour')
      expect(translate('Due in %{count} hours', {count: 3})).toBe('Due in 3 hours')
    })
  })

  describe('translate() regex fallback for unregistered keys', () => {
    it('interpolates %{var} when opts are provided', () => {
      expect(translate('Unregistered %{name} string', {name: 'Bob'})).toBe(
        'Unregistered Bob string',
      )
    })

    it('returns the raw key when opts is omitted', () => {
      expect(translate('Unregistered raw string')).toBe('Unregistered raw string')
    })

    it('drops placeholders with no matching option to empty string', () => {
      expect(translate('Hello %{missing}!', {other: 'x'})).toBe('Hello !')
    })

    it('renders nullish option values as empty string', () => {
      expect(translate('Hello %{name}!', {name: null})).toBe('Hello !')
      expect(translate('Hello %{name}!', {name: undefined})).toBe('Hello !')
    })

    it('renders non-primitive option values as empty string', () => {
      expect(translate('Hello %{name}!', {name: {foo: 'bar'}})).toBe('Hello !')
      expect(translate('Hello %{name}!', {name: () => 'x'})).toBe('Hello !')
    })
  })

  describe('TranslationsProvider smoke test', () => {
    it('exposes translations + translate to consumers through the package context', () => {
      renderInProvider(<Probe tKey="%{points} pts" opts={{points: 42}} />)
      expect(screen.getByTestId('out')).toHaveTextContent('42 pts')
    })
  })
})
