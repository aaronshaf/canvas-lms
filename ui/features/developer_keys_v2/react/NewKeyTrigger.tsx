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

// @ts-expect-error
import {View} from '@instructure/ui-view'

// @ts-expect-error
import {Button} from '@instructure/ui-buttons'
// @ts-expect-error
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
// @ts-expect-error
import {IconPlusLine} from '@instructure/ui-icons'
import {NewKeyButtons} from './NewKeyButtons'

import {useScope as createI18nScope} from '@canvas/i18n'
import React from 'react'

const I18n = createI18nScope('react_developer_keys')

interface DeveloperKeyModalTriggerProps {
  store: {
    dispatch: (action: any) => void
  }
  actions: {
    developerKeysModalOpen: (type: string) => any
    ltiKeysSetLtiKey: (value: boolean) => any
  }
  setAddKeyButtonRef: (node: HTMLButtonElement | null) => void
}

export default class DeveloperKeyModalTrigger extends React.Component<DeveloperKeyModalTriggerProps> {
  showCreateDeveloperKey = () => {
    this.props.store.dispatch(this.props.actions.developerKeysModalOpen('api'))
  }

  showCreateLtiKey = () => {
    this.props.store.dispatch(this.props.actions.ltiKeysSetLtiKey(true))
    this.props.store.dispatch(this.props.actions.developerKeysModalOpen('lti'))
  }

  triggerButton() {
    return (
      <div>
        <Button
          data-pendo="add-developer-key-button"
          id="add-developer-key-button"
          color="primary"
          elementRef={this.props.setAddKeyButtonRef}
          renderIcon={IconPlusLine}
          disabled={ENV.devKeysReadOnly}
          title={
            ENV.devKeysReadOnly
              ? I18n.t(
                  'You do not have permission to create or modify developer keys in this account',
                )
              : undefined
          }
        >
          <ScreenReaderContent>{I18n.t('Create a')}</ScreenReaderContent>
          {I18n.t('Developer Key')}
        </Button>
      </div>
    )
  }

  developerKeyTrigger() {
    return (
      <NewKeyButtons
        triggerButton={this.triggerButton()}
        showCreateDeveloperKey={this.showCreateDeveloperKey}
        showCreateLtiKey={this.showCreateLtiKey}
      />
    )
  }

  render() {
    return (
      <View as="div" padding="small" textAlign="end">
        {this.developerKeyTrigger()}
      </View>
    )
  }
}
