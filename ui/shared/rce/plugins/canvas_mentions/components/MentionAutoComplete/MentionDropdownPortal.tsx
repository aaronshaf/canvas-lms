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
import React, {useEffect, useRef} from 'react'
import ReactDOM from 'react-dom'
import MentionDropdownMenu from './MentionDropdownMenu'
import PropTypes from 'prop-types'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'

// @ts-expect-error TS7006 -- TypeScriptify (no 'any')
const MentionDropdownPortal = props => {
  const node = useRef()

  // Create mount node if not present
  if (props.rceBodyRef.querySelectorAll('#someTestId').length === 0) {
    // @ts-expect-error TS2322 -- TypeScriptify (no 'any')
    node.current = document.createElement('span')
    // @ts-expect-error TS18048 -- TypeScriptify (no 'any')
    node.current.id = 'someTestId'
    // @ts-expect-error TS18048 -- TypeScriptify (no 'any')
    node.current.style.position = 'absolute'
    // @ts-expect-error TS18048 -- TypeScriptify (no 'any')
    node.current.style.left = '-10000px'
    // @ts-expect-error TS18048 -- TypeScriptify (no 'any')
    node.current.style.top = 'auto'
    // @ts-expect-error TS18048 -- TypeScriptify (no 'any')
    node.current.style.width = '1px'
    // @ts-expect-error TS18048 -- TypeScriptify (no 'any')
    node.current.style.height = '1px'
    // @ts-expect-error TS18048 -- TypeScriptify (no 'any')
    node.current.style.overflow = 'hidden'
    props.rceBodyRef.appendChild(node.current)
  }

  // Remove node from RCE when unmounting
  useEffect(() => {
    return () => {
      const parentElement = props.rceBodyRef.querySelector('span[id=someTestId]').parentElement

      if (parentElement.tagName === 'P') {
        props.rceBodyRef.querySelector('span[id=someTestId]').parentElement.remove()
      } else {
        // @ts-expect-error TS18048 -- TypeScriptify (no 'any')
        node.current.remove()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return ReactDOM.createPortal(
    <ScreenReaderContent>
      <MentionDropdownMenu isInteractive={false} {...props} />
    </ScreenReaderContent>,
    // @ts-expect-error TS2345 -- TypeScriptify (no 'any')
    node.current,
  )
}

MentionDropdownPortal.propTypes = {
  /**
   * Array of optons to be presented to user
   */
  rceBodyRef: PropTypes.oneOfType([PropTypes.node, PropTypes.object]),
  /**
   * Array of optons to be presented to user
   */
  mentionOptions: PropTypes.array,
  /**
   * Unique ID supplied for ARIA support
   */
  instanceId: PropTypes.string,
}

export default MentionDropdownPortal
