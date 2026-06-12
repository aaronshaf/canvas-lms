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

import $ from 'jquery'
import ToolLaunchResizer from '../tool_launch_resizer'

describe('ToolLaunchResizer', () => {
  describe('#tool_content_wrapper', () => {
    afterEach(() => {
      $('.tool_content_wrapper').remove()
    })

    it('returns the wrapper when exactly one exists', () => {
      $(document.body).append('<div class="tool_content_wrapper" id="only-wrapper"></div>')

      const result = new ToolLaunchResizer().tool_content_wrapper()

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('only-wrapper')
    })

    it('returns empty when multiple wrappers exist', () => {
      $(document.body).append('<div class="tool_content_wrapper"></div>')
      $(document.body).append('<div class="tool_content_wrapper"></div>')

      const result = new ToolLaunchResizer().tool_content_wrapper()

      expect(result).toHaveLength(0)
    })

    it('returns empty when no wrapper exists', () => {
      const result = new ToolLaunchResizer().tool_content_wrapper()

      expect(result).toHaveLength(0)
    })
  })
})
