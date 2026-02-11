/*
 * Copyright (C) 2015 - present Instructure, Inc.
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

import React from 'react'
import {render} from '@testing-library/react'
import DownloadLink from '../DownloadLink'
import {useScope as createI18nScope} from '@canvas/i18n'
import type {Course} from '../CourseStore'

const I18n = createI18nScope('epub_exports')

interface DownloadLinkProps {
  course: Course
}

describe('DownloadLink', () => {
  let props: DownloadLinkProps

  beforeEach(() => {
    props = {
      course: {
        name: 'Maths 101',
        id: 1,
      },
    }
  })

  it('shows no download link without epub_export object', () => {
    const {container} = render(<DownloadLink {...props} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows no download link without download permissions', () => {
    props.course.epub_export = {id: 1, permissions: {download: false}, workflow_state: 'generated'}
    const {container} = render(<DownloadLink {...props} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows download link with proper permissions', () => {
    props.course.epub_export = {
      id: 1,
      workflow_state: 'generated',
      epub_attachment: {url: 'http://download.url'},
      permissions: {download: true},
    }
    const {getByRole} = render(<DownloadLink {...props} />)
    const link = getByRole('link')
    expect(link).toBeInTheDocument()
    expect(link).toHaveTextContent(I18n.t('Download'))
  })
})
