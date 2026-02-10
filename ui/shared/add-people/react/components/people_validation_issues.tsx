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
import {duplicatesShape, missingsShape} from './shapes'
import DuplicateSection from './duplicate_section'
import MissingPeopleSection from './missing_people_section'
import {Alert} from '@instructure/ui-alerts'

const I18n = createI18nScope('PeopleValidationIssues')

class PeopleValidationIssues extends React.Component {
  static propTypes = {
    searchType: PropTypes.string.isRequired,
    inviteUsersURL: PropTypes.string,
    duplicates: PropTypes.shape(duplicatesShape),
    missing: PropTypes.shape(missingsShape),
    onChangeDuplicate: PropTypes.func.isRequired,
    onChangeMissing: PropTypes.func.isRequired,
    fieldsRefAndError: PropTypes.object,
  }

  static defaultProps = {
    inviteUsersURL: undefined,
    duplicates: {},
    missing: {},
  }

  /* @ts-expect-error -- TODO: TSify */
  constructor(props) {
    super(props)

    this.state = {
      focusElem: null,
    }
  }

  componentDidUpdate() {
    /* @ts-expect-error -- TODO: TSify */
    if (this.state.focusElem) {
      /* @ts-expect-error -- TODO: TSify */
      this.state.focusElem.focus()
    }
  }

  // event handlers ------------------------------------
  // our user chose one from a set of duplicates
  // @param address: the address searched for that returned duplicate canvas users
  // @param user: the user data for the one selected
  /* @ts-expect-error -- TODO: TSify */
  onSelectDuplicate = (address, user) => {
    /* @ts-expect-error -- TODO: TSify */
    this.props.onChangeDuplicate({address, selectedUserId: user.user_id})
  }

  // our user chose to create a new canvas user rather than select one of the duplicate results
  // @param address: the address searched for that returned duplicate canvas users
  // @param newUserInfo: the new canvas user data entered by our user
  /* @ts-expect-error -- TODO: TSify */
  onNewForDuplicate = (address, newUserInfo) => {
    /* @ts-expect-error -- TODO: TSify */
    this.props.onChangeDuplicate({address, newUserInfo})
  }

  // our user chose to skip this searched for address
  // @param address: the address searched for that returned duplicate canvas users
  /* @ts-expect-error -- TODO: TSify */
  onSkipDuplicate = address => {
    /* @ts-expect-error -- TODO: TSify */
    this.props.onChangeDuplicate({address, skip: true})
  }

  // when the MissingPeopleSection changes,
  // it sends us the current list
  // @param address: the address searched for
  // @param newUserInfo: the new person user wants to invite, or false if skipping
  /* @ts-expect-error -- TODO: TSify */
  onNewForMissing = (address, newUserInfo) => {
    /* @ts-expect-error -- TODO: TSify */
    this.props.onChangeMissing({address, newUserInfo})
  }

  // rendering ------------------------------------
  // render the duplicates sections
  renderDuplicates() {
    /* @ts-expect-error -- TODO: TSify */
    const duplicateAddresses = this.props.duplicates && Object.keys(this.props.duplicates)
    if (!duplicateAddresses || duplicateAddresses.length === 0) {
      return null
    }

    /* @ts-expect-error -- TODO: TSify */
    const duplicateSections = duplicateAddresses.map(address => {
      /* @ts-expect-error -- TODO: TSify */
      const dupeSet = this.props.duplicates[address]
      return (
        <DuplicateSection
          /* @ts-expect-error -- TODO: TSify */
          fieldsRefAndError={this.props.fieldsRefAndError}
          key={`dupe_${address}`}
          /* @ts-expect-error -- TODO: TSify */
          inviteUsersURL={this.props.inviteUsersURL}
          duplicates={dupeSet}
          onSelectDuplicate={this.onSelectDuplicate}
          onNewForDuplicate={this.onNewForDuplicate}
          onSkipDuplicate={this.onSkipDuplicate}
        />
      )
    })

    return (
      <div className="peopleValidationissues__duplicates">
        <Alert variant="warning">
          {I18n.t(
            'There were several possible matches with the import. Please resolve them below.',
          )}
        </Alert>
        {duplicateSections}
      </div>
    )
  }

  // render the missing section
  renderMissing() {
    /* @ts-expect-error -- TODO: TSify */
    const missingAddresses = this.props.missing && Object.keys(this.props.missing)
    if (!missingAddresses || missingAddresses.length === 0) {
      return null
    }
    /* @ts-expect-error -- TODO: TSify */
    const alertText = this.props.inviteUsersURL
      ? I18n.t(
          'We were unable to find matches below. Select any you would like to create as new users. Unselected will be skipped at this time.',
        )
      : I18n.t('We were unable to find matches below.')

    return (
      <div className="peoplevalidationissues__missing">
        <Alert variant="warning">{alertText}</Alert>
        <MissingPeopleSection
          /* @ts-expect-error -- TODO: TSify */
          fieldsRefAndError={this.props.fieldsRefAndError}
          /* @ts-expect-error -- TODO: TSify */
          inviteUsersURL={this.props.inviteUsersURL}
          /* @ts-expect-error -- TODO: TSify */
          missing={this.props.missing}
          /* @ts-expect-error -- TODO: TSify */
          searchType={this.props.searchType}
          onChange={this.onNewForMissing}
        />
      </div>
    )
  }

  render() {
    return (
      <div className="addpeople__peoplevalidationissues">
        {this.renderDuplicates()}
        {this.renderMissing()}
      </div>
    )
  }
}

export default PeopleValidationIssues
