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

import {useScope as createI18nScope} from '@canvas/i18n'
import React from 'react'
import PropTypes from 'prop-types'
import store from '../lib/ExternalAppsStore'
import $ from '@canvas/rails-flash-notifications'
import {ToggleButton} from '@instructure/ui-buttons'
import {Text} from '@instructure/ui-text'
import {View} from '@instructure/ui-view'
import {Flex} from '@instructure/ui-flex'
import {IconCheckMarkSolid, IconEndSolid} from '@instructure/ui-icons'
import {Spinner} from '@instructure/ui-spinner'
import {type GlobalEnv} from '@canvas/global/env/GlobalEnv'

const I18n = createI18nScope('external_tools')

declare const ENV: GlobalEnv & {
  CONTEXT_BASE_URL?: string
  FEATURES: GlobalEnv['FEATURES'] & {lti_toggle_placements?: boolean}
  PERMISSIONS: GlobalEnv['PERMISSIONS'] & {edit_tool_manually?: boolean}
}

export const ALL_PLACEMENTS = {
  analytics_hub: I18n.t('Analytics Hub'),
  account_navigation: I18n.t('Account Navigation'),
  assignment_edit: I18n.t('Assignment Edit'),
  assignment_selection: I18n.t('Assignment Selection'),
  assignment_view: I18n.t('Assignment View'),
  similarity_detection: I18n.t('Similarity Detection'),
  assignment_menu: I18n.t('Assignment Menu'),
  assignment_index_menu: I18n.t('Assignments Index Menu'),
  assignment_group_menu: I18n.t('Assignments Group Menu'),
  collaboration: I18n.t('Collaboration'),
  conference_selection: I18n.t('Conference Selection'),
  course_assignments_menu: I18n.t('Course Assignments Menu'),
  course_home_sub_navigation: I18n.t('Course Home Sub Navigation'),
  course_navigation: I18n.t('Course Navigation'),
  course_settings_sub_navigation: I18n.t('Course Settings Sub Navigation'),
  discussion_topic_menu: I18n.t('Discussion Topic Menu'),
  discussion_topic_index_menu: I18n.t('Discussions Index Menu'),
  editor_button: I18n.t('Editor Button'),
  file_menu: I18n.t('File Menu'),
  file_index_menu: I18n.t('Files Index Menu'),
  global_navigation: I18n.t('Global Navigation'),
  top_navigation: I18n.t('Top Navigation'),
  homework_submission: I18n.t('Homework Submission'),
  link_selection: I18n.t('Link Selection'),
  migration_selection: I18n.t('Migration Selection'),
  module_group_menu: I18n.t('Modules Group Menu'),
  module_index_menu: I18n.t('Modules Index Menu (Tray)'),
  module_index_menu_modal: I18n.t('Modules Index Menu (Modal)'),
  module_menu: I18n.t('Module Menu'),
  module_menu_modal: I18n.t('Module Menu (Modal)'),
  post_grades: I18n.t('Sync Grades'),
  quiz_menu: I18n.t('Quiz Menu'),
  quiz_index_menu: I18n.t('Quizzes Index Menu'),
  resource_selection: I18n.t('Resource Selection'),
  submission_type_selection: I18n.t('Submission Type Selection'),
  student_context_card: I18n.t('Student Context Card'),
  tool_configuration: I18n.t('Tool Configuration'),
  user_navigation: I18n.t('User Navigation'),
  wiki_page_menu: I18n.t('Page Menu'),
  wiki_index_menu: I18n.t('Pages Index Menu'),
  default_placements: I18n.t('Assignment and Link Selection'), // for 1.1 display only
  ActivityAssetProcessor: I18n.t('Assignment Document Processor'),
  ActivityAssetProcessorContribution: I18n.t('Discussions Document Processor'),
}

type PlacementKey = keyof typeof ALL_PLACEMENTS

type PlacementConfig = Record<string, unknown> & {enabled?: boolean}

type Tool = Record<string, unknown> & {
  version?: string
  context?: string
  context_id?: string | number
  not_selectable?: boolean
} & Partial<Record<PlacementKey, PlacementConfig>>

type ExternalToolPlacementListProps = {
  tool: Tool
  onToggleSuccess: (response: unknown, placement: PlacementKey) => void
}

type ExternalToolPlacementListState = {
  tool: Tool
  currentlyLoadingPlacements: Partial<Record<PlacementKey, boolean>>
}

type TogglePlacementsArgs = {
  tool: Tool
  placements: PlacementKey[]
  onSuccess: (response: unknown) => void
  onError: () => void
}

type ExternalAppsStore = {
  togglePlacements: (args: TogglePlacementsArgs) => void
}

