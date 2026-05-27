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

import {PendoConfig} from '@pendo/agent'
import {GlobalEnv} from '@canvas/global/env/GlobalEnv'
import {buildAccountData, buildVisitorData} from './buildPendoData'

declare global {
  interface Window {
    CANVAS_COOKIE_CONSENT_STATE: boolean | null
    CANVAS_DEBUGTAP: any
  }
}
declare const ENV: GlobalEnv

const oneTrustPerformanceCookieClass: string = 'C0002'
const isDevEnv: boolean = ENV && ENV.RAILS_ENVIRONMENT === 'development'

let libraryInitialized: boolean = false
let whenPendoReady: Promise<any> | null = null
let pendoInitializing: boolean = false
let pendoInitParams: PendoConfig | null = null
let thePendo: any = null
let debuglog: (msg: string) => void

function initializeLib(): void {
  if (!libraryInitialized) {
    libraryInitialized = true

    if (isDevEnv) {
      debuglog = (message: string) => {
        console.log(message)
      }
      if (!window.CANVAS_DEBUGTAP) {
        window.CANVAS_DEBUGTAP = {}
      }
      window.CANVAS_DEBUGTAP.testPendoConsentChange = (state: boolean) => {
        const event = new CustomEvent('OneTrustGroupsUpdated', {
          detail: state ? [oneTrustPerformanceCookieClass] : [],
        })
        window.dispatchEvent(event)
      }
    } else {
      debuglog = (_message: string) => {}
    }

    window.addEventListener('OneTrustGroupsUpdated', (e: any) => {
      if (e.detail.includes(oneTrustPerformanceCookieClass)) {
        window.CANVAS_COOKIE_CONSENT_STATE = true
        debuglog('User consented to cookies via OneTrust.')
        if (!pendoInitializing && !thePendo) {
          debuglog('Initializing Pendo for the first time.')
          initializePendo()
        } else if (!pendoInitializing && thePendo && !thePendo.isReady()) {
          debuglog('Restarting Pendo.')
          thePendo.initialize(pendoInitParams)
          whenPendoReady = Promise.resolve(thePendo)
        }
      } else {
        window.CANVAS_COOKIE_CONSENT_STATE = false
        debuglog('User revoked cookie consent via OneTrust.')
        if (pendoInitializing && whenPendoReady) {
          debuglog('Pendo is still initializing, will teardown once ready.')
          whenPendoReady.then(() => {
            debuglog('Pendo finished initializing, now tearing down due to revoked consent.')
            thePendo?.teardown()
            whenPendoReady = Promise.resolve(null)
          })
        } else if (thePendo && thePendo.isReady()) {
          debuglog('Tearing down Pendo immediately due to revoked consent.')
          thePendo.teardown()
          whenPendoReady = Promise.resolve(null)
        }
      }
    })
  }
}

export async function initializePendo() {
  initializeLib()

  if (window.CANVAS_COOKIE_CONSENT_STATE !== true) {
    debuglog('User has not consented to cookies. Pendo will not be initialized.')
    return Promise.resolve(null)
  }

  if (!whenPendoReady) {
    pendoInitializing = true
    const result = init()

    if (!result) {
      pendoInitializing = false
      console.info('Pendo not initialized: PENDO_APP_ID missing')
      whenPendoReady = Promise.resolve(null)
      return whenPendoReady
    }

    whenPendoReady = result
      .then((pendoo: any) => {
        thePendo = pendoo
        if (isDevEnv) {
          window.CANVAS_DEBUGTAP.pendoInstance = pendoo
        }
        pendoInitializing = false
        debuglog('Pendo initialized successfully.')
        return pendoo
      })
      .catch(error => {
        pendoInitializing = false
        console.error('Pendo initialization failed:', error)
      })
  }
  return whenPendoReady
}

function init(): Promise<any> | null {
  if (!ENV.PENDO_APP_ID) return null

  // Lazy-load Pendo only when needed (e.g., in browser)
  return import('@pendo/agent').then(({initialize, Replay, VocPortal}) => {
    pendoInitParams = {
      apiKey: ENV.PENDO_APP_ID,
      env: ENV.PENDO_APP_ENV,
      visitor: buildVisitorData(ENV),
      account: buildAccountData(ENV),
      globalKey: 'canvasUsageMetrics',
      plugins: [Replay, VocPortal],
    }

    return initialize(pendoInitParams)
  })
}

export {whenPendoReady}
export {usePathTransform} from './react/hooks/usePathTransform'
