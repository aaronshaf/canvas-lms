/*
 * Copyright (C) 2016 - present Instructure, Inc.
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
import React from 'react'
import PropTypes from 'prop-types'
import {Alert} from '@instructure/ui-alerts'

const I18n = createI18nScope('add_peopleApiError')

class ApiError extends React.Component {
  static propTypes = {
    error: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]).isRequired,
  }

  renderErrorList() {
    const timestamp = Date.now()
    /* @ts-expect-error -- TODO: TSify */
    const errors = this.props.error
    /* @ts-expect-error -- TODO: TSify */
    const errorItems = errors.map((e, i) => (
      // Yes, this is gross. Yes, we should have another approach. Given the nature
      // of this change, we are instead opting to simply guarantee uniqueness of the
      // keys rather than determine a better distinquisher. If you happen upon this
      // and would like to improve this, please do!
      //
      <li key={`${timestamp}-${i}`}>{e}</li>
    ))

    return (
      <div className="addpeople__apierror">
        {I18n.t('The following users could not be created.')}
        <ul className="apierror__error_list">{errorItems}</ul>
      </div>
    )
  }

  // render the list of login_ids where we did not find users
  render() {
    /* @ts-expect-error -- TODO: TSify */
    const error = this.props.error
    return <Alert variant="error">{Array.isArray(error) ? this.renderErrorList() : error}</Alert>
  }
}

export default ApiError
