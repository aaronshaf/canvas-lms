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
import {missingsShape} from './shapes'
import {Table} from '@instructure/ui-table'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {Checkbox} from '@instructure/ui-checkbox'
import {TextInput} from '@instructure/ui-text-input'
import {Text} from '@instructure/ui-text'
import {Link} from '@instructure/ui-link'

const I18n = createI18nScope('add_people_missing_people_section')

const namePrompt = I18n.t('Click to add a name')
const nameLabel = I18n.t("New user's name")
const emailLabel = I18n.t('Required Email Address')

/* @ts-expect-error -- TODO: TSify */
function eatEvent(event) {
  event.stopPropagation()
  event.preventDefault()
}

/* @ts-expect-error -- TODO: TSify */
function AddName({address, namePrompt, onClick}) {
  return (
    <Link data-address={address} isWithinText={false} as="button" onClick={onClick}>
      <Text>{namePrompt}</Text>
    </Link>
  )
}

class MissingPeopleSection extends React.Component {
  static propTypes = {
    missing: PropTypes.shape(missingsShape).isRequired,
    searchType: PropTypes.string.isRequired,
    inviteUsersURL: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    fieldsRefAndError: PropTypes.object,
  }

  static defaultProps = {
    inviteUsersURL: undefined,
  }

  /* @ts-expect-error -- TODO: TSify */
  constructor(props) {
    super(props)

    this.state = {
      selectAll: false,
    }
  }

  /* @ts-expect-error -- TODO: TSify */
  UNSAFE_componentWillReceiveProps(nextProps) {
    const all = Object.keys(nextProps.missing).every(m => nextProps.missing[m].createNew)
    this.setState({selectAll: all})
  }

  // event handlers ------------------------------------
  // user has chosen to create a new user for this group of duplicates
  /* @ts-expect-error -- TODO: TSify */
  onSelectNewForMissing = event => {
    eatEvent(event)

    // user may have clicked on the link. if so, put focus on the adjacent checkbox
    if (
      !(
        event.currentTarget.tagName === 'INPUT' &&
        event.currentTarget.getAttribute('type') === 'checkbox'
      )
    ) {
      // The link was rendered with the attribute data-address=address for this row.
      // Use it to find the checkbox with the matching value.
      const checkbox = document.querySelector(
        `input[type="checkbox"][value="${event.currentTarget.getAttribute('data-address')}"]`,
      )
      if (checkbox) {
        /* @ts-expect-error -- TODO: TSify */
        checkbox.focus()
      }
    }
    const address = event.currentTarget.value || event.currentTarget.getAttribute('data-address')
    this.onSelectNewForMissingByAddress(address)
  }

  /* @ts-expect-error -- TODO: TSify */
  onSelectNewForMissingByAddress(address) {
    /* @ts-expect-error -- TODO: TSify */
    const missingUser = this.props.missing[address]
    let defaultEmail = ''
    /* @ts-expect-error -- TODO: TSify */
    if (this.props.searchType === 'cc_path') {
      defaultEmail = missingUser.address
    }
    const newUserInfo = {
      name: (missingUser.newUserInfo && missingUser.newUserInfo.name) || '',
      email: (missingUser.newUserInfo && missingUser.newUserInfo.email) || defaultEmail,
    }

    /* @ts-expect-error -- TODO: TSify */
    if (typeof this.props.onChange === 'function') {
      /* @ts-expect-error -- TODO: TSify */
      this.props.onChange(address, newUserInfo)
    }
  }

  // check or uncheck all the missing users' checkboxes
  /* @ts-expect-error -- TODO: TSify */
  onSelectNewForMissingAll = event => {
    this.setState({selectAll: event.currentTarget.checked})
    if (event.currentTarget.checked) {
      /* @ts-expect-error -- TODO: TSify */
      Object.keys(this.props.missing).forEach(address =>
        this.onSelectNewForMissingByAddress(address),
      )
    } else {
      /* @ts-expect-error -- TODO: TSify */
      Object.keys(this.props.missing).forEach(address => this.onUncheckUserByAddress(address))
    }
  }

  // when either of the TextInputs for creating a new user for a missing person
  // changes, we come here collect the input
  // @param event: the event that triggered the change
  /* @ts-expect-error -- TODO: TSify */
  onNewForMissingChange = event => {
    const field = event.currentTarget.getAttribute('name')
    const address = event.currentTarget.getAttribute('data-address')
    /* @ts-expect-error -- TODO: TSify */
    const newUserInfo = this.props.missing[address].newUserInfo
    newUserInfo[field] = event.currentTarget.value
    /* @ts-expect-error -- TODO: TSify */
    this.props.onChange(address, newUserInfo)
  }