const extAppStore = store as unknown as ExternalAppsStore

const DEFAULT_1_1_PLACEMENTS: PlacementKey[] = [
  'assignment_selection',
  'link_selection',
  'resource_selection',
]

const presentDefaultPlacements = (tool: Tool): PlacementKey[] =>
  DEFAULT_1_1_PLACEMENTS.filter(p => tool[p])

export default class ExternalToolPlacementList extends React.Component<
  ExternalToolPlacementListProps,
  ExternalToolPlacementListState
> {
  static propTypes = {
    tool: PropTypes.object.isRequired,
    onToggleSuccess: PropTypes.func.isRequired,
  }

  state: ExternalToolPlacementListState = {
    tool: this.props.tool,
    currentlyLoadingPlacements: {},
  }

  hideLoadingSpinner = (placement: PlacementKey) =>
    this.setState(({currentlyLoadingPlacements}) => {
      const next = {...currentlyLoadingPlacements}
      delete next[placement]
      return {currentlyLoadingPlacements: next}
    })

  showLoadingSpinner = (placement: PlacementKey) =>
    this.setState(({currentlyLoadingPlacements}) => ({
      currentlyLoadingPlacements: {...currentlyLoadingPlacements, [placement]: true},
    }))

  /**
   * toggle the status of a given placement in the tool.
   * if placement config does not have `enabled`, treat it
   * like enabled is present and true, and toggle it to false.
   *
   * cb will be called after state has been updated,
   * and can use this.state.tool
   */
  togglePlacement = (placement: PlacementKey, cb: () => void = () => {}) => {
    this.setState(({tool}) => {
      const cfg = tool[placement]
      if (!cfg) return {tool}

      cfg.enabled = Object.prototype.hasOwnProperty.call(cfg, 'enabled') ? !cfg.enabled : false
      return {tool}
    }, cb)
  }

  /**
   * toggle the 1.1 default placements and the tool's
   * not_selectable attribute.
   *
   * cb will be called after state has been updated,
   * and can use this.state.tool
   */
  toggleDefaultPlacements = (cb: () => void = () => {}) => {
    this.setState(({tool}) => {
      presentDefaultPlacements(tool).forEach(p => {
        const cfg = tool[p]
        if (!cfg) return
        cfg.enabled = !cfg.enabled
      })
      tool.not_selectable = !tool.not_selectable
      return {tool}
    }, cb)
  }

  /**
   * Toggles given placement first in the local tool state, and then in an API
   * request. Handles 1.1 default placement separately.
   *
   * Flashes error message and reverts toggle if API request fails.
   * Calls props.onToggleSuccess if API request succeeds.
   */
  handleTogglePlacement = (placement: PlacementKey) => {
    const onSuccess = (response: unknown) => {
      this.props.onToggleSuccess(response, placement)
      this.hideLoadingSpinner(placement)
    }
    const onError = () => {
      $.flashError(I18n.t('Unable to toggle placement'))
      this.hideLoadingSpinner(placement)
    }
    this.showLoadingSpinner(placement)

    const tool = this.state.tool
    if (placement === 'default_placements') {
      this.toggleDefaultPlacements(() => {
        extAppStore.togglePlacements({
          tool,
          placements: presentDefaultPlacements(tool),
          onSuccess,
          onError: () => this.toggleDefaultPlacements(onError),
        })
      })
    } else {
      this.togglePlacement(placement, () => {
        extAppStore.togglePlacements({
          tool,
          placements: [placement],
          onSuccess,
          onError: () => this.togglePlacement(placement, onError),
        })
      })
    }
  }

  /**
   * Placements should only be allowed to be toggled when:
   * 1. the tool is a 1.1 tool, since toggling is a 1.1 to 1.3 migration feature OR
   *  the `lti_toggle_placements` feature flag is enabled, which allows toggling for 1.3 tools,
   * 2. the user has permission to update the tool (teacher in a course view or admin),
   * 3. the tool is being viewed in the context in which it was installed (no
   *  toggling a root-account-level tool from a course or subaccount).
   */
  shouldShowToggleButtons = () => {
    const tool = this.state.tool
    const is11Tool = tool.version === '1.1'
    const isFlagEnabled = !!ENV.FEATURES?.lti_toggle_placements
    const canUpdateTool = !!ENV.PERMISSIONS?.edit_tool_manually
    const [_, contextType, contextId] = ENV.CONTEXT_BASE_URL?.split('/') || []
    const isEditableContext =
      contextType &&
      contextId &&
      tool.context &&
      tool.context_id &&
      contextId === tool.context_id.toString() &&
      contextType.replace(/s$/, '') === tool.context.toLowerCase()

    return (is11Tool || isFlagEnabled) && canUpdateTool && isEditableContext
  }

  /**
   * Returns placements that are defined by a 1.1 tool.
   */
  placementsFor11 = () => {
    const tool = this.state.tool
    const placements = (Object.keys(ALL_PLACEMENTS) as PlacementKey[])
      // always show default_placements in favor of specifics below
      .filter(p => tool[p] || p === 'default_placements')
      // exclude specific default placements
      .filter(p => !DEFAULT_1_1_PLACEMENTS.includes(p))

    // keep the old behavior of only displaying active placements when
    // toggles aren't present
    if (!this.shouldShowToggleButtons()) {
      return placements
        .filter(key => this.isPlacementEnabled(tool, key))
        .map(key => <div key={key}>{ALL_PLACEMENTS[key]}</div>)
    }

    return placements.map(key =>
      this.placementToggle(key, ALL_PLACEMENTS[key], this.isPlacementEnabled(tool, key)),
    )
  }

  /**
   * Returns placements that are defined by a 1.3 tool.
   */
  placementsFor13 = () => {
    const tool = this.state.tool
    const placements = (Object.keys(ALL_PLACEMENTS) as PlacementKey[]).filter(key => tool[key])

    if (this.shouldShowToggleButtons()) {
      return placements.map(key =>
        this.placementToggle(key, ALL_PLACEMENTS[key], this.isPlacementEnabled(tool, key)),
      )
    }

    return placements
      .filter(key => this.isPlacementEnabled(tool, key))
      .map(key => <div key={key}>{ALL_PLACEMENTS[key]}</div>)
  }

  /**
   * A placement without `enabled` should still be considered on by default.
   */
  isPlacementEnabled(tool: Tool, placement: PlacementKey) {
    if (tool.version === '1.1' && placement === 'default_placements') {
      return !tool.not_selectable
    }

    const cfg = tool[placement]
    return !!cfg && cfg.enabled !== false
  }

  placementToggle = (key: PlacementKey, value: string, enabled: boolean) => {
    const props = enabled
      ? ({
          status: 'unpressed',
          color: 'success',
          renderIcon: IconCheckMarkSolid,
          screenReaderLabel: I18n.t('Placement active; click to deactivate'),
          renderTooltipContent: I18n.t('Active'),
        } as const)
      : ({
          status: 'pressed',
          color: 'secondary',
          renderIcon: IconEndSolid,
          screenReaderLabel: I18n.t('Placement inactive; click to activate'),
          renderTooltipContent: I18n.t('Inactive'),
        } as const)

    return (
      <Flex justifyItems="space-between" key={key}>
        <Flex.Item>{value}</Flex.Item>
        <Flex.Item>
          {this.state.currentlyLoadingPlacements[key] ? (
            <Spinner
              renderTitle={() => I18n.t('Toggling Placement')}
              size="x-small"
              margin="x-small x-small xx-small 0" // to match the height and position of the toggle button
            />
          ) : (
            <ToggleButton
              status={props.status}
              color={props.color}
              renderIcon={props.renderIcon}
              screenReaderLabel={props.screenReaderLabel}
              renderTooltipContent={props.renderTooltipContent}
              onClick={() => this.handleTogglePlacement(key)}
            />
          )}
        </Flex.Item>
      </Flex>
    )
  }

  /**
   * Display this notice when toggles are available, since the `launch_definitions` API request
   * that gets tools available for a given placement is super-cached (because it gets loaded
   * on almost every page).
   */
  notice = () => (
    <View
      display="inline-block"
      padding="none small"
      margin="small none"
      borderWidth="none none none large"
      borderColor="info"
      maxWidth="24rem"
    >
      <Text size="small" lineHeight="condensed">
        <p style={{margin: 0}}>
          {I18n.t(
            'It may take some time for placement availability to reflect any changes made here. ' +
              'You can also clear your cache and hard refresh on pages where you expect placements to change.',
          )}
        </p>
        {this.state.tool.version === '1.3' && (
          <p style={{margin: '8px 0 0 0'}}>
            {I18n.t(
              'Changes made to placements here for 1.3 tools will be reset by any changes made to the ' +
                'LTI developer key, including changes made by Instructure to inherited LTI keys.',
            )}
          </p>
        )}
      </Text>
    </View>
  )

  render = () => {
    const placements =
      this.state.tool.version === '1.1' ? this.placementsFor11() : this.placementsFor13()

    if (!placements || placements.length === 0) {
      return I18n.t('No Placements Enabled')
    }

    if (!this.shouldShowToggleButtons()) {
      return placements
    }

    return (
      <>
        {placements}
        {this.notice()}
      </>
    )
  }
}
