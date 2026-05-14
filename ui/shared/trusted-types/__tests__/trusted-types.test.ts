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

interface CapturedPolicy {
  createHTML: (input: string, sink?: string) => string
  createScript: (input: string, sink?: string) => string
  createScriptURL: (input: string) => string
}

const installTrustedTypesStub = (): {
  createPolicy: ReturnType<typeof vi.fn>
} => {
  const createPolicy = vi.fn()
  ;(window as unknown as {trustedTypes: {createPolicy: typeof createPolicy}}).trustedTypes = {
    createPolicy,
  }
  return {createPolicy}
}

const removeTrustedTypesStub = () => {
  delete (window as unknown as {trustedTypes?: unknown}).trustedTypes
}

const importPolicyModule = async (): Promise<void> => {
  await import('../index')
}

const captureRegisteredPolicy = async (): Promise<CapturedPolicy> => {
  const {createPolicy} = installTrustedTypesStub()
  await importPolicyModule()
  expect(createPolicy).toHaveBeenCalledOnce()
  const [name, policy] = createPolicy.mock.calls[0]
  expect(name).toBe('default')
  return policy as CapturedPolicy
}

describe('@canvas/trusted-types default policy', () => {
  let debugSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    removeTrustedTypesStub()
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  afterEach(() => {
    debugSpy.mockRestore()
    vi.unstubAllEnvs()
  })

  it('is a no-op when window.trustedTypes is undefined', async () => {
    removeTrustedTypesStub()
    await expect(importPolicyModule()).resolves.toBeUndefined()
    expect(debugSpy).not.toHaveBeenCalled()
  })

  it('registers a default policy when createPolicy exists', async () => {
    const policy = await captureRegisteredPolicy()
    expect(typeof policy.createHTML).toBe('function')
    expect(typeof policy.createScript).toBe('function')
    expect(typeof policy.createScriptURL).toBe('function')
  })

  describe('createHTML', () => {
    it('returns input unchanged (Phase 1 pass-through)', async () => {
      const policy = await captureRegisteredPolicy()
      const dirty = '<img src=x onerror="alert(1)">'

      expect(policy.createHTML(dirty)).toBe(dirty)
    })

    it('console.debugs in non-production with sink + sample + length', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const policy = await captureRegisteredPolicy()

      policy.createHTML('<p>hello world</p>', 'Element innerHTML')

      expect(debugSpy).toHaveBeenCalledOnce()
      expect(debugSpy).toHaveBeenCalledWith(
        '[trusted-types] default.createHTML (Element innerHTML)',
        {sample: '<p>hello world</p>', length: 18},
      )
    })

    it('does not console.debug for empty strings (noise guard)', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const policy = await captureRegisteredPolicy()

      expect(policy.createHTML('')).toBe('')
      expect(debugSpy).not.toHaveBeenCalled()
    })

    it('does not console.debug in production', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const policy = await captureRegisteredPolicy()

      expect(policy.createHTML('<p>hello</p>')).toBe('<p>hello</p>')
      expect(debugSpy).not.toHaveBeenCalled()
    })

    it('truncates the sample to 80 characters but reports full length', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const policy = await captureRegisteredPolicy()

      policy.createHTML('a'.repeat(200))

      expect(debugSpy).toHaveBeenCalledOnce()
      const payload = debugSpy.mock.calls[0][1] as {sample: string; length: number}
      expect(payload.sample).toHaveLength(80)
      expect(payload.length).toBe(200)
    })

    it('dedupes repeated calls from the same site (logs once per page-load)', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const policy = await captureRegisteredPolicy()

      for (let i = 0; i < 5; i++) {
        policy.createHTML(`iter-${i}`)
      }

      expect(debugSpy).toHaveBeenCalledOnce()
    })

    it('logs separately for distinct call sites', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const policy = await captureRegisteredPolicy()

      const callFromA = () => policy.createHTML('A')
      const callFromB = () => policy.createHTML('B')
      callFromA()
      callFromB()

      expect(debugSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('createScript', () => {
    it('returns input unchanged (Phase 1 pass-through)', async () => {
      const policy = await captureRegisteredPolicy()
      const code = 'window.foo = 1'

      expect(policy.createScript(code)).toBe(code)
    })

    it('does not console.debug in any environment (script logging disabled until later phase)', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const policy = await captureRegisteredPolicy()

      policy.createScript('window.foo = 1', 'HTMLScriptElement text')

      expect(debugSpy).not.toHaveBeenCalled()
    })
  })

  it('createScriptURL passes input through unchanged in Phase 1', async () => {
    const policy = await captureRegisteredPolicy()
    const url = 'https://example.com/script.js'
    expect(policy.createScriptURL(url)).toBe(url)
  })
})