  // when user unchecks a checked new user
  // @param event: the click event
  /* @ts-expect-error -- TODO: TSify */
  onUncheckUser = event => {
    this.onUncheckUserByAddress(event.currentTarget.value)
    this.setState({selectAll: false})
  }

  /* @ts-expect-error -- TODO: TSify */
  onUncheckUserByAddress = address => {
    /* @ts-expect-error -- TODO: TSify */
    this.props.onChange(address, false)
  }

  // send the current list of users on up
  onChangeUsers() {
    /* @ts-expect-error -- TODO: TSify */
    const userList = this.state.candidateUsers.filter(u => u.checked && u.email && u.name)
    /* @ts-expect-error -- TODO: TSify */
    this.props.onChange(userList)
  }

  // rendering ------------------------------------
  // render each of the missing login ids or sis ids
  // @returns an array of table rows, one for each missing id
  renderMissingIds() {
    /* @ts-expect-error -- TODO: TSify */
    const missingList = this.props.missing

    return Object.keys(missingList).map(missingKey => {
      const missing = missingList[missingKey]
      let row

      // a row for each login_id
      /* @ts-expect-error -- TODO: TSify */
      if (!this.props.inviteUsersURL) {
        // cannot create new users. Just show the missing ones
        row = (
          <Table.Row key={`missing_${missing.address}`}>
            <Table.RowHeader>{missing.address}</Table.RowHeader>
          </Table.Row>
        )
      } else if (missing.createNew) {
        /* @ts-expect-error -- TODO: TSify */
        const emailError = this.props.fieldsRefAndError?.[missing.address]?.errorMessage

        row = (
          <Table.Row key={`missing_${missing.address}`}>
            <Table.Cell>
              <Checkbox
                value={missing.address}
                checked={true}
                onChange={this.onUncheckUser}
                label={
                  <ScreenReaderContent>
                    {I18n.t('Check to skip adding a user for %{loginid}', {
                      loginid: missing.address,
                    })}
                  </ScreenReaderContent>
                }
              />
            </Table.Cell>
            <Table.Cell>
              <TextInput
                name="name"
                type="text"
                placeholder={nameLabel}
                renderLabel={<ScreenReaderContent>{nameLabel}</ScreenReaderContent>}
                data-address={missing.address}
                onChange={this.onNewForMissingChange}
                value={missing.newUserInfo.name || ''}
              />
            </Table.Cell>
            <Table.Cell>
              <TextInput
                ref={ref => {
                  /* @ts-expect-error -- TODO: TSify */
                  this.props.fieldsRefAndError[missing.address] = {ref}
                }}
                isRequired={true}
                name="email"
                type="email"
                placeholder={emailLabel}
                renderLabel={<ScreenReaderContent>{emailLabel}</ScreenReaderContent>}
                data-address={missing.address}
                onChange={this.onNewForMissingChange}
                value={missing.newUserInfo.email || ''}
                messages={emailError ? [{text: emailError, type: 'newError'}] : []}
              />
            </Table.Cell>
            <Table.Cell>
              <Text weight="bold">{missing.address}</Text>
            </Table.Cell>
          </Table.Row>
        )
      } else {
        row = (
          <Table.Row key={`missing_${missing.address}`}>
            <Table.Cell>
              <Checkbox
                value={missing.address}
                checked={false}
                onClick={this.onSelectNewForMissing}
                label={
                  <ScreenReaderContent>
                    {I18n.t('Check to add a user for %{loginid}', {loginid: missing.address})}
                  </ScreenReaderContent>
                }
              />
            </Table.Cell>
            <Table.Cell colSpan={2}>
              <AddName
                address={missing.address}
                namePrompt={namePrompt}
                onClick={this.onSelectNewForMissing}
              />
            </Table.Cell>
            <Table.Cell>
              <Text weight="bold">{missing.address}</Text>
            </Table.Cell>
          </Table.Row>
        )
      }
      return row
    })
  }

