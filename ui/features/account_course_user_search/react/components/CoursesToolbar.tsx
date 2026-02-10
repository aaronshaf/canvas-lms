/*
 * Copyright (C) 2015 - present Instructure, Inc.
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
import {arrayOf, string, bool, func, shape, oneOf} from 'prop-types'
import {groupBy, isEqual} from 'es-toolkit/compat'
import {IconPlusLine, IconSearchLine, IconTroubleLine} from '@instructure/ui-icons'
import {Button, IconButton} from '@instructure/ui-buttons'
import {TextInput} from '@instructure/ui-text-input'
import {Checkbox} from '@instructure/ui-checkbox'
import {Grid} from '@instructure/ui-grid'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import CanvasSelect from '@canvas/instui-bindings/react/Select'
import SearchableSelect from './SearchableSelect'
import {useScope as createI18nScope} from '@canvas/i18n'
import {propType as termsPropType, termType} from '../store/TermsStore'
import NewCourseModal from './NewCourseModal'

const I18n = createI18nScope('account_course_user_search')

type Term = {
  id: string
  name: string
  start_at?: string
  end_at?: string
}

type CoursesDraftFilters = {
  enrollment_term_id: string
  search_by: 'course' | 'teacher'
  search_term: string
  enrollment_type: string[] | null
  enrollment_workflow_state: string[] | null
  blueprint: boolean | null
  public: boolean | null
}

type CoursesToolbarProps = {
  toggleSRMessage: (show?: boolean) => void
  can_create_courses?: boolean
  onUpdateFilters: (filters: Partial<CoursesDraftFilters>) => void
  onApplyFilters: () => void
  isLoading?: boolean
  draftFilters: CoursesDraftFilters
  errors: {search_term?: string}
  terms?: {data: Term[]; loading?: boolean}
  filteredTerms: Term[]
}

type TermGroupKey = 'active' | 'future' | 'past'

function termGroup(term: Term): TermGroupKey {
  if (term.start_at && new Date(term.start_at) > new Date()) return 'future'
  if (term.end_at && new Date(term.end_at) < new Date()) return 'past'
  return 'active'
}

const termGroups = {
  active: I18n.t('Active Terms'),
  future: I18n.t('Future Terms'),
  past: I18n.t('Past Terms'),
}

const allTermsGroup = (
  <SearchableSelect.Group key="allGroup" id="allGroup" label={I18n.t('Show courses from')}>
    <SearchableSelect.Option key="all" id="all" value="">
      {I18n.t('All Terms')}
    </SearchableSelect.Option>
  </SearchableSelect.Group>
)

export default function CoursesToolbar({
  can_create_courses = window.ENV &&
    window.ENV.PERMISSIONS &&
    window.ENV.PERMISSIONS.can_create_courses,
  terms = {
    data: [],
    loading: false,
  },
  filteredTerms,
  onApplyFilters,
  onUpdateFilters,
  isLoading = false,
  errors,
  draftFilters,
  toggleSRMessage,
}: CoursesToolbarProps) {
  const groupedTerms = groupBy(filteredTerms, termGroup) as Partial<Record<TermGroupKey, Term[]>>
  const searchLabel =
    draftFilters.search_by === 'teacher'
      ? I18n.t('Search courses by teacher...')
      : I18n.t('Search courses...')

  const termOptions: React.ReactNode[] = [allTermsGroup]
  ;(Object.keys(termGroups) as TermGroupKey[]).forEach(key => {
    const termsForGroup = groupedTerms[key]
    if (!termsForGroup || termsForGroup.length === 0) return

    termOptions.push(
      <SearchableSelect.Group key={key} id={key} label={termGroups[key]}>
        {termsForGroup.map((term: Term) => (
          <SearchableSelect.Option key={term.id} id={term.id} value={term.id}>
            {term.name}
          </SearchableSelect.Option>
        ))}
      </SearchableSelect.Group>,
    )
  })
  const renderClearButton = () =>
    draftFilters.search_term.length ? (
      <IconButton
        type="button"
        size="small"
        data-testid="clear-search"
        withBackground={false}
        withBorder={false}
        screenReaderLabel="Clear search"
        onClick={() => onUpdateFilters({search_term: ''})}
      >
        <IconTroubleLine />
      </IconButton>
    ) : undefined

  return (
    <div>
      <form
        onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
          event.preventDefault()
          onApplyFilters()
        }}
        disabled={isLoading}
      >
        <Grid vAlign="top" startAt="medium">
          <Grid.Row>
            <Grid.Col>
              <Grid colSpacing="small" rowSpacing="small" startAt="large">
                <Grid.Row>
                  <Grid.Col width={4}>
                    <SearchableSelect
                      id="termFilter"
                      placeholder={I18n.t('Filter by term')}
                      isLoading={terms.loading}
                      label={<ScreenReaderContent>{I18n.t('Filter by term')}</ScreenReaderContent>}
                      value={draftFilters.enrollment_term_id}
                      onChange={(_e, {value}) => onUpdateFilters({enrollment_term_id: value})}
                    >
                      {termOptions}
                    </SearchableSelect>
                  </Grid.Col>
                  <Grid.Col width={2}>
                    <CanvasSelect
                      id="searchByFilter"
                      label={<ScreenReaderContent>{I18n.t('Search by')}</ScreenReaderContent>}
                      value={draftFilters.search_by || 'course'}
                      onChange={(_e, value) => onUpdateFilters({search_by: value})}
                    >
                      <CanvasSelect.Group
                        key="search"
                        id="searchByGroup"
                        label={I18n.t('Search by')}
                      >
                        <CanvasSelect.Option key="course" id="course" value="course">
                          {I18n.t('Course')}
                        </CanvasSelect.Option>
                        <CanvasSelect.Option key="teacher" id="teacher" value="teacher">
                          {I18n.t('Teacher')}
                        </CanvasSelect.Option>
                      </CanvasSelect.Group>
                    </CanvasSelect>
                  </Grid.Col>
                  <Grid.Col width={6}>
                    <TextInput
                      type="search"
                      renderBeforeInput={
                        <IconSearchLine inline={false} data-testid="icon-search-line" />
                      }
                      renderAfterInput={renderClearButton()}
                      renderLabel={<ScreenReaderContent>{searchLabel}</ScreenReaderContent>}
                      value={draftFilters.search_term}
                      placeholder={searchLabel}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        onUpdateFilters({search_term: e.target.value})
                      }
                      onKeyUp={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === 'Enter') {
                          toggleSRMessage(true)
                        } else {
                          toggleSRMessage(false)
                        }
                      }}
                      onBlur={() => toggleSRMessage(true)}
                      onFocus={() => toggleSRMessage(false)}
                      messages={errors.search_term && [{type: 'error', text: errors.search_term}]}
                    />
                  </Grid.Col>
                </Grid.Row>
                <Grid.Row>
                  <Grid.Col width="auto">
                    <Checkbox
                      checked={isEqual(draftFilters.enrollment_type, ['student'])}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const isChecked = e.target.checked

                        onUpdateFilters({
                          enrollment_type: isChecked ? ['student'] : null,
                          enrollment_workflow_state: isChecked
                            ? ['active', 'invited', 'pending', 'creation_pending']
                            : null,
                        })
                      }}
                      label={I18n.t('Hide courses without students')}
                    />
                  </Grid.Col>
                  <Grid.Col width="auto">
                    <Checkbox
                      checked={draftFilters.blueprint}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        onUpdateFilters({blueprint: e.target.checked ? true : null})
                      }
                      label={I18n.t('Show only blueprint courses')}
                    />
                  </Grid.Col>
                  <Grid.Col width="auto">
                    <Checkbox
                      checked={draftFilters.public}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        onUpdateFilters({public: e.target.checked ? true : null})
                      }
                      label={I18n.t('Show only public courses')}
                    />
                  </Grid.Col>
                </Grid.Row>
              </Grid>
            </Grid.Col>
            {can_create_courses && (
              <Grid.Col width="auto">
                <NewCourseModal terms={terms}>
                  <Button renderIcon={IconPlusLine} aria-label={I18n.t('Create new course')}>
                    {I18n.t('Course')}
                  </Button>
                </NewCourseModal>
              </Grid.Col>
            )}
          </Grid.Row>
        </Grid>
      </form>
    </div>
  )
}

CoursesToolbar.propTypes = {
  toggleSRMessage: func.isRequired,
  can_create_courses: bool,
  onUpdateFilters: func.isRequired,
  onApplyFilters: func.isRequired,
  isLoading: bool,
  draftFilters: shape({
    enrollment_type: arrayOf(
      oneOf(['teacher', 'student', 'ta', 'observer', 'designer']).isRequired,
    ),
    search_by: oneOf(['course', 'teacher']).isRequired,
    search_term: string.isRequired,
    enrollment_term_id: string.isRequired,
  }).isRequired,
  errors: shape({search_term: string}).isRequired,
  terms: termsPropType,
  filteredTerms: arrayOf(termType).isRequired,
}
