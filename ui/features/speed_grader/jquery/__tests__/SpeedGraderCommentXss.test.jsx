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

// Regression coverage for the legacy SpeedGrader submission comment render
// sink. The comment body is rendered via jQuery `.html()`; defense-in-depth
// requires that no script tags or event-handler attributes survive in the
// rendered DOM, regardless of what shape the input HTML took. The shared
// @canvas/sanitize-html (DOMPurify) helper is the final pass at the sink.

import $ from 'jquery'
import 'jquery-migrate'
import SpeedGrader from '../speed_grader'
import fakeENV from '@canvas/test-utils/fakeENV'
import '@canvas/jquery/jquery.ajaxJSON'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = root => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

describe('SpeedGrader Comment Rendering — XSS regression', () => {
  let commentRenderingOptions
  const fixtures = document.createElement('div')
  fixtures.id = 'fixtures'

  const requiredDOMFixtures = `
    <div id="hide-assignment-grades-tray"></div>
    <div id="post-assignment-grades-tray"></div>
    <div id="speed_grader_assessment_audit_tray_mount_point"></div>
    <span id="speed_grader_post_grades_menu_mount_point"></span>
    <span id="speed_grader_settings_mount_point"></span>
    <div id="speed_grader_rubric_assessment_tray_wrapper"><div>
    <div id="speed_grader_assessment_audit_button_mount_point"></div>
    <div id="speed_grader_submission_comments_download_mount_point"></div>
    <div id="speed_grader_hidden_submission_pill_mount_point"></div>
    <div id="grades-loading-spinner"></div>
    <div id="grading"></div>
    <div id="settings_form">
      <select id="eg_sort_by" name="eg_sort_by">
        <option value="alphabetically"></option>
        <option value="submitted_at"></option>
        <option value="submission_status"></option>
        <option value="randomize"></option>
      </select>
      <input id="hide_student_names" type="checkbox" name="hide_student_names">
      <input id="enable_speedgrader_grade_by_question" type="checkbox" name="enable_speedgrader_grade_by_question">
      <button type="submit" class="submit_button"></button>
    </div>
  `

  const setupFixtures = (domStrings = '') => {
    fixtures.innerHTML = `${requiredDOMFixtures}${domStrings}`
    document.body.appendChild(fixtures)
    return fixtures
  }

  const teardownFixtures = () => {
    while (fixtures.firstChild) fixtures.removeChild(fixtures.firstChild)
    if (fixtures.parentNode) {
      fixtures.parentNode.removeChild(fixtures)
    }
  }

  const buildComment = commentBody => ({
    group_comment_id: null,
    publishable: false,
    anonymous: false,
    assessment_request_id: null,
    attachment_ids: '',
    author_id: 1000,
    author_name: 'An Author',
    comment: commentBody,
    context_id: 1,
    context_type: 'Course',
    created_at: '2016-07-12T23:47:34Z',
    hidden: false,
    id: 11,
    posted_at: 'Jul 12 at 5:47pm',
    submission_id: 1,
    teacher_only_comment: false,
    updated_at: '2016-07-12T23:47:34Z',
  })

  beforeEach(() => {
    fakeENV.setup()
    delete window.__xss_fired

    window.jsonData = {
      id: 27,
      GROUP_GRADING_MODE: false,
      anonymous_grader_ids: ['asdfg', 'mry2b'],
    }

    SpeedGrader.EG.currentStudent = {
      id: 4,
      name: 'Guy B. Studying',
      submission_state: 'not_graded',
      submission: {
        score: 7,
        grade: 70,
        submission_comments: [],
      },
    }

    ENV.RUBRIC_ASSESSMENT = {
      assessment_type: 'grading',
      assessor_id: 1,
    }

    ENV.anonymous_identities = {
      mry2b: {id: 'mry2b', name: 'Grader 2'},
      asdfg: {id: 'asdfg', name: 'Grader 1'},
    }

    const commentBlankHtml = `
      <div class="comment">
        <span class="comment"></span>
        <button class="submit_comment_button">
          <span>Submit</span>
        </button>
        <div class="comment_citation">
          <span class="author_name"></span>
        </div>
        <a class="delete_comment_link icon-x">
          <span class="screenreader-only">Delete comment</span>
        </a>
        <div class="comment_attachments"></div>
      </div>
    `

    const commentAttachmentBlank = `
      <div class="comment_attachment">
        <a href="example.com/{{ submitter_id }}/{{ id }}/{{ comment_id }}">
          <span class="display_name">&nbsp;</span>
        </a>
      </div>
    `

    commentRenderingOptions = {
      commentBlank: $(commentBlankHtml),
      commentAttachmentBlank: $(commentAttachmentBlank),
    }

    setupFixtures()
  })

  afterEach(() => {
    teardownFixtures()
    fakeENV.teardown()
    delete window.__xss_fired
  })

  it('strips <script> tags from the rendered comment HTML', () => {
    const comment = buildComment('<p>before<script>window.__xss_fired = true</script>after</p>')
    SpeedGrader.EG.currentStudent.submission.submission_comments = [comment]
    const renderedComment = SpeedGrader.EG.renderComment(comment, commentRenderingOptions)
    const span = renderedComment.find('span.comment')[0]

    expect(span.querySelector('script')).toBeNull()
    expect(window.__xss_fired).toBeUndefined()
  })

  it('strips inline event handlers from the rendered comment HTML', () => {
    const comment = buildComment('<p>hi <img src=x onerror="window.__xss_fired = true"></p>')
    SpeedGrader.EG.currentStudent.submission.submission_comments = [comment]
    const renderedComment = SpeedGrader.EG.renderComment(comment, commentRenderingOptions)
    const span = renderedComment.find('span.comment')[0]

    expectNoEventHandlers(span)
    expect(window.__xss_fired).toBeUndefined()
  })

  it('does not promote a title-attribute breakout payload into a live event handler', () => {
    // Defense-in-depth shape: even if the input text contains tag-like content
    // inside a title attribute and a downstream string mutator were to break
    // the attribute boundary, the sink-level sanitizer must strip any
    // resulting on* handler in the rendered DOM.
    const comment = buildComment(
      '<p title="<a ><img src=x onerror=\'window.__xss_fired = true\'>">visible</p>',
    )
    SpeedGrader.EG.currentStudent.submission.submission_comments = [comment]
    const renderedComment = SpeedGrader.EG.renderComment(comment, commentRenderingOptions)
    const span = renderedComment.find('span.comment')[0]

    expectNoEventHandlers(span)
    expect(window.__xss_fired).toBeUndefined()
  })
})
