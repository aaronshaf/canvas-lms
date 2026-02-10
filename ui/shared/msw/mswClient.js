/*
 * Copyright (C) 2021 - present Instructure, Inc.
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

import {ApolloClient, HttpLink} from '@apollo/client'
import {createCache} from '@canvas/apollo-v3'

const cache = createCache()

const link = new HttpLink({
  uri: 'http://localhost:3000/graphql',

  // Use explicit `window.fetch` so that outgoing requests
  // are captured and deferred until the Service Worker is ready.
  fetch: (input, init) => {
    const isNodeWithDom =
      typeof process !== 'undefined' &&
      typeof process.versions?.node === 'string' &&
      typeof window !== 'undefined' &&
      typeof document !== 'undefined'

    // In Node + jsdom test environments, AbortSignal implementations can be incompatible with
    // undici's fetch. Dropping `signal` here keeps Apollo queries stable while preserving the
    // normal browser behavior in production.
    if (isNodeWithDom && init?.signal) {
      const {signal, ...rest} = init
      return fetch(input, rest)
    }

    return fetch(input, init)
  },
})

// Isolate Apollo client so it could be reused
// in both application runtime and tests.
export const mswClient = new ApolloClient({
  cache,
  link,
})
