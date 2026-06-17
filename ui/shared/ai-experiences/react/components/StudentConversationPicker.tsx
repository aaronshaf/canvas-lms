/*
 * Copyright (C) 2026 - present Instructure, Inc.
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

import React, {useEffect, useState} from 'react'
import {InstUISettingsProvider} from '@instructure/emotion'
import {CanvasAsyncSelect} from '@instructure/platform-instui-bindings'
import {IconSearchLine} from '@instructure/ui-icons'
import {useScope as createI18nScope} from '@canvas/i18n'
import useDebouncedSearchTerm from '@canvas/search-item-selector/react/hooks/useDebouncedSearchTerm'
import {StudentConversation} from '../../types'
import {RADIUS_SM} from '../brand'

const I18n = createI18nScope('ai_experiences_ai_conversations')

const roundedInputTheme = {componentOverrides: {TextInput: {borderRadius: RADIUS_SM}}}

const MIN_SEARCH_LENGTH = 2
const isSearchableTerm = (term: string) => term.length === 0 || term.length >= MIN_SEARCH_LENGTH

export const identifierFor = (conv: StudentConversation) => conv.id || `user_${conv.user_id}`

interface StudentConversationPickerProps {
  conversations: StudentConversation[]
  selectedIdentifier?: string
  // Display label for the current selection, so the input stays in sync when the
  // selection changes externally (e.g. via the Previous/Next buttons).
  selectedLabel?: string
  isLoading: boolean
  isLoadingMore: boolean
  onSelect: (identifier: string) => void
  onSearch: (term: string) => void
}

const StudentConversationPicker: React.FC<StudentConversationPickerProps> = ({
  conversations,
  selectedIdentifier,
  selectedLabel = '',
  isLoading,
  isLoadingMore,
  onSelect,
  onSearch,
}) => {
  const [inputValue, setInputValue] = useState(selectedLabel)
  const [isSearching, setIsSearching] = useState(false)
  const {searchTerm, setSearchTerm, searchTermIsPending} = useDebouncedSearchTerm('', {
    isSearchableTerm,
  })

  useEffect(() => {
    onSearch(searchTerm)
  }, [searchTerm, onSearch])

  // Show the selected student's name unless the user is mid-search.
  useEffect(() => {
    if (!isSearching) setInputValue(selectedLabel)
  }, [selectedLabel, isSearching])

  const handleInputChange = (_event: React.SyntheticEvent, value: string) => {
    setInputValue(value)
    setIsSearching(true)
    setSearchTerm(value)
  }

  const handleOptionSelected = (_event: React.SyntheticEvent, optionId: string) => {
    setIsSearching(false)
    const selected = conversations.find(c => identifierFor(c) === optionId)
    if (selected) setInputValue(selected.student.name)
    onSelect(optionId)
  }

  const searchableInput = isSearchableTerm(inputValue) && inputValue.length > 0
  const noOptionsLabel = searchableInput ? I18n.t('No matching students') : I18n.t('No students')

  const options = conversations.map(conv => {
    const identifier = identifierFor(conv)
    const hasConv = Boolean(conv.id)
    const label = hasConv
      ? I18n.t('%{name} ✓', {name: conv.student.name})
      : I18n.t('%{name} (no conversation)', {name: conv.student.name})
    return (
      <CanvasAsyncSelect.Option key={identifier} id={identifier} isDisabled={!hasConv}>
        {label}
      </CanvasAsyncSelect.Option>
    )
  })

  return (
    <InstUISettingsProvider theme={roundedInputTheme}>
      <CanvasAsyncSelect
        renderLabel={I18n.t('Filter by student')}
        placeholder={I18n.t('Search or select a student')}
        inputValue={inputValue}
        isLoading={isLoading || isLoadingMore || searchTermIsPending}
        selectedOptionId={selectedIdentifier}
        renderBeforeInput={<IconSearchLine inline={false} />}
        assistiveText={I18n.t('Type at least %{count} characters to search', {
          count: MIN_SEARCH_LENGTH,
        })}
        noOptionsLabel={noOptionsLabel}
        onInputChange={handleInputChange}
        onOptionSelected={handleOptionSelected}
        announcementOptionsLoaded={(count: number) =>
          I18n.t({one: '1 student loaded', other: '%{count} students loaded'}, {count})
        }
        data-testid="student-conversation-picker"
      >
        {options}
      </CanvasAsyncSelect>
    </InstUISettingsProvider>
  )
}

export default StudentConversationPicker
