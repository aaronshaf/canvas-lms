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

import normalizeLocale from '../normalizeLocale'

describe('normalizeLocale', () => {
  describe('defaults to English', () => {
    it('returns "en" when called with no argument', () => {
      expect(normalizeLocale()).toBe('en')
    })

    it('returns "en" for empty string', () => {
      expect(normalizeLocale('')).toBe('en')
    })

    it('returns "en" for an unrecognized locale with no recognizable base', () => {
      expect(normalizeLocale('xx')).toBe('en')
    })
  })

  describe('pass-through for recognized locales', () => {
    it('passes through "ar" unchanged', () => {
      expect(normalizeLocale('ar')).toBe('ar')
    })

    it('passes through "es" unchanged', () => {
      expect(normalizeLocale('es')).toBe('es')
    })

    it('passes through "pt-BR" unchanged', () => {
      expect(normalizeLocale('pt-BR')).toBe('pt-BR')
    })

    it('passes through "zh-Hans" unchanged', () => {
      expect(normalizeLocale('zh-Hans')).toBe('zh-Hans')
    })

    it('passes through "uk-UA" unchanged', () => {
      expect(normalizeLocale('uk-UA')).toBe('uk-UA')
    })

    it('passes through "fa-IR" unchanged', () => {
      expect(normalizeLocale('fa-IR')).toBe('fa-IR')
    })

    it('passes through a canvas custom locale like "da-x-k12" if recognized', () => {
      expect(normalizeLocale('da-x-k12')).toBe('da-x-k12')
    })
  })

  describe('old-style locale mapping', () => {
    it('maps "fa" to "fa-IR"', () => {
      expect(normalizeLocale('fa')).toBe('fa-IR')
    })

    it('maps "uk" to "uk-UA"', () => {
      expect(normalizeLocale('uk')).toBe('uk-UA')
    })

    it('maps "zh-CN" to "zh-Hans"', () => {
      expect(normalizeLocale('zh-CN')).toBe('zh-Hans')
    })
  })

  describe('custom locale reduction (-x- suffix)', () => {
    it('reduces an unrecognized -x- locale to its recognized base', () => {
      // 'de-x-custom' → strip to 'de' → recognized → 'de'
      expect(normalizeLocale('de-x-custom')).toBe('de')
    })

    it('reduces an unrecognized -x- locale with base that needs mapping', () => {
      // 'fa-x-variant' → strip to 'fa' → not recognized → mapping → 'fa-IR'
      expect(normalizeLocale('fa-x-variant')).toBe('fa-IR')
    })
  })

  describe('base locale fallback', () => {
    it('returns the base locale when the full locale is not recognized but base is', () => {
      // 'es-MX' is not in recognized list, but 'es' is → returns 'es'
      expect(normalizeLocale('es-MX')).toBe('es')
    })

    it('returns the base locale for an unknown regional variant', () => {
      // 'de-AT' is not in recognized list, but 'de' is → returns 'de'
      expect(normalizeLocale('de-AT')).toBe('de')
    })
  })
})
