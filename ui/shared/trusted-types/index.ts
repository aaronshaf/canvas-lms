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

// Trusted Types `default` policy registration. Side-effect-only module.
//
// Phase 1 is a discovery slice: console.warn each policy invocation in
// non-production so unwrapped sinks surface in local dev. The warn
// branch is dead-code-eliminated in production by webpack/rspack
// DefinePlugin, so end users see zero runtime cost or log noise. The
// per-sink sanitizeHTML wrappers in the rest of the codebase remain the
// real XSS defense; this policy intentionally does not sanitize (see
// createHTML below).
//
// Import as early as possible from the frontend boot entry, *after* the
// jQuery patch but *before* any application code runs. The policy must
// be registered before any module-level code performs an innerHTML
// write, otherwise that write hits the browser before the policy
// exists.

const SAMPLE_MAX_LENGTH = 80

interface TrustedTypePolicyOptions {
  createHTML?: (input: string, sink?: string) => string
  createScript?: (input: string, sink?: string) => string
  createScriptURL?: (input: string, sink?: string) => string
}

interface TrustedTypePolicyFactory {
  createPolicy: (name: string, policy: TrustedTypePolicyOptions) => unknown
}

declare global {
  interface Window {
    trustedTypes?: TrustedTypePolicyFactory
  }
}

// Feature-detect: jsdom and older Safari (<18.x) lack window.trustedTypes.
// In those environments this module is a no-op and the existing per-sink
// sanitizeHTML wrappers remain the defense.
if (typeof window !== 'undefined' && window.trustedTypes?.createPolicy) {
  window.trustedTypes.createPolicy('default', {
    createHTML: (input: string, sink?: string): string => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[trusted-types] default.createHTML${sink ? ` (${sink})` : ''}`, {
          sample: input.slice(0, SAMPLE_MAX_LENGTH),
          length: input.length,
        })
      }
      // Phase 1 pass-through: per-sink sanitizeHTML wrappers stay the
      // real defense. Sanitizing here would silently mutate production
      // output for sites not yet wrapped, hiding the very offenders we
      // want this rollout to surface. Phase 2 swaps in sanitization
      // alongside CSP enforcement.
      return input
    },
    // Permissive in Phase 1; the strict-CSP follow-up tightens this when
    // `script-src` enforcement lands.
    createScriptURL: (input: string): string => input,
    // Pass-through with non-prod warn. jQuery's DOMEval (used internally
    // by globalEval, dataType:'script' AJAX, and `<script>` tags inside
    // .html()/.append() content) hits this sink via `script.text = code`.
    // Throwing here would generate console noise on legitimate jQuery use
    // and pre-commit Phase 4 to a stance we haven't decided yet (a named
    // policy carve-out for jQuery may be the right answer). Phase 1's
    // job is discovery, not enforcement.
    createScript: (input: string, sink?: string): string => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[trusted-types] default.createScript${sink ? ` (${sink})` : ''}`, {
          sample: input.slice(0, SAMPLE_MAX_LENGTH),
          length: input.length,
        })
      }
      return input
    },
  })
}

// Force this file to be treated as a module so `declare global` above is
// applied. Without an import or export, TypeScript treats the file as a
// script and the global augmentation errors with TS2669.
export {}
