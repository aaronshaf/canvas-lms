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

import {useScope as createI18nScope} from '@canvas/i18n'
import $ from 'jquery'
import htmlEscape from '@instructure/html-escape'
import Spinner from 'spin.js'
import '@canvas/jquery/jquery.ajaxJSON'
import '@canvas/jquery/jquery.instructure_misc_helpers'
import sanitizeUrl from '@canvas/util/sanitizeUrl'

const I18n = createI18nScope('prerequisites_lookup')

let lookupStarted = false

INST.lookupPrerequisites = function () {
  if (lookupStarted) {
    return
  }

  const $link = $('#module_prerequisites_lookup_link')
  if ($link.length == 0) {
    return
  }
  lookupStarted = true

  const url = $link.attr('x-canvaslms-trusted-url')

  const spinner = new Spinner({radius: 5})
  spinner.spin()
  $(spinner.el).css({opacity: 0.5, top: '25px', left: '200px'}).appendTo('.spinner')

  $.ajaxJSON(
    url,
    'GET',
    {},
    function (data) {
      spinner.stop()
      if (data.locked === false) {
        return
      }
      const _ul = document.createElement('ul')
      _ul.id = 'module_prerequisites_list'
      const $ul = $(_ul)
      for (const idx in data.modules) {
        const module = data.modules[idx]
        const _li = document.createElement('li')
        const _i = document.createElement('i')
        _li.classList.add('module')
        _li.addEventListener('click', function () {
          $(this).find('ul').toggle()
        })
        _li.classList.toggle('locked', !!module.locked)
        if (module.locked) {
          _i.classList.add('icon-lock')
        }
        _li.appendChild(_i)
        const _h3 = document.createElement('h3')
        _h3.textContent = module.name
        _li.appendChild(_h3)
        if (module.prerequisites && module.prerequisites.length > 0) {
          const _pres = document.createElement('ul')
          for (const jdx in module.prerequisites) {
            const pre = module.prerequisites[jdx]
            const _pre = document.createElement('li')
            _pre.classList.add('requirement')
            _pre.classList.toggle('locked_requirement', !pre.available)
            const _a = document.createElement('a')
            _a.href = sanitizeUrl(pre.url)
            _a.textContent = pre.title
            _a.classList.toggle('icon-lock', !pre.available)
            _pre.appendChild(_a)
            const desc = pre.requirement_description
            if (desc) {
              const _div = document.createElement('div')
              _div.classList.add('description')
              _div.textContent = desc
              _pre.appendChild(_div)
            }
            _pres.appendChild(_pre)
          }
          _li.appendChild(_pres)
        }
        _ul.appendChild(_li)
      }
      $link.after($ul)
      const header = I18n.t('headers.completion_prerequisites', 'Completion Prerequisites')
      const sentence = I18n.beforeLabel(
        I18n.t(
          'labels.requirements_must_be_completed',
          'The following requirements need to be completed before this page will be unlocked',
        ),
      )
      $link.after(
        "<br/><h2 style='margin-top: 15px;'>" + htmlEscape(header) + '</h2>' + htmlEscape(sentence),
      )
      $link.prev('a').hide()
    },
    _data => {
      spinner.stop()
      $('.module_prerequisites_fallback').show()
    },
  )
}
$(document).ready(INST.lookupPrerequisites)
