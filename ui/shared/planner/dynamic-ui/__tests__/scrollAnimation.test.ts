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

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {scrollAnimation} from '../scrollAnimation'

// Build a fake element with a known getBoundingClientRect().top
const makeEl = (viewportTop: number): Element =>
  ({getBoundingClientRect: () => ({top: viewportTop})}) as unknown as Element

// Simulate one full rAF-driven animation by draining the rAF queue
// with a specified final timestamp (startTime + duration).
const drainRAF = (startTime: number, duration: number) => {
  // First tick: t = 0 (no progress yet, just schedules next)
  vi.mocked(requestAnimationFrame).mock.calls[0]?.[0]?.(startTime)
  // Final tick: t = 1 (progress = 1, calls complete)
  const rafQueue = vi.mocked(requestAnimationFrame).mock.calls
  rafQueue[rafQueue.length - 1]?.[0]?.(startTime + duration)
}

describe('scrollAnimation', () => {
  let scrollToSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(performance, 'now').mockReturnValue(1000)

    scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    // pageYOffset = 200 throughout each test (element is partway down page)
    Object.defineProperty(window, 'pageYOffset', {value: 200, writable: true, configurable: true})

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      // Store but do not auto-call — tests drive the queue manually
      return 0
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('instant scroll (duration ≤ 0)', () => {
    it('jumps to elementDocTop + offset immediately', () => {
      // viewportTop=300, pageYOffset=200 → elementDocTop=500
      // offset=-50 → targetScrollY=450
      scrollAnimation(makeEl(300), 'scroll', {offset: -50, duration: 0})

      expect(scrollToSpy).toHaveBeenCalledOnce()
      expect(scrollToSpy).toHaveBeenCalledWith(0, 450)
    })

    it('calls complete callback', () => {
      const complete = vi.fn()
      scrollAnimation(makeEl(0), 'scroll', {duration: 0, complete})
      expect(complete).toHaveBeenCalledOnce()
    })

    it('works without a complete callback', () => {
      expect(() => scrollAnimation(makeEl(0), 'scroll', {duration: 0})).not.toThrow()
    })

    it('applies zero offset by default', () => {
      // viewportTop=100, pageYOffset=200 → elementDocTop=300 → target=300
      scrollAnimation(makeEl(100), 'scroll', {duration: 0})
      expect(scrollToSpy).toHaveBeenCalledWith(0, 300)
    })
  })

  describe('animated scroll', () => {
    it('starts a rAF loop', () => {
      scrollAnimation(makeEl(300), 'scroll', {offset: 0, duration: 500})
      expect(requestAnimationFrame).toHaveBeenCalledOnce()
    })

    it('scrolls to the correct final position after full duration', () => {
      const START = 1000
      vi.mocked(performance.now).mockReturnValue(START)

      scrollAnimation(makeEl(300), 'scroll', {offset: -50, duration: 500})

      // Drain: first rAF fires at t=0, final at t=duration (full progress)
      const firstCb = vi.mocked(requestAnimationFrame).mock.calls[0][0]
      firstCb(START) // t=0 → schedules next frame
      const lastCb =
        vi.mocked(requestAnimationFrame).mock.calls[
          vi.mocked(requestAnimationFrame).mock.calls.length - 1
        ][0]
      lastCb(START + 500) // t=1 → final position

      // elementDocTop = 300 + 200 = 500; target = 500 - 50 = 450
      const lastCall = scrollToSpy.mock.calls[scrollToSpy.mock.calls.length - 1]
      expect(lastCall).toEqual([0, 450])
    })

    it('calls complete after the animation finishes', () => {
      const complete = vi.fn()
      const START = 1000
      vi.mocked(performance.now).mockReturnValue(START)

      scrollAnimation(makeEl(0), 'scroll', {duration: 200, complete})

      const firstCb = vi.mocked(requestAnimationFrame).mock.calls[0][0]
      firstCb(START)
      const finalCb =
        vi.mocked(requestAnimationFrame).mock.calls[
          vi.mocked(requestAnimationFrame).mock.calls.length - 1
        ][0]
      finalCb(START + 200)

      expect(complete).toHaveBeenCalledOnce()
    })

    it('does not call complete before the animation finishes', () => {
      const complete = vi.fn()
      const START = 1000
      vi.mocked(performance.now).mockReturnValue(START)

      scrollAnimation(makeEl(0), 'scroll', {duration: 1000, complete})

      // Fire only a partial tick (50% through)
      vi.mocked(requestAnimationFrame).mock.calls[0][0](START + 500)

      expect(complete).not.toHaveBeenCalled()
    })

    it('interpolates scroll position mid-animation', () => {
      const START = 1000
      vi.mocked(performance.now).mockReturnValue(START)

      // startScrollY=200, target=700 (viewportTop=500, pageYOffset=200, offset=0)
      scrollAnimation(makeEl(500), 'scroll', {offset: 0, duration: 1000, easing: 'linear'})

      // At t=0.5 with linear easing, scrollY should be midpoint: 200 + (700-200)*0.5 = 450
      vi.mocked(requestAnimationFrame).mock.calls[0][0](START + 500)

      const [, y] = scrollToSpy.mock.calls[0] as [number, number]
      expect(y).toBeCloseTo(450, 0)
    })
  })

  describe('easing', () => {
    it('accepts ease-in-out (default)', () => {
      expect(() =>
        scrollAnimation(makeEl(0), 'scroll', {duration: 0, easing: 'ease-in-out'}),
      ).not.toThrow()
    })

    it('accepts linear easing', () => {
      expect(() =>
        scrollAnimation(makeEl(0), 'scroll', {duration: 0, easing: 'linear'}),
      ).not.toThrow()
    })

    it('falls back to ease-in-out for unknown easing names', () => {
      // Should not throw for an unrecognized easing — just uses the default
      expect(() =>
        scrollAnimation(makeEl(0), 'scroll', {duration: 0, easing: 'bounce-crazy'}),
      ).not.toThrow()
    })

    it('ease-in-out produces symmetric progress at t=0.5', () => {
      // cos(PI * 0.5) = 0, so eased(0.5) = 0.5 — the midpoint is exactly 50%
      const START = 1000
      vi.mocked(performance.now).mockReturnValue(START)

      // startScrollY=0, elementDocTop=200+1000=1200 (viewportTop=1000, offset=0)
      Object.defineProperty(window, 'pageYOffset', {value: 200, writable: true, configurable: true})
      scrollAnimation(makeEl(1000), 'scroll', {offset: 0, duration: 1000, easing: 'ease-in-out'})

      vi.mocked(requestAnimationFrame).mock.calls[0][0](START + 500) // t=0.5

      const [, y] = scrollToSpy.mock.calls[0] as [number, number]
      // startScrollY=200, targetScrollY=1200; at t=0.5 → 200 + 1000*0.5 = 700
      expect(y).toBeCloseTo(700, 1)
    })
  })

  describe('default options', () => {
    it('uses duration=400 when not specified (starts rAF loop)', () => {
      scrollAnimation(makeEl(0), 'scroll')
      expect(requestAnimationFrame).toHaveBeenCalled()
    })

    it('uses offset=0 when not specified', () => {
      // viewportTop=0, pageYOffset=200 → target=200
      scrollAnimation(makeEl(0), 'scroll', {duration: 0})
      expect(scrollToSpy).toHaveBeenCalledWith(0, 200)
    })
  })
})
