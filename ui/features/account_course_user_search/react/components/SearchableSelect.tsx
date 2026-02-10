/*
 * Copyright (C) 2020 - present Instructure, Inc.
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
import React, {useState, useEffect} from 'react'
import {bool, func, node, oneOfType, string} from 'prop-types'
import {Select} from '@instructure/ui-select'
import {Alert} from '@instructure/ui-alerts'
import {Spinner} from '@instructure/ui-spinner'
import {uid} from '@instructure/uid'

const I18n = createI18nScope('managed_course_selector')

const NO_OPTIONS_OPTION_ID = '___noOptionsOption__'
const liveRegion = () => document.getElementById('flash_screenreader_holder')

// Regular expression special character escaper
const reEscapeMatcher = /(\^|\$|\|\.|\*|\+|\?|\(|\)|\[|\]|\{|\}|\||\\)/g
const reEscape = (str: string) => str.replace(reEscapeMatcher, '\\$1')

const SearchableSelectOption = () => <div />
SearchableSelectOption.propTypes = {
  id: string.isRequired,
  value: string.isRequired,
  children: node.isRequired,
}
SearchableSelectOption.displayName = 'Option'

const SearchableSelectGroup = () => <div />
SearchableSelectGroup.propTypes = {
  label: string.isRequired,
}
SearchableSelectGroup.displayName = 'Group'

type SearchableSelectOptionProps = {
  id: string
  value: string
  children: React.ReactNode
}

type SearchableSelectGroupProps = {
  id?: string
  label: string
  children?: React.ReactNode
}

type FlattenedOption = {
  id: string
  value: string
  name: string
}

function isDisplayNamedElement(
  el: unknown,
  displayName: 'Option' | 'Group',
): el is React.ReactElement {
  if (!React.isValidElement(el)) return false
  const t = el.type as unknown as {displayName?: string}
  return t?.displayName === displayName
}

function flattenOptions(nodes: React.ReactNode): Array<React.ReactElement<SearchableSelectOptionProps>> {
  const options: Array<React.ReactElement<SearchableSelectOptionProps>> = []

  React.Children.forEach(nodes, n => {
    if (Array.isArray(n)) {
      options.push(...flattenOptions(n))
    } else if (isDisplayNamedElement(n, 'Group')) {
      const groupNode = n as React.ReactElement<SearchableSelectGroupProps>
      options.push(...flattenOptions(groupNode.props.children))
    } else if (isDisplayNamedElement(n, 'Option')) {
      options.push(n as React.ReactElement<SearchableSelectOptionProps>)
    }
  })
  return options
}

type SearchableSelectMessage = {type: string; text: string}

type SearchableSelectProps = {
  id: string
  isLoading?: boolean
  value?: string
  onChange: (event: unknown, selectedOption: FlattenedOption) => void
  label?: React.ReactNode | (() => React.ReactNode)
  placeholder?: string
  matchAnywhere?: boolean
  noResultsLabel?: string
  noSearchMatchLabel?: string
  children?: React.ReactNode
}

function SearchableSelect(props: SearchableSelectProps) {
  const {id: selectId, value, children, isLoading, onChange, label, matchAnywhere} = props
  const noResultsLabel = props.noResultsLabel || I18n.t('No results')
  const noSearchMatchLabel = props.noSearchMatchLabel || I18n.t('No matches to your search')
  const placeholder = props.placeholder || I18n.t('Begin typing to search')

  const [inputValue, setInputValue] = useState('')
  const [matcher, setMatcher] = useState(new RegExp(''))
  const [messages, setMessages] = useState<Array<SearchableSelectMessage> | null>(null)
  const [isShowingOptions, setIsShowingOptions] = useState(false)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [highlightedOptionId, setHighlightedOptionId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const options: FlattenedOption[] = flattenOptions(children).map(n => ({
    id: n.props.id,
    value: n.props.value,
    name: typeof n.props.children === 'string' ? n.props.children : '',
  }))
  const matchingOptions = options.filter(i => i.name.match(matcher))
  const noResults = React.Children.count(children) === 0

  function setSearchResultMessage(matches: boolean) {
    if (!matches) {
      setMessages([{type: 'newError', text: noSearchMatchLabel}])
      return
    }
    if (noResults) {
      setMessages([{type: 'hint', text: noResultsLabel}])
      return
    }
    setMessages(null)
  }

  useEffect(() => {
    setMatcher(new RegExp(''))
    setSelectedOptionId(null)
    setSearchResultMessage(true)
    if (!value || inputValue) return
    const initialValue = options.find(i => i.value === value)
    if (initialValue) setInputValue(initialValue.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, React.Children.count(children)])

  function matcherFor(v: string) {
    const constrain = matchAnywhere ? '' : '^(\\s*)'
    return new RegExp(constrain + reEscape(v), 'i')
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newMatcher = matcherFor(e.target.value)
    const doesAnythingMatch = options.some(i => i.name.match(newMatcher))
    setInputValue(e.target.value)
    setMatcher(newMatcher)
    setSelectedOptionId(null)
    setSearchResultMessage(doesAnythingMatch)
    setIsShowingOptions(doesAnythingMatch)
  }

  function onRequestHideOptions(event: {type: string}) {
    setIsShowingOptions(false)
    setHighlightedOptionId(null)
    if (event.type !== 'blur') setAnnouncement(I18n.t('List collapsed. ') + inputValue)
  }

  function onRequestShowOptions() {
    if (messages) return
    setIsShowingOptions(true)
    setAnnouncement(I18n.t('List expanded.'))
  }

  function onRequestHighlightOption(event: {type: string}, {id}: {id: string}) {
    const text = options.find(o => o.id === id)?.name
    if (event.type === 'keydown') setInputValue(text || '')
    setHighlightedOptionId(id)
    setAnnouncement(text || '')
  }

  function onRequestSelectOption(event: unknown, {id}: {id: string}) {
    const selectedOption = options.find(o => o.id === id)
    if (!selectedOption) return
    setInputValue(selectedOption.name)
    setMatcher(new RegExp(''))
    setSelectedOptionId(id)
    setIsShowingOptions(false)
    setAnnouncement(I18n.t('%{option} selected. List collapsed.', {option: selectedOption.name}))
    onChange(event, selectedOption)
  }

  function onBlur(e: React.FocusEvent<HTMLInputElement>) {
    // set possible selection if narrowed to a single match or disregard as no op
    const possibleSelection = matchingOptions.length === 1 ? matchingOptions[0] : false
    if (possibleSelection) {
      onRequestSelectOption(e, possibleSelection)
      setSearchResultMessage(true)
    }
  }

  function renderOptions(nodes: React.ReactNode) {
    function renderOption(optionNode: React.ReactElement<SearchableSelectOptionProps>) {
      const {id: optionId, children: optionChildren, ...rest} = optionNode.props as SearchableSelectOptionProps & Record<string, unknown>
      const opt = options.find(o => o.id === optionId)
      if (!opt || !opt.name.match(matcher)) return null
      return (
        <Select.Option
          id={optionId}
          key={optionNode.key || optionId || uid('backupKey', 4)}
          isHighlighted={optionId === highlightedOptionId}
          isSelected={optionId === selectedOptionId}
          {...rest}
        >
          {optionChildren}
        </Select.Option>
      )
    }

    function renderGroup(groupNode: React.ReactElement<SearchableSelectGroupProps>) {
      const {id: groupId, label: groupLabel, children: groupChildren, ...rest} = groupNode.props as SearchableSelectGroupProps & Record<string, unknown>
      return (
        <Select.Group
          renderLabel={() => groupLabel}
          key={groupNode.key || groupId || uid('backupKey', 4)}
          {...rest}
        >
          {React.Children.map(groupChildren, renderOption)}
        </Select.Group>
      )
    }

    const result: React.ReactNode[] = []

    React.Children.forEach(nodes, child => {
      if (Array.isArray(child)) {
        result.push(renderOptions(child))
      } else if (isDisplayNamedElement(child, 'Option')) {
        result.push(renderOption(child as React.ReactElement<SearchableSelectOptionProps>))
      } else if (isDisplayNamedElement(child, 'Group')) {
        result.push(renderGroup(child as React.ReactElement<SearchableSelectGroupProps>))
      }
    })

    return result
  }

  function renderChildren() {
    if (isLoading) {
      return (
        <Select.Option isDisabled={true} id={NO_OPTIONS_OPTION_ID}>
          <Spinner renderTitle={I18n.t('Loading options...')} size="small" />
        </Select.Option>
      )
    }

    if (messages || matchingOptions.length === 0) {
      return (
        <Select.Option isDisabled={true} id={NO_OPTIONS_OPTION_ID}>
          xxx
        </Select.Option>
      )
    }

    return renderOptions(children).filter(Boolean)
  }

  const controlProps: Record<string, unknown> = {
    id: selectId,
    inputValue,
    isShowingOptions,
    assistiveText: I18n.t('Type to search, use arrow keys to navigate options.') + ' ',
    placeholder,
    renderLabel: () => label,
    onBlur,
    messages,
    onInputChange,
    onRequestShowOptions,
    onRequestHideOptions,
    onRequestHighlightOption,
    onRequestSelectOption,
  }

  return (
    <>
      <Select {...controlProps}>{renderChildren()}</Select>
      <Alert
        screenReaderOnly={true}
        ariaAtomic={true}
        liveRegion={liveRegion}
        liveRegionPoliteness="assertive"
      >
        {announcement}
      </Alert>
    </>
  )
}

SearchableSelect.propTypes = {
  id: string.isRequired,
  isLoading: bool,
  value: string,
  onChange: func.isRequired,
  label: oneOfType([node, func]),
  placeholder: string,
  matchAnywhere: bool,
  noResultsLabel: string,
  noSearchMatchLabel: string,
  children: node,
}

SearchableSelect.defaultProps = {
  isLoading: false,
  label: <span />,
  matchAnywhere: false,
}

SearchableSelect.Option = SearchableSelectOption
SearchableSelect.Group = SearchableSelectGroup

export default SearchableSelect
