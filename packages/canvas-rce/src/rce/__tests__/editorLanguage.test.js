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

import {editorLanguage} from '../editorLanguage'

describe('editorLanguage', () => {
  it('returns undefined for no locale (English default)', () => {
    expect(editorLanguage()).toBeUndefined()
  })

  it('returns undefined for explicit "en"', () => {
    expect(editorLanguage('en')).toBeUndefined()
  })

  it('maps locale with underscore separator (e.g. en_GB -> en-GB -> en_GB)', () => {
    // Canvas sends underscores; TinyMCE keys use hyphens internally then map to TinyMCE format
    expect(editorLanguage('en_GB')).toBe('en_GB')
  })

  it('maps pt_BR correctly via underscore normalization', () => {
    expect(editorLanguage('pt_BR')).toBe('pt_BR')
  })

  it('strips custom -x- variant and uses base locale for mapping (regression: custom locale handling)', () => {
    // e.g. en-x-australia -> en -> undefined (English)
    expect(editorLanguage('en-x-australia')).toBeUndefined()
  })

  it('strips custom -x- variant and falls back to a mapped base locale', () => {
    // e.g. es-x-custom -> es -> 'es'
    expect(editorLanguage('es-x-custom')).toBe('es')
  })

  it('maps direct locale keys correctly', () => {
    expect(editorLanguage('ar')).toBe('ar_SA')
    expect(editorLanguage('de')).toBe('de')
    expect(editorLanguage('fr')).toBe('fr_FR')
    expect(editorLanguage('ja')).toBe('ja')
    expect(editorLanguage('ru')).toBe('ru')
    expect(editorLanguage('zh')).toBe('zh_CN')
  })

  it('maps hyphenated region locales correctly', () => {
    expect(editorLanguage('en-AU')).toBe('en_GB') // tinymce has no en-AU
    expect(editorLanguage('en-GB')).toBe('en_GB')
    expect(editorLanguage('fr-CA')).toBe('fr_FR')
    expect(editorLanguage('pt-BR')).toBe('pt_BR')
    expect(editorLanguage('zh-HK')).toBe('zh_TW')
    expect(editorLanguage('zh-Hans')).toBe('zh_CN')
    expect(editorLanguage('zh-Hant')).toBe('zh_TW')
  })

  it('falls back to base language when region variant is not in mapping (regression: base-language fallback)', () => {
    // 'es-MX' is not in the mapping, but 'es' is
    expect(editorLanguage('es-MX')).toBe('es')
  })

  it('returns undefined for locales tinymce does not support (mi, ht, is, ms, sq)', () => {
    expect(editorLanguage('mi')).toBeUndefined() // Maori — explicitly uses English
    expect(editorLanguage('ht')).toBeUndefined() // Haitian Creole — no tiny support
    expect(editorLanguage('is')).toBeUndefined() // Icelandic — no tiny support
    expect(editorLanguage('sq')).toBeUndefined() // Albanian — no tiny support
  })

  it('maps Irish (Gaeilge) ga correctly (regression: FOO-4233)', () => {
    // commit 8e546549c89: Add support for the Irish (Gaeilge) Language
    expect(editorLanguage('ga')).toBe('ga')
  })

  it('maps Bahasa Indonesia id correctly (regression: FOO-4235)', () => {
    // commit 1c7cc133d85: Add support for Bahasa Indonesia Language
    expect(editorLanguage('id')).toBe('id')
  })

  it('maps Malay ms to undefined (tinymce has no Malay support)', () => {
    // commit bc00d2c04fc: Add support for Malay Language — explicitly undefined
    expect(editorLanguage('ms')).toBeUndefined()
  })

  it('maps Norwegian Nynorsk nn to Norwegian Bokmal nb_NO', () => {
    expect(editorLanguage('nn')).toBe('nb_NO')
  })

  it('maps Ukrainian uk and uk-UA to uk_UA', () => {
    expect(editorLanguage('uk')).toBe('uk_UA')
    expect(editorLanguage('uk-UA')).toBe('uk_UA')
  })

  it('returns undefined for a completely unknown locale with no base-language fallback', () => {
    expect(editorLanguage('xx')).toBeUndefined()
  })
})
