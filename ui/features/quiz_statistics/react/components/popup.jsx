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

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import PropTypes from 'prop-types'
import {Popover} from '@instructure/ui-popover'
import ScreenReaderContent from '@canvas/quiz-legacy-client-apps/react/components/screen_reader_content'

const RESERVED_PROPS = new Set([
  'content',
  'children',
  'onShow',
  'onHide',
  'screenReaderSupport',
  'placement',
  'hideDelay',
])

const getContentProps = props => {
  const out = {}
  Object.keys(props).forEach(key => {
    if (!RESERVED_PROPS.has(key)) out[key] = props[key]
  })
  return out
}

/**
 * Wrap a React view inside a popover bound to a trigger element. Exposes
 * imperative focus controls so callers can route focus between the trigger
 * anchor and a screen-reader live region as content updates.
 *
 *     <Popup content={MyContent} someProp="x">
 *       <button type="button">Open</button>
 *     </Popup>
 *
 * The popover opens on hover/focus and hides on blur/mouseleave with a
 * 350ms delay by default. Anything passed beyond the reserved props is
 * forwarded to `content`.
 */
const Popup = forwardRef(function Popup(props, ref) {
  const {
    content: Content,
    children,
    onShow,
    onHide,
    screenReaderSupport,
    placement,
    hideDelay,
  } = props

  if (!Content) {
    throw new Error("You must provide a 'content' component for a popup!")
  }

  const [shown, setShown] = useState(false)
  const wrapperRef = useRef(null)
  const screenReaderContentRef = useRef(null)
  const queuedSrFocus = useRef(false)
  const contentProps = getContentProps(props)

  useEffect(() => {
    if (queuedSrFocus.current) {
      queuedSrFocus.current = false
      screenReaderContentRef.current?.focus()
    }
  })

  const handleShow = useCallback(() => {
    setShown(true)
    onShow?.()
  }, [onShow])

  const handleHide = useCallback(() => {
    setShown(false)
    onHide?.()
  }, [onHide])

  useImperativeHandle(
    ref,
    () => ({
      isOpen: () => shown,
      focusAnchor: () => {
        const root = wrapperRef.current
        if (!root) return
        const anchor = root.querySelector('button, a, [tabindex]')
        ;(anchor ?? root).focus()
      },
      focusScreenReaderContent: queue => {
        if (queue === true) {
          queuedSrFocus.current = true
          return
        }
        screenReaderContentRef.current?.focus()
      },
      screenReaderContentHasFocus: () => document.activeElement === screenReaderContentRef.current,
      close: () => {
        if (!shown) return
        setShown(false)
        const root = wrapperRef.current
        const anchor = root?.querySelector('button, a, [tabindex]')
        anchor?.focus()
      },
    }),
    [shown],
  )

  return (
    <div className="inline" ref={wrapperRef}>
      <Popover
        on={['hover', 'focus']}
        placement={placement}
        mouseOutDelay={hideDelay}
        isShowingContent={shown}
        onShowContent={handleShow}
        onHideContent={handleHide}
        shouldContainFocus={false}
        shouldReturnFocus={false}
        renderTrigger={children}
      >
        <div className="popup-content">
          <Content {...contentProps} />
        </div>
      </Popover>
      {screenReaderSupport && (
        <ScreenReaderContent
          ref={screenReaderContentRef}
          tabIndex="-1"
          aria-live="assertive"
          aria-atomic="true"
          aria-relevant="additions"
          role="note"
        >
          <Content {...contentProps} />
        </ScreenReaderContent>
      )}
    </div>
  )
})

Popup.propTypes = {
  /** React component class rendered inside the popover. */
  content: PropTypes.elementType.isRequired,
  /** Element used as the popover trigger. */
  children: PropTypes.node,
  /** Fires after the popover opens. */
  onShow: PropTypes.func,
  /** Fires after the popover closes. */
  onHide: PropTypes.func,
  /** When true, mirrors `content` into a screen-reader live region. */
  screenReaderSupport: PropTypes.bool,
  /** InstUI Popover `placement` (e.g. 'top', 'bottom center'). */
  placement: PropTypes.string,
  /** Delay in ms before hide on mouseout. */
  hideDelay: PropTypes.number,
}

Popup.defaultProps = {
  children: <button type="button">Show Popup</button>,
  screenReaderSupport: true,
  placement: 'top',
  hideDelay: 350,
}

export default Popup
