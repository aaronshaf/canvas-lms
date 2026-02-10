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
import React, {useState} from 'react'
import {groupBy, sortBy, flatten, find, map} from 'es-toolkit/compat'
import {submitHtmlForm} from '@canvas/theme-editor/submitHtmlForm'
import ThemeCard from './ThemeCard'
import doFetchApi from '@canvas/do-fetch-api-effect'
import {reloadWindow} from '@canvas/util/globalUtils'
import {Button, IconButton} from '@instructure/ui-buttons'
import {Grid} from '@instructure/ui-grid'
import {Tooltip} from '@instructure/ui-tooltip'
import {Menu} from '@instructure/ui-menu'
import {IconAddSolid, IconQuestionLine} from '@instructure/ui-icons'

const I18n = createI18nScope('theme_collection_view')

interface BrandConfig {
  md5: string
  variables: Record<string, string>
  name?: string
}

interface SharedBrandConfig {
  id?: string
  account_id?: string
  brand_config: BrandConfig
  name: string
}

interface BaseTheme {
  md5: string
  label: string
}

interface VariableDescription {
  default: string
  type: 'color' | 'image' | 'percentage'
  variable_name: string
}

interface NewThemeProps {
  onNewTheme: (_e: React.SyntheticEvent, value: string | string[]) => void
  bases: BaseTheme[]
}

function NewTheme({onNewTheme, bases}: NewThemeProps) {
  return (
    <Menu
      trigger={
        <Button renderIcon={IconAddSolid} color="primary" data-testid="new-theme-button">
          {I18n.t('Theme')}
        </Button>
      }
    >
      <Menu.Group label={I18n.t('Create theme based on') + ' \u22EF'} onSelect={onNewTheme}>
        {bases.map(base => (
          <Menu.Item key={base.md5} value={base.md5} data-testid="new-theme-menu-item">
            {base.label}
          </Menu.Item>
        ))}
      </Menu.Group>
    </Menu>
  )
}

const blankConfig: SharedBrandConfig = {
  name: I18n.t('Default Template'),
  brand_config: {
    md5: '',
    variables: {},
  },
}

const isSystemTheme = (sharedBrandConfig: SharedBrandConfig): boolean =>
  !sharedBrandConfig.account_id

interface CollectionViewProps {
  sharedBrandConfigs: SharedBrandConfig[]
  activeBrandConfig: BrandConfig | null
  accountID: string
  brandableVariableDefaults: Record<string, VariableDescription>
  baseBrandableVariables: Record<string, string>
}

