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

// XSS regression tests for OutcomeView description rendering.
// friendly_description is sanitized before template render but
// description was not — inconsistent. Both should go through
// sanitizeHTML() before the Handlebars triple-brace sink.

import $ from 'jquery'
import 'jquery-migrate'
import fakeENV from '@canvas/test-utils/fakeENV'
import Outcome from '../../../../backbone/models/Outcome'
import OutcomeContentBase from '../OutcomeContentBase'
import OutcomeView from '../OutcomeView'

OutcomeContentBase.prototype.readyForm = () => {}

function buildOutcome(description) {
  return {
    context_type: 'Course',
    context_id: 1,
    outcome_group: {outcomes_url: 'blah'},
    outcome: {
      id: 1,
      title: 'Outcome1',
      description,
      context_type: 'Course',
      context_id: 1,
      points_possible: '5',
      mastery_points: '3',
      url: 'blah',
      calculation_method: 'decaying_average',
      calculation_int: 65,
      assessed: false,
      can_edit: false,
    },
  }
}

function createView(description) {
  const application = $('<div id="application" />')
  application.appendTo($('#fixtures'))
  const model = new Outcome(buildOutcome(description), {parse: true})
  const view = new OutcomeView({model, readOnly: false})
  view.$el.appendTo(application)
  return view.render()
}

describe('OutcomeView XSS hardening', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="fixtures"></div>'
    fakeENV.setup({
      ACCOUNT_LEVEL_MASTERY_SCALES: false,
      current_user_roles: [],
    })
  })

  afterEach(() => {
    $('#fixtures').empty()
    fakeENV.teardown()
  })

  it('strips onerror from img in outcome description', () => {
    const xss = '<img src="x" onerror="window.__xss987=1">'
    createView(xss)
    const img = document.querySelector('#fixtures img')
    if (img) {
      expect(img.getAttribute('onerror')).toBeNull()
    }
    expect(window.__xss987).toBeUndefined()
  })

  it('strips javascript: href from anchor in outcome description', () => {
    const xss = '<a href="javascript:window.__xss987b=1">click</a>'
    createView(xss)
    const anchor = document.querySelector('#fixtures a[href]')
    if (anchor) {
      const href = anchor.getAttribute('href') ?? ''
      expect(href).not.toMatch(/^javascript:/i)
    }
    expect(window.__xss987b).toBeUndefined()
  })

  it('preserves safe HTML in outcome description', () => {
    const safe = '<strong>Important outcome</strong>'
    const view = createView(safe)
    expect(view.$el.html()).toContain('Important outcome')
  })
})
