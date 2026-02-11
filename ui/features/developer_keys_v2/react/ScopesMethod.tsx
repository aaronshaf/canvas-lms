/*
 * Copyright (C) 2018 - present Instructure, Inc.
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
// @ts-expect-error
import {Pill} from '@instructure/ui-pill'

interface ScopesMethodProps {
  method: string
  margin?: string
}

export default class ScopesMethod extends React.Component<ScopesMethodProps> {
  static defaultProps = {
    margin: undefined,
  }

  methodColorMap() {
    return {
      get: 'primary',
      put: 'default',
      post: 'success',
      delete: 'danger',
    }
  }

  render() {
    return (
      <Pill
        data-automation="developer-key-scope-pill"
        margin={this.props.margin}
        color="primary"
        themeOverride={{color: '#6D7883'}}
      >
        {this.props.method}
      </Pill>
    )
  }
}
