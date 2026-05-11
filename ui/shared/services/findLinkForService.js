/*
 * Copyright (C) 2019 - present Instructure, Inc.
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
import {truncateText} from '@canvas/util/TextHelper'
import sanitizeUrl from '@canvas/util/sanitizeUrl'
import '@canvas/jquery/jquery.ajaxJSON'
import '@canvas/jquery/jquery.instructure_forms'
import 'jqueryui/dialog'
import replaceTags from '@canvas/util/replaceTags'

const I18n = createI18nScope('findLinkForService')

function titleize(inputString) {
  const processedString = (inputString || '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\s+/, ' ')
    .replace(/^\s/, '')

  return processedString
    .split(/\s/)
    .map(word => (word.charAt(0) || '').toUpperCase() + word.substring(1))
    .join(' ')
}

export function getUserServices(service_types, success, error) {
  if (!$.isArray(service_types)) {
    service_types = [service_types]
  }
  const url = `/services?service_types=${service_types.join(',')}`
  $.ajaxJSON(
    url,
    'GET',
    {},
    data => {
      if (success) {
        success(data)
      }
    },
    data => {
      if (error) {
        error(data)
      }
    },
  )
}

export function findLinkForService(service_type, callback) {
  let $dialog = $('#instructure_bookmark_search')
  if (!$dialog.length) {
    const _dlgDiv = document.createElement('div')
    _dlgDiv.id = 'instructure_bookmark_search'
    $dialog = $(_dlgDiv)
    $dialog.append(
      `${
        "<form id='bookmark_search_form' style='margin-bottom: 5px;'>" +
        "<img src='/images/blank.png'/>&nbsp;&nbsp;" +
        "<button class='btn search_button' type='submit'>"
      }${htmlEscape(I18n.t('buttons.search', 'Search'))}</button></form>`,
    )
    $dialog.append("<div class='results' style='max-height: 200px; overflow: auto;'/>")
    $dialog.find('form').submit(event => {
      event.preventDefault()
      event.stopPropagation()
      $dialog.find('.results').text(I18n.t('status.searching', 'Searching...'))
      $dialog
        .find('.results')
        .empty()
        .append(htmlEscape(I18n.t('status.searching', 'Searching...')))
      $.ajaxJSON(
        url,
        'GET',
        {},
        data => {
          $dialog.find('.results').empty()
          if (!data.length) {
            $dialog.find('.results').text(I18n.t('no_results_found', 'No Results Found'))
          }
          for (const idx in data) {
            data[idx].short_title = data[idx].title

            if (data[idx].title == data[idx].description) {
              data[idx].short_title = truncateText(data[idx].description, {max: 30})
            }
            const _bmkDiv = document.createElement('div')
            _bmkDiv.className = 'bookmark'
            const _bmkA = document.createElement('a')
            _bmkA.className = 'bookmark_link'
            _bmkA.style.fontWeight = 'bold'
            _bmkA.href = sanitizeUrl(data[idx].url)
            _bmkA.title = data[idx].title
            _bmkA.textContent = data[idx].short_title
            const _descDiv = document.createElement('div')
            _descDiv.style.cssText = 'margin: 5px 10px; font-size: 0.8em;'
            _descDiv.textContent =
              data[idx].description || I18n.t('no_description', 'No description')
            _bmkDiv.appendChild(_bmkA)
            _bmkDiv.appendChild(_descDiv)
            $(_bmkDiv).appendTo($dialog.find('.results'))
          }
        },
        () => {
          $dialog
            .find('.results')
            .text(I18n.t('errors.search_failed', 'Search failed, please try again.'))
        },
      )
    })
    $dialog.on('click', '.bookmark_link', function (event) {
      event.preventDefault()
      const url = $(this).attr('href')
      const title = $(this).attr('title') || $(this).text()
      $dialog.dialog('close')
      callback({
        url,
        title,
      })
    })
  }
  $dialog.find('.search_button').text(I18n.t('buttons.search', 'Search'))
  $dialog.find('form img').attr('src', `/images/${service_type}_small_icon.png`)
  let url = '/search/bookmarks?service_type=%7B%7B+service_type+%7D%7D'
  url = replaceTags(url, 'service_type', service_type)
  $dialog.data('reference_url', url)
  $dialog.find('.results').empty()
  $dialog.dialog({
    title: I18n.t('titles.bookmark_search', 'Bookmark Search: %{service_name}', {
      service_name: titleize(service_type),
    }),
    open() {
      $dialog.find('input:visible:first').focus().select()
    },
    width: 400,
    modal: true,
    zIndex: 1000,
  })
}