  // render each of the missing email addresses
  // @returns an array of table rows, one for each missing id
  renderMissingEmail() {
    /* @ts-expect-error -- TODO: TSify */
    const missingList = this.props.missing

    return Object.keys(missingList).map(missingKey => {
      const missing = missingList[missingKey]
      let row
      /* @ts-expect-error -- TODO: TSify */
      if (!this.props.inviteUsersURL) {
        // cannot create new users. Just show the missing ones
        row = (
          <Table.Row key={`missing_${missing.address}`}>
            <Table.RowHeader>{missing.address}</Table.RowHeader>
          </Table.Row>
        )
      } else if (missing.createNew) {
        row = (
          <Table.Row key={`missing_${missing.address}`}>
            <Table.Cell>
              <Checkbox
                value={missing.address}
                checked={true}
                onChange={this.onUncheckUser}
                label={
                  <ScreenReaderContent>
                    {I18n.t('Check to skip adding a user for %{loginid}', {
                      loginid: missing.address,
                    })}
                  </ScreenReaderContent>
                }
              />
            </Table.Cell>
            <Table.Cell>
              <TextInput
                isRequired={true}
                name="name"
                type="text"
                placeholder={nameLabel}
                renderLabel={<ScreenReaderContent>{nameLabel}</ScreenReaderContent>}
                data-address={missing.address}
                onChange={this.onNewForMissingChange}
                value={missing.newUserInfo.name || ''}
              />
            </Table.Cell>
            <Table.RowHeader>{missing.address}</Table.RowHeader>
          </Table.Row>
        )
      } else {
        row = (
          <Table.Row key={`missing_${missing.address}`}>
            <Table.Cell>
              <Checkbox
                value={missing.address}
                checked={false}
                onChange={this.onSelectNewForMissing}
                label={
                  <ScreenReaderContent>
                    {I18n.t('Check to add a user for %{loginid}', {loginid: missing.address})}
                  </ScreenReaderContent>
                }
              />
            </Table.Cell>
            <Table.Cell>
              <AddName
                address={missing.address}
                namePrompt={namePrompt}
                onClick={this.onSelectNewForMissing}
              />
            </Table.Cell>
            <Table.RowHeader>{missing.address}</Table.RowHeader>
          </Table.Row>
        )
      }
      return row
    })
  }

  renderTableHead() {
    let idColHeader = null
    /* @ts-expect-error -- TODO: TSify */
    if (this.props.searchType === 'unique_id') {
      idColHeader = <Table.ColHeader id="login-id">{I18n.t('Login ID')}</Table.ColHeader>
      /* @ts-expect-error -- TODO: TSify */
    } else if (this.props.searchType === 'sis_user_id') {
      idColHeader = <Table.ColHeader id="sis-id">{I18n.t('SIS ID')}</Table.ColHeader>
    }

    /* @ts-expect-error -- TODO: TSify */
    if (this.props.inviteUsersURL) {
      return (
        <Table.Head>
          <Table.Row>
            <Table.ColHeader id="user-selection">
              <ScreenReaderContent>{I18n.t('User Selection')}</ScreenReaderContent>
              <Checkbox
                id="missing_users_select_all"
                value="__ALL__"
                /* @ts-expect-error -- TODO: TSify */
                checked={this.state.selectAll}
                onChange={this.onSelectNewForMissingAll}
                label={<ScreenReaderContent>{I18n.t('Check to select all')}</ScreenReaderContent>}
              />
            </Table.ColHeader>
            <Table.ColHeader id="name">{I18n.t('Name')}</Table.ColHeader>
            <Table.ColHeader id="email">{I18n.t('Email Address')}</Table.ColHeader>
            {idColHeader}
          </Table.Row>
        </Table.Head>
      )
    }
    idColHeader = idColHeader || (
      <Table.ColHeader id="email-id">{I18n.t('Email Address')}</Table.ColHeader>
    )
    return (
      <Table.Head>
        <Table.Row>{idColHeader}</Table.Row>
      </Table.Head>
    )
  }

  // render the list of login_ids where we did not find users
  render() {
    const bodyRows =
      /* @ts-expect-error -- TODO: TSify */
      this.props.searchType === 'cc_path' ? this.renderMissingEmail() : this.renderMissingIds()

    return (
      <div className="addpeople__missing namelist" data-testid="addpeople__missing-namelist">
        <Table
          caption={<ScreenReaderContent>{I18n.t('Unmatched login list')}</ScreenReaderContent>}
        >
          {this.renderTableHead()}
          <Table.Body>{bodyRows}</Table.Body>
        </Table>
      </div>
    )
  }
}

export default MissingPeopleSection
