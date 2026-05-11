/*
 * Copyright (C) 2024 - present Instructure, Inc.
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
import {type BlockTemplate} from '../../../types'
import TemplateCardSkeleton from '../TemplateCardSekeleton'

const blocktemplate = {
  id: 'xyzzy',
  name: 'Template Name',
  description: 'Template Description',
} as BlockTemplate

const renderComponent = (props = {}) => {
  return render(
    <TemplateCardSkeleton
      template={blocktemplate}
      createAction={vi.fn()}
      quickLookAction={vi.fn()}
      inLayout="grid"
      {...props}
    />,
  )
}

describe('TemplateCardSkeleton', () => {
  it('renders', () => {
    const {getByText, getByTestId} = renderComponent()
    const skeleton = getByTestId('template-card-skeleton')
    expect(skeleton).toBeInTheDocument()
    expect(skeleton).toHaveClass('grid')
    expect(getByText('Quick Look')).toBeInTheDocument()
    expect(getByText('Customize')).toBeInTheDocument()
  })

  it('renders in rows layout', () => {
    const {getByTestId} = renderComponent({inLayout: 'rows'})
    const skeleton = getByTestId('template-card-skeleton')
    expect(skeleton).toHaveClass('rows')
  })

  it('includes the template name in the aria-label', () => {
    const {getByTestId} = renderComponent()
    const skeleton = getByTestId('template-card-skeleton')
    expect(skeleton).toHaveAttribute('aria-label', 'Template Name template')
  })

  it('includes the template description in the aria-describedby', () => {
    const {container, getByTestId} = renderComponent()
    const skeleton = getByTestId('template-card-skeleton')
    expect(skeleton).toHaveAttribute('aria-describedby')
    const aria_describedby = skeleton.getAttribute('aria-describedby')
    const describedby = container.querySelector(`#${aria_describedby}`)
    expect(describedby).toBeInTheDocument()
    expect(describedby).toHaveTextContent('Template Description')
  })

  describe('thumbnail rendering', () => {
    it('passes thumbnail through CSS.escape before interpolating into url()', () => {
      const escapeSpy = vi.spyOn(CSS, 'escape')
      renderComponent({
        template: {...blocktemplate, thumbnail: 'https://example.com/thumb.png'},
      })
      expect(escapeSpy).toHaveBeenCalledWith('https://example.com/thumb.png')
      escapeSpy.mockRestore()
    })

    it('passes CSS-breakout payload through CSS.escape', () => {
      const escapeSpy = vi.spyOn(CSS, 'escape')
      const evil = '");}body{background:url("//attacker.tld/log'
      renderComponent({
        template: {...blocktemplate, thumbnail: evil},
      })
      expect(escapeSpy).toHaveBeenCalledWith(evil)
      escapeSpy.mockRestore()
    })

    it('does not call CSS.escape when thumbnail is empty', () => {
      const escapeSpy = vi.spyOn(CSS, 'escape')
      renderComponent({
        template: {...blocktemplate, thumbnail: ''},
      })
      expect(escapeSpy).not.toHaveBeenCalled()
      escapeSpy.mockRestore()
    })
  })

  describe('The blank page template', () => {
    it('renders', () => {
      const {getByText, getByTestId} = renderComponent({template: {id: 'blank_page'}})
      const skeleton = getByTestId('template-card-skeleton')
      expect(getByText('New Blank Page')).toBeInTheDocument()
      expect(skeleton).toHaveClass('blank-card')
    })

    it('had a curl', () => {
      const {getByTestId} = renderComponent({template: {id: 'blank_page'}})
      const skeleton = getByTestId('template-card-skeleton')
      expect(skeleton.querySelector('.curl')).toBeInTheDocument()
    })

    it('does not render the Quick Look button', () => {
      const {queryByText} = renderComponent({template: {id: 'blank_page'}})
      expect(queryByText('Quick Look')).not.toBeInTheDocument()
    })
  })
})
