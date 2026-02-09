/*
 * Copyright (C) 2017 - present Instructure, Inc.
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
import PropTypes from 'prop-types'
import {useScope as createI18nScope} from '@canvas/i18n'
import {IconButton} from '@instructure/ui-buttons'
import {IconMoveStartLine, IconMoveEndLine} from '@instructure/ui-icons'
import plainStoreShape from '@canvas/util/react/proptypes/plainStoreShape'

const I18n = createI18nScope('new_user_tutorial')

class NewUserTutorialToggleButton extends React.Component {
  static propTypes = {
    store: PropTypes.shape(plainStoreShape).isRequired,
  }

  // @ts-expect-error -- TS migration: props are untyped; keep runtime behavior unchanged.
  constructor(props) {
    super(props)
    this.state = props.store.getState()
  }

  componentDidMount() {
    // @ts-expect-error -- TS migration: props are untyped; keep runtime behavior unchanged.
    this.props.store.addChangeListener(this.handleStoreChange)
  }

  componentWillUnmount() {
    // @ts-expect-error -- TS migration: props are untyped; keep runtime behavior unchanged.
    this.props.store.removeChangeListener(this.handleStoreChange)
  }

  focus() {
    // @ts-expect-error -- TS migration: instance ref is untyped; keep runtime behavior unchanged.
    this.button.focus()
  }

  handleStoreChange = () => {
    // @ts-expect-error -- TS migration: props are untyped; keep runtime behavior unchanged.
    this.setState(this.props.store.getState())
  }

  // @ts-expect-error -- TS migration: event is untyped; keep runtime behavior unchanged.
  handleButtonClick = event => {
    event.preventDefault()

    // @ts-expect-error -- TS migration: props/state are untyped; keep runtime behavior unchanged.
    this.props.store.setState({
      // @ts-expect-error -- TS migration: state is untyped; keep runtime behavior unchanged.
      isCollapsed: !this.state.isCollapsed,
    })
  }

  render() {
    // @ts-expect-error -- TS migration: state is untyped; keep runtime behavior unchanged.
    const isCollapsed = this.state.isCollapsed

    return (
      <IconButton
        ref={c => {
          // @ts-expect-error -- TS migration: instance ref is untyped; keep runtime behavior unchanged.
          this.button = c
        }}
        /* @ts-expect-error -- TS migration: InstUI typings differ; keep runtime behavior unchanged. */
        variant="icon"
        id="new_user_tutorial_toggle"
        onClick={this.handleButtonClick}
        withBackground={false}
        withBorder={false}
        screenReaderLabel={
          isCollapsed ? I18n.t('Expand tutorial tray') : I18n.t('Collapse tutorial tray')
        }
      >
        {isCollapsed ? <IconMoveStartLine /> : <IconMoveEndLine />}
      </IconButton>
    )
  }
}

export default NewUserTutorialToggleButton
