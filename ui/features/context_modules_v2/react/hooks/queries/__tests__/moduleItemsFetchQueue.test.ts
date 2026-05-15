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

import {setupServer} from 'msw/node'
import {graphql, HttpResponse} from 'msw'
import {getModuleItems, moduleItemsFetchQueue} from '../useModuleItems'
import {MODULE_ITEMS_FETCH_CONCURRENCY} from '../../../utils/constants'

type Deferred = {promise: Promise<void>; resolve: () => void}

const deferred = (): Deferred => {
  let resolve!: () => void
  const promise = new Promise<void>(res => {
    resolve = res
  })
  return {promise, resolve}
}

const successPayload = {
  legacyNode: {
    moduleItemsConnection: {
      edges: [{node: {id: 'item_1'}}],
      pageInfo: {hasNextPage: false, endCursor: null},
    },
  },
}

const server = setupServer()

describe('moduleItemsFetchQueue', () => {
  beforeAll(() => server.listen())
  afterEach(() => {
    server.resetHandlers()
    moduleItemsFetchQueue.clear()
  })
  afterAll(() => server.close())

  it('propagates GraphQL errors from a queued task to the caller', async () => {
    server.use(
      graphql.query('GetModuleItemsQuery', () =>
        HttpResponse.json({errors: [{message: 'kaboom'}]}),
      ),
    )

    await expect(getModuleItems('mod-err', null, 'teacher')).rejects.toThrow('kaboom')
  })

  it(`caps in-flight getModuleItems calls at MODULE_ITEMS_FETCH_CONCURRENCY (${MODULE_ITEMS_FETCH_CONCURRENCY})`, async () => {
    const pending: Deferred[] = []
    let inflight = 0
    let maxInFlight = 0

    // Decrement on 'completed'/'error' rather than 'next' — p-queue fires
    // 'next' AFTER the next admission's 'active', which would overcount.
    const onActive = () => {
      inflight++
      if (inflight > maxInFlight) maxInFlight = inflight
    }
    const onDone = () => {
      inflight--
    }
    moduleItemsFetchQueue.on('active', onActive)
    moduleItemsFetchQueue.on('completed', onDone)
    moduleItemsFetchQueue.on('error', onDone)

    try {
      server.use(
        graphql.query('GetModuleItemsQuery', async () => {
          const d = deferred()
          pending.push(d)
          await d.promise
          return HttpResponse.json({data: {...successPayload}})
        }),
      )

      const totalCalls = MODULE_ITEMS_FETCH_CONCURRENCY * 3
      const calls = Array.from({length: totalCalls}, (_, i) =>
        getModuleItems(`mod-${i}`, null, 'teacher'),
      )

      // Wait until the first wave is admitted: queue.size has dropped to (totalCalls - cap).
      await moduleItemsFetchQueue.onSizeLessThan(totalCalls - MODULE_ITEMS_FETCH_CONCURRENCY + 1)

      expect(inflight).toBe(MODULE_ITEMS_FETCH_CONCURRENCY)
      expect(maxInFlight).toBe(MODULE_ITEMS_FETCH_CONCURRENCY)

      // Drain: release pending MSW deferreds each tick until the queue reports idle.
      const idleSentinel = Symbol('idle')
      // eslint-disable-next-line no-constant-condition
      while (true) {
        pending.splice(0).forEach(d => d.resolve())
        // eslint-disable-next-line no-await-in-loop
        const winner = await Promise.race([
          moduleItemsFetchQueue.onIdle().then(() => idleSentinel),
          new Promise(resolve => setTimeout(resolve, 0)),
        ])
        if (winner === idleSentinel) break
      }
      await Promise.all(calls)

      expect(maxInFlight).toBe(MODULE_ITEMS_FETCH_CONCURRENCY)
    } finally {
      moduleItemsFetchQueue.off('active', onActive)
      moduleItemsFetchQueue.off('completed', onDone)
      moduleItemsFetchQueue.off('error', onDone)
    }
  })
})
