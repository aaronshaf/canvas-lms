/*
 * Copyright (C) 2011 - present Instructure, Inc.
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

import BackoffPoller from '../index'
import sinon from 'sinon'

const ok = a => expect(a).toBeTruthy()

let ran_callback
let callback
let clock
let server

describe('BackoffPoller', () => {
  beforeEach(() => {
    ran_callback = false
    callback = () => (ran_callback = true)
    clock = sinon.useFakeTimers()
    server = sinon.fakeServer.create()
    server.respondWith('fixtures/ok.json', '{"status":"ok"}')
  })

  afterEach(() => {
    clock.restore()
    server.restore()
  })

  test('should keep polling when it gets a "continue"', function () {
    const poller = new BackoffPoller('fixtures/ok.json', () => 'continue', {
      backoffFactor: 1,
      baseInterval: 10,
      maxAttempts: 100,
    })
    poller.start().then(callback)

    // let the first interval expire, and then respond to the request
    clock.tick(10)
    server.respond()
    ok(poller.running, 'poller should be running')
    poller.stop(false)
  })

  test('should reset polling when it gets a "reset"', function () {
    const poller = new BackoffPoller('fixtures/ok.json', () => 'reset', {
      backoffFactor: 1,
      baseInterval: 10,
      maxAttempts: 100,
    })
    poller.start().then(callback)

    // let the first interval expire, and then respond to the request
    clock.tick(10)
    server.respond()
    ok(poller.running, 'poller should be running')
    ok(poller.attempts <= 1, 'counter should be reset') // either zero or one, depending on whether we're waiting for a timeout or an ajax call
    poller.stop(false)
  })

  test('should stop polling when it gets a "stop"', function () {
    let count = 0
    const poller = new BackoffPoller(
      'fixtures/ok.json',
      () => (count++ > 3 ? 'stop' : 'continue'),
      {
        backoffFactor: 1,
        baseInterval: 10,
      },
    )
    poller.start().then(callback)
    // let the four 'continue' intervals expire, responding after each
    for (let i = 0; i < 4; i++) {
      clock.tick(10)
      server.respond()
    }
    ok(poller.running, 'poller should be running')
    clock.tick(10)
    server.respond()
    ok(!poller.running, 'poller should be stopped')
    ok(ran_callback, 'poller should have run callbacks')
  })

  test('should abort polling when it hits maxAttempts', function () {
    const poller = new BackoffPoller('fixtures/ok.json', () => 'continue', {
      backoffFactor: 1,
      baseInterval: 10,
      maxAttempts: 3,
    })
    poller.start().then(callback)

    // let the first two intervals expire, responding after each
    for (let i = 0; i < 2; i++) {
      clock.tick(10)
      server.respond()
    }
    ok(poller.running, 'poller should be running')

    // let the final interval expire, and then respond to the request
    clock.tick(10)
    server.respond()
    ok(!poller.running, 'poller should be stopped')
    ok(!ran_callback, 'poller should not have run callbacks')
  })

  test('should abort polling when it gets anything else', function () {
    const poller = new BackoffPoller('fixtures/ok.json', () => 'omgwtfbbq', {baseInterval: 10})
    poller.start().then(callback)

    // let the interval expire, and then respond to the request
    clock.tick(10)
    server.respond()
    ok(!poller.running, 'poller should be stopped')
    ok(!ran_callback, 'poller should not have run callbacks')
  })
})
