/*
 * Copyright (C) 2025 - present Instructure, Inc.
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

import 'jest-canvas-mock'
import {vi} from 'vitest'
import {TextDecoder, TextEncoder} from 'util'

global.TextEncoder = TextEncoder as typeof global.TextEncoder
global.TextDecoder = TextDecoder as typeof global.TextDecoder

// polyfill fetch for msw
import 'isomorphic-fetch'

// BroadcastChannel polyfill for msw
if (!globalThis.BroadcastChannel) {
  // @ts-ignore
  globalThis.BroadcastChannel = class BroadcastChannel {
    constructor() {}
    postMessage() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
  }
}

// TransformStream polyfill for msw
if (!globalThis.TransformStream) {
  // @ts-ignore
  globalThis.TransformStream = class TransformStream {
    constructor() {
      // @ts-ignore
      this.readable = {}
      // @ts-ignore
      this.writable = {}
    }
  }
}

if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

if (!('createRange' in document)) {
  Object.getPrototypeOf(document).createRange = () => ({
    commonAncestorContainer: window.document?.body,
    collapsed: true,
  })
}

Object.defineProperty(window.URL, 'createObjectURL', {
  writable: true,
  configurable: true,
  value: () => 'http://example.com/whatever',
})

global.DataTransferItem = global.DataTransferItem || class DataTransferItem {}

window.scroll = () => {}

if (!('MutationObserver' in window)) {
  Object.defineProperty(window, 'MutationObserver', {
    value: require('@sheerun/mutationobserver-shim'),
  })
}

if (!('ResizeObserver' in window)) {
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: class ResizeObserver {
      observe() {
        return null
      }
      unobserve() {
        return null
      }
      disconnect() {
        return null
      }
    },
  })
}

// because InstUI themeable components need an explicit "dir" attribute on the <html> element
document.documentElement.setAttribute('dir', 'ltr')

// Stub slow/infinite InstUI utilities (mirrors jest/stubInstUi.js)
vi.mock('@instructure/ui-dom-utils/es/addPositionChangeListener', () => ({
  addPositionChangeListener: () => ({remove: () => {}}),
}))
vi.mock('@instructure/ui-dom-utils/es/getCSSStyleDeclaration', () => ({
  getCSSStyleDeclaration: () => ({getPropertyValue: () => undefined}),
}))