export default function CollectionView(props: CollectionViewProps) {
  const {
    sharedBrandConfigs,
    activeBrandConfig,
    accountID,
    brandableVariableDefaults,
    baseBrandableVariables,
  } = props
  const [brandConfigBeingDeleted, setBrandConfigBeingDeleted] =
    useState<SharedBrandConfig | null>(null)

  function brandVariableValue(config: BrandConfig | null | undefined, name: string): string {
    const explicitValue = config?.variables[name]
    if (explicitValue) return explicitValue

    const variableInfo = brandableVariableDefaults[name]
    const _default = variableInfo?.default
    if (_default && _default[0] === '$') {
      return brandVariableValue(config, _default.substring(1))
    }
    return baseBrandableVariables[name]
  }

  function startEditing({
    md5ToActivate,
    sharedBrandConfigToStartEditing,
  }: {
    md5ToActivate?: string
    sharedBrandConfigToStartEditing?: SharedBrandConfig | false
  }) {
    if (md5ToActivate === activeBrandConfig?.md5) md5ToActivate = undefined
    if (sharedBrandConfigToStartEditing) {
      sessionStorage.setItem(
        'sharedBrandConfigBeingEdited',
        JSON.stringify(sharedBrandConfigToStartEditing),
      )
    } else {
      sessionStorage.removeItem('sharedBrandConfigBeingEdited')
    }
    submitHtmlForm(
      `/accounts/${accountID}/brand_configs/save_to_user_session`,
      'POST',
      md5ToActivate,
    )
  }

  async function deleteSharedBrandConfig(id: string) {
    await doFetchApi({
      path: `/api/v1/shared_brand_configs/${id}`,
      method: 'DELETE',
    })
    reloadWindow()
  }

  function isActiveBrandConfig(config: BrandConfig): boolean {
    if (activeBrandConfig) {
      return config.md5 === activeBrandConfig.md5
    } else {
      return config === blankConfig.brand_config
    }
  }

  function isActiveEditableTheme(config: SharedBrandConfig): boolean {
    return !isSystemTheme(config) && activeBrandConfig?.md5 === config.brand_config.md5
  }

  function multipleThemesReflectActiveOne(): boolean {
    return sharedBrandConfigs.filter(isActiveEditableTheme).length > 1
  }

  function isDeletable(config: SharedBrandConfig): boolean {
    // Globally-shared themes and the active theme (if there is only one
    // active) are not deletable.
    return (
      !isSystemTheme(config) &&
      (!isActiveBrandConfig(config.brand_config) || multipleThemesReflectActiveOne())
    )
  }

  function thingsToShow(): Record<string, SharedBrandConfig[]> {
    const showableCards: SharedBrandConfig[] = [blankConfig].concat(sharedBrandConfigs)
    const isActive = (config: SharedBrandConfig) => isActiveBrandConfig(config.brand_config)

    // Add in a tile for the active theme if it is otherwise not present in the shared ones
    if (activeBrandConfig && !find(sharedBrandConfigs, isActive)) {
      const cardForActiveBrandConfig: SharedBrandConfig = {
        brand_config: activeBrandConfig,
        name: activeBrandConfig.name || '',
        account_id: accountID,
      }
      showableCards.unshift(cardForActiveBrandConfig)
    }

    // Make sure the active theme shows up first
    const sortedCards = sortBy(showableCards, card => !isActive(card))

    // Split the globally shared themes and the ones that people in this account
    // have shared apart
    return groupBy(sortedCards, sbc =>
      isSystemTheme(sbc) ? 'globalThemes' : 'accountSpecificThemes',
    )
  }

  function renderCard(config: SharedBrandConfig) {
    function onClick() {
      const isReadOnly = isSystemTheme(config)
      startEditing({
        md5ToActivate: config.brand_config.md5,
        sharedBrandConfigToStartEditing: !isReadOnly && config,
      })
    }

    // Even if this theme's md5 is active, don't mark it as active if it is a
    // system theme and there is an account-shared theme that also matches the
    // active md5
    const active =
      isActiveBrandConfig(config.brand_config) &&
      (!isSystemTheme(config) || !sharedBrandConfigs.some(isActiveEditableTheme))

    return (
      <ThemeCard
        key={config.id + config.brand_config.md5}
        name={config.name}
        isActiveBrandConfig={active}
        showMultipleCurrentThemesMessage={active && multipleThemesReflectActiveOne()}
        getVariable={v => brandVariableValue(config.brand_config, v)}
        open={onClick}
        isDeletable={isDeletable(config)}
        isBeingDeleted={brandConfigBeingDeleted === config}
        startDeleting={() => setBrandConfigBeingDeleted(config)}
        cancelDeleting={() => setBrandConfigBeingDeleted(null)}
        onDelete={e => {
          e.preventDefault()
          deleteSharedBrandConfig(config.id!)
        }}
      />
    )
  }

  function onNewTheme(_e: React.SyntheticEvent, value: string | string[]) {
    let md5: string | undefined = Array.isArray(value) ? value[0] : value
    // massage the callback value from InstUI Menu component (see INSTUI-2429)
    if (md5 === '0') md5 = ''
    startEditing({md5ToActivate: md5})
  }

  const cards = thingsToShow()
  const bases: BaseTheme[] = flatten(
    map(['globalThemes', 'accountSpecificThemes'], coll =>
      map(cards[coll], config => ({md5: config.brand_config.md5, label: config.name})),
    ),
  )
  const explainerText = I18n.t(
    'Default templates are used as starting points for new themes and cannot be deleted.',
  )

  return (
    <>
      <Grid>
        <Grid.Row vAlign="middle" colSpacing="none">
          <Grid.Col>
            <h1>{I18n.t('Themes')}</h1>
          </Grid.Col>
          <Grid.Col width="auto">
            <NewTheme onNewTheme={onNewTheme} bases={bases} />
          </Grid.Col>
        </Grid.Row>
      </Grid>

      {cards.globalThemes && (
        <div className="ic-ThemeCard-container" data-testid="container-templates-section">
          <h2 className="ic-ThemeCard-container__Heading">
            <span className="ic-ThemeCard-container__Heading-text">
              {I18n.t('Templates')}
              <Tooltip
                style={{color: 'black'}}
                placement="top"
                renderTip={explainerText}
                on={['click', 'hover', 'focus']}
              >
                <IconButton
                  renderIcon={IconQuestionLine}
                  withBackground={false}
                  withBorder={false}
                  screenReaderLabel={explainerText}
                />
              </Tooltip>
            </span>
          </h2>

          <div className="ic-ThemeCard-container__Main">{cards.globalThemes.map(renderCard)}</div>
        </div>
      )}

      {cards.accountSpecificThemes && (
        <div className="ic-ThemeCard-container" data-testid="container-mythemes-section">
          <h2 className="ic-ThemeCard-container__Heading">
            <span className="ic-ThemeCard-container__Heading-text">{I18n.t('My Themes')}</span>
          </h2>
          <div className="ic-ThemeCard-container__Main">
            {cards.accountSpecificThemes.map(renderCard)}
          </div>
        </div>
      )}
    </>
  )
}
