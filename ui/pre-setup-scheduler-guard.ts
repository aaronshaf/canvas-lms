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

// NO IMPORTS — this file must execute before any React/scheduler module loads.
//
// React's scheduler captures setImmediate at module-load time:
//   const localSetImmediate = typeof setImmediate === 'function' ? setImmediate : undefined
// If this guard ran in setup-vitests.tsx, the import hoisting would load React/scheduler
// first, giving the scheduler the original unguarded setImmediate. By placing this patch
// in a separate setupFile that is listed first, the scheduler captures the guarded version.
//
// Without this, a pending React render can fire after jsdom tears down the environment,
// crashing with "ReferenceError: window is not defined" in getActiveElementDeep.

const _origSetImmediate = (globalThis as any).setImmediate
if (typeof _origSetImmediate === 'function') {
  ;(globalThis as any).setImmediate = (cb: (...args: unknown[]) => void, ...args: unknown[]) =>
    _origSetImmediate(() => {
      if (typeof (globalThis as any).document !== 'undefined') cb(...args)
    })
}

// Guard MessageChannel too. Not currently active: in Node.js/jsdom the scheduler
// always takes the setImmediate path above. Activates only in environments where
// setImmediate is unavailable (e.g. browser, or future React scheduler changes).
const _origMC = (globalThis as any).MessageChannel
if (typeof _origMC === 'function') {
  class GuardedMessageChannel extends _origMC {
    constructor() {
      super()
      let _handler: ((ev: MessageEvent) => void) | null = null
      Object.defineProperty(this.port1, 'onmessage', {
        get() {
          return _handler
        },
        set(fn: ((ev: MessageEvent) => void) | null) {
          _handler =
            fn === null
              ? null
              : (ev: MessageEvent) => {
                  if (typeof (globalThis as any).document !== 'undefined') fn(ev)
                }
        },
        configurable: true,
      })
    }
  }
  ;(globalThis as any).MessageChannel = GuardedMessageChannel
}
