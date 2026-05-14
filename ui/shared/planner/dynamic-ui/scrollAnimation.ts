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

// Easing functions mapped from CSS timing-function names.
// t is a normalized time value in [0, 1].
const EASING: Record<string, (t: number) => number> = {
  linear: (t: number) => t,
  ease: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  'ease-in': (t: number) => t * t,
  'ease-out': (t: number) => t * (2 - t),
  // Cosine approximation of cubic-bezier(0.42, 0, 0.58, 1)
  'ease-in-out': (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t),
}

export interface ScrollAnimationOptions {
  // Pixel offset added to the target scroll position.
  // Negative values move the element down from the viewport top.
  offset?: number
  // Animation duration in milliseconds. 0 = instant.
  duration?: number
  // CSS timing-function name: linear | ease | ease-in | ease-out | ease-in-out
  easing?: string
  // Called when the animation finishes (or immediately when duration is 0).
  complete?: () => void
}

/**
 * Smooth-scroll the window so the top of `el` aligns with the viewport top,
 * adjusted by `offset` pixels. Call signature matches the Velocity.js scroll
 * effect so it can be injected into Animator in place of the library:
 *
 *   scrollAnimation(el, 'scroll', { offset, duration, easing, complete })
 */
export function scrollAnimation(
  el: Element,
  _effect: 'scroll',
  options: ScrollAnimationOptions = {},
): void {
  const {offset = 0, duration = 400, easing = 'ease-in-out', complete} = options
  const easingFn = EASING[easing] ?? EASING['ease-in-out']

  const startScrollY = window.pageYOffset
  // Element's position in the document (viewport-relative top + current scroll)
  const elementDocTop = el.getBoundingClientRect().top + window.pageYOffset
  const targetScrollY = elementDocTop + offset

  if (duration <= 0) {
    window.scrollTo(0, targetScrollY)
    complete?.()
    return
  }

  const startTime = performance.now()

  const tick = (now: number): void => {
    const elapsed = now - startTime
    const rawProgress = Math.min(elapsed / duration, 1)
    const easedProgress = easingFn(rawProgress)
    window.scrollTo(0, startScrollY + (targetScrollY - startScrollY) * easedProgress)

    if (rawProgress < 1) {
      requestAnimationFrame(tick)
    } else {
      complete?.()
    }
  }

  requestAnimationFrame(tick)
}
