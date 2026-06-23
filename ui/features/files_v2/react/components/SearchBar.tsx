/*
 * Copyright (C) 2025 - present Instructure, Inc.
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

import {useState} from 'react'
import {useTranslation} from '@canvas/i18next'
import {Button, IconButton} from '@instructure/ui-buttons'
import {IconSearchLine, IconTroubleLine} from '@instructure/ui-icons'
import {TextInput} from '@instructure/ui-text-input'
import {Text} from '@instructure/ui-text'
import {Flex} from '@instructure/ui-flex'
import {View} from '@instructure/ui-view'

const renderClearButton = (
  searchValue: string,
  handleClear: () => void,
  t: (key: string) => string,
) => {
  if (searchValue === '') return null

  return (
    <IconButton
      type="button"
      size="small"
      withBackground={false}
      withBorder={false}
      screenReaderLabel={t('Clear search')}
      onClick={handleClear}
    >
      <IconTroubleLine />
    </IconButton>
  )
}

interface SearchBarProps {
  initialValue?: string
  onSearch: (searchTerm: string) => void
}

const SearchBar = ({initialValue = '', onSearch}: SearchBarProps) => {
  const {t} = useTranslation('files_v2')
  const [searchValue, setSearchValue] = useState(initialValue)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()

    onSearch(searchValue)
  }

  const handleClear = () => {
    setSearchValue('')
  }

  return (
    <>
      <form style={{margin: 0}} name="files-search" autoComplete="off" onSubmit={handleSearch}>
        <Flex gap="small" alignItems="end">
          <Flex.Item shouldGrow shouldShrink>
            <TextInput
              renderLabel={t('Search files')}
              placeholder={t('Search files...')}
              value={searchValue}
              onChange={(_e, value) => setSearchValue(value)}
              shouldNotWrap
              // fragment fixes a weird focus issue - INSTUI-4466
              renderBeforeInput={<IconSearchLine inline={false} />}
              renderAfterInput={() => renderClearButton(searchValue, handleClear, t)}
              data-testid="files-search-input"
            />
          </Flex.Item>
          <Flex.Item>
            <Button color="secondary" type="submit" data-testid="files-search-button">
              {t('Search')}
            </Button>
          </Flex.Item>
        </Flex>
      </form>
      <View margin="x-small 0 0 0" display="block">
        <Text size="small">{t('Enter at least 2 characters to search')}</Text>
      </View>
    </>
  )
}

export default SearchBar
