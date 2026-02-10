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

import React, {useCallback, useEffect, useRef} from 'react'
import PropTypes from 'prop-types'
import {
  compact,
  difference,
  filter,
  find,
  includes,
  isDate,
  map,
  reject,
  some,
  sortBy,
  union,
  without,
} from 'es-toolkit/compat'
import $ from 'jquery'
import {Button} from '@instructure/ui-buttons'
import {PresentationContent} from '@instructure/ui-a11y-content'
import {useScope as createI18nScope} from '@canvas/i18n'
import GradingPeriodSet from './GradingPeriodSet'
import SearchGradingPeriodsField from './SearchGradingPeriodsField'
import SearchHelpers from '@canvas/util/searchHelpers'
import DateHelper from '@canvas/datetime/dateHelper'
import EnrollmentTermsDropdown from './EnrollmentTermsDropdown'
import NewGradingPeriodSetForm from './NewGradingPeriodSetForm'
import EditGradingPeriodSetForm from './EditGradingPeriodSetForm'
import SetsApi from '@canvas/grading/jquery/gradingPeriodSetsApi'
import TermsApi from '../enrollmentTermsApi'
import '@canvas/jquery/jquery.instructure_misc_plugins'
import {useSetState} from 'react-use'

const I18n = createI18nScope('GradingPeriodSetCollection')

interface Urls {
  gradingPeriodSetsURL: string
  gradingPeriodsUpdateURL: string
  enrollmentTermsURL: string
  deleteGradingPeriodURL: string
}

interface EnrollmentTerm {
  id: string
  name?: string | null
  displayName?: string | null
  gradingPeriodGroupId?: string | null
  startAt?: Date | null
  endAt?: Date | null
  createdAt?: Date | null
}

interface Permissions {
  read: boolean
  create: boolean
  update: boolean
  delete: boolean
}

interface GradingPeriod {
  id: string
  title: string
  weight?: number | null
  startDate: Date
  endDate: Date
  closeDate: Date
}

interface GradingPeriodSetModel {
  id: string
  title: string
  createdAt?: Date | null
  gradingPeriods: GradingPeriod[]
  enrollmentTermIDs: string[]
  permissions: Permissions
}

interface State {
  enrollmentTerms: EnrollmentTerm[]
  sets: GradingPeriodSetModel[]
  expandedSetIDs: string[]
  showNewSetForm: boolean
  searchText: string
  selectedTermID: string
  editSet: {
    id: string | null
    saving: boolean
  }
}

interface Props {
  readOnly: boolean
  urls: Urls
}

const presentEnrollmentTerms = function (enrollmentTerms: EnrollmentTerm[]): EnrollmentTerm[] {
  return map(enrollmentTerms, (term: EnrollmentTerm) => {
    const newTerm: EnrollmentTerm = {...term}

    if (newTerm.name) {
      newTerm.displayName = newTerm.name
    } else if (isDate(newTerm.startAt)) {
      const started = DateHelper.formatDateForDisplay(newTerm.startAt)
      newTerm.displayName = I18n.t('Term starting ') + started
    } else {
      const created = DateHelper.formatDateForDisplay(newTerm.createdAt)
      newTerm.displayName = I18n.t('Term created ') + created
    }

    return newTerm
  })
}

const getEditGradingPeriodSetRef = function (set: {id: string}): string {
  return `edit-grading-period-set-${set.id}`
}

const GradingPeriodSetCollection = ({readOnly, urls}: Props) => {
  const [state, setState] = useSetState<State>({
    enrollmentTerms: [] as EnrollmentTerm[],
    sets: [] as GradingPeriodSetModel[],
    expandedSetIDs: [] as string[],
    showNewSetForm: false,
    searchText: '',
    selectedTermID: '0',
    editSet: {
      id: null,
      saving: false,
    },
  })

  const addSetFormButtonRef = useRef<any>(null)
  const newSetFormRef = useRef<any>(null)
  const setRefs = useRef<Record<string, any>>({})

  // TODO: use TanStack Query
  useEffect(() => {
    getSets()
    getTerms()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onTermsLoaded = useCallback(
    (terms: EnrollmentTerm[]) => {
      setState({enrollmentTerms: presentEnrollmentTerms(terms as EnrollmentTerm[])})
    },
    [setState],
  )

  const onSetsLoaded = useCallback(
    (sets: GradingPeriodSetModel[]) => {
      const sortedSets = sortBy(sets, 'createdAt').reverse() as GradingPeriodSetModel[]
      setState({sets: sortedSets as GradingPeriodSetModel[]})
    },
    [setState],
  )

  const getSets = useCallback(() => {
    SetsApi.list()
      .then(sets => {
        onSetsLoaded(sets)
      })
      .catch(_ => {
        $.flashError(I18n.t('An error occured while fetching grading period sets.'))
      })
  }, [onSetsLoaded])

  const getTerms = useCallback(() => {
    TermsApi.list()
      .then(terms => {
        onTermsLoaded(terms)
      })
      .catch(_ => {
        $.flashError(I18n.t('An error occured while fetching enrollment terms.'))
      })
  }, [onTermsLoaded])

  const associateTermsWithSet = useCallback(
    (setID: string, termIDs: string[]): EnrollmentTerm[] =>
      map(state.enrollmentTerms, (term: EnrollmentTerm) => {
        if (includes(termIDs, term.id)) {
          const newTerm: EnrollmentTerm = {...term}
          newTerm.gradingPeriodGroupId = setID
          return newTerm
        } else {
          return term
        }
      }) as EnrollmentTerm[],
    [state.enrollmentTerms],
  )

  const addGradingPeriodSet = useCallback(
    (set: GradingPeriodSetModel, termIDs: string[]) => {
      setState(
        {
          sets: [set].concat(state.sets),
          expandedSetIDs: state.expandedSetIDs.concat([set.id]),
          enrollmentTerms: associateTermsWithSet(set.id, termIDs),
          showNewSetForm: false,
        },
        () => {
          addSetFormButtonRef.current?.focus()
        },
      )
    },
    [state.sets, state.expandedSetIDs, setState, associateTermsWithSet],
  )

  const onSetUpdated = useCallback(
    (updatedSet: GradingPeriodSetModel) => {
      const sets = map(state.sets, (set: GradingPeriodSetModel) =>
        set.id === updatedSet.id ? {...set, ...updatedSet} : set,
      ) as GradingPeriodSetModel[]

      const terms = map(state.enrollmentTerms, (term: EnrollmentTerm) => {
        if (includes(updatedSet.enrollmentTermIDs, term.id)) {
          return {...term, gradingPeriodGroupId: updatedSet.id}
        } else if (term.gradingPeriodGroupId === updatedSet.id) {
          return {...term, gradingPeriodGroupId: null}
        } else {
          return term
        }
      }) as EnrollmentTerm[]

      setState({sets, enrollmentTerms: terms})
      $.flashMessage(I18n.t('The grading period set was updated successfully.'))
    },
    [state.sets, state.enrollmentTerms, setState],
  )

  const setAndGradingPeriodTitles = useCallback((set: GradingPeriodSetModel): string[] => {
    const titles = map(set.gradingPeriods, 'title') as string[]
    titles.unshift(set.title)
    return compact(titles) as string[]
  }, [])

  const searchTextMatchesTitles = useCallback(
    (titles: string[]): boolean =>
      some(titles, (title: string) =>
        SearchHelpers.substringMatchRegex(state.searchText).test(title),
      ) as boolean,
    [state.searchText],
  )

  const filterSetsBySearchText = useCallback(
    (sets: GradingPeriodSetModel[], searchText: string): GradingPeriodSetModel[] => {
      if (searchText === '') return sets

      return filter(sets, (set: GradingPeriodSetModel) => {
        const titles = setAndGradingPeriodTitles(set)
        return searchTextMatchesTitles(titles)
      }) as GradingPeriodSetModel[]
    },
    [setAndGradingPeriodTitles, searchTextMatchesTitles],
  )

  const changeSearchText = useCallback(
    (searchText: string) => {
      if (searchText !== state.searchText) {
        setState({searchText})
      }
    },
    [state.searchText, setState],
  )

  const filterSetsBySelectedTerm = useCallback(
    (sets: GradingPeriodSetModel[], terms: EnrollmentTerm[], selectedTermID: string) => {
      if (selectedTermID === '0') return sets

      const activeTerm = find(terms, {id: selectedTermID}) as EnrollmentTerm | undefined
      if (!activeTerm?.gradingPeriodGroupId) return []
      const setID = activeTerm.gradingPeriodGroupId
      return filter(sets, {id: setID}) as GradingPeriodSetModel[]
    },
    [],
  )

  const changeSelectedEnrollmentTerm = useCallback(
    (event: any) => {
      setState({selectedTermID: event.target.value})
    },
    [setState],
  )

  const alertForMatchingSets = useCallback(
    (numSets: number) => {
      let msg
      if (state.selectedTermID === '0' && state.searchText === '') {
        msg = I18n.t('Showing all sets of grading periods.')
      } else {
        msg = I18n.t(
          {
            one: '1 set of grading periods found.',
            other: '%{count} sets of grading periods found.',
            zero: 'No matching sets of grading periods found.',
          },
          {count: numSets},
        )
      }
      const polite = true
      $.screenReaderFlashMessageExclusive(msg, polite)
    },
    [state.selectedTermID, state.searchText],
  )

  const getVisibleSets = useCallback(() => {
    const setsFilteredBySearchText = filterSetsBySearchText(state.sets, state.searchText)
    const visibleSets = filterSetsBySelectedTerm(
      setsFilteredBySearchText,
      state.enrollmentTerms,
      state.selectedTermID,
    )
    alertForMatchingSets(visibleSets.length)
    return visibleSets
  }, [
    state.sets,
    state.searchText,
    state.enrollmentTerms,
    state.selectedTermID,
    filterSetsBySearchText,
    filterSetsBySelectedTerm,
    alertForMatchingSets,
  ])

  const toggleSetBody = useCallback(
    (setId: string) => {
      if (includes(state.expandedSetIDs, setId)) {
        setState({expandedSetIDs: without(state.expandedSetIDs, setId)})
      } else {
        setState({expandedSetIDs: state.expandedSetIDs.concat([setId])})
      }
    },
    [state.expandedSetIDs, setState],
  )

  const editGradingPeriodSet = useCallback(
    (set: GradingPeriodSetModel) => {
      setState({editSet: {id: set.id, saving: false}})
    },
    [setState],
  )

  const nodeToFocusOnAfterSetDeletion = useCallback(
    (setID: string) => {
      const index = state.sets.findIndex(set => set.id === setID)
      if (index < 1) {
        return addSetFormButtonRef.current
      } else {
        const prevSet = state.sets[index - 1]
        return setRefs.current[`show-grading-period-set-${prevSet.id}`]?._refs.editButton
      }
    },
    [state.sets],
  )

  const removeGradingPeriodSet = useCallback(
    (setID: string) => {
      const newSets = reject(
        state.sets,
        (set: GradingPeriodSetModel) => set.id === setID,
      ) as GradingPeriodSetModel[]
      const nodeToFocus = nodeToFocusOnAfterSetDeletion(setID)
      setState({sets: newSets}, () => nodeToFocus?.focus())
    },
    [state.sets, nodeToFocusOnAfterSetDeletion, setState],
  )

  const updateSetPeriods = useCallback(
    (setID: string, gradingPeriods: GradingPeriod[]) => {
      const newSets = map(state.sets, (set: GradingPeriodSetModel) => {
        if (set.id === setID) {
          return {...set, gradingPeriods}
        }
        return set
      }) as GradingPeriodSetModel[]
      setState({sets: newSets})
    },
    [state.sets, setState],
  )

  const openNewSetForm = useCallback(() => {
    setState({showNewSetForm: true})
  }, [setState])

  const closeNewSetForm = useCallback(() => {
    setState({showNewSetForm: false}, () => {
      addSetFormButtonRef.current?.focus()
    })
  }, [setState])

  const termsBelongingToActiveSets = useCallback(() => {
    const setIDs = map(state.sets, 'id') as string[]
    return filter(state.enrollmentTerms, (term: EnrollmentTerm) => {
      const setID = term.gradingPeriodGroupId
      return setID && includes(setIDs, setID)
    }) as EnrollmentTerm[]
  }, [state.sets, state.enrollmentTerms])

  const termsNotBelongingToActiveSets = useCallback(
    () => difference(state.enrollmentTerms, termsBelongingToActiveSets()),
    [state.enrollmentTerms, termsBelongingToActiveSets],
  )

  const selectableTermsForEditSetForm = useCallback(
    (setID: string): EnrollmentTerm[] => {
      const termsBelongingToThisSet = filter(termsBelongingToActiveSets(), {
        gradingPeriodGroupId: setID,
      }) as EnrollmentTerm[]
      return union(termsNotBelongingToActiveSets(), termsBelongingToThisSet) as EnrollmentTerm[]
    },
    [termsBelongingToActiveSets, termsNotBelongingToActiveSets],
  )

  const closeEditSetForm = useCallback(
    (_id: string) => {
      setState({editSet: {id: null, saving: false}})
    },
    [setState],
  )

  const getShowGradingPeriodSetRef = useCallback(
    (set: {id: string}) => `show-grading-period-set-${set.id}`,
    [],
  )

  const renderEditGradingPeriodSetForm = useCallback(
    (set: GradingPeriodSetModel) => {
      const cancelCallback = () => {
        closeEditSetForm(set.id)
      }

      const saveCallback = (setToSave: any) => {
        setState({editSet: {...state.editSet, saving: true}})
        SetsApi.update(setToSave)
          .then((updated: GradingPeriodSetModel) => {
            onSetUpdated(updated as GradingPeriodSetModel)
            closeEditSetForm(set.id)
          })
          .catch(_ => {
            $.flashError(I18n.t('An error occured while updating the grading period set.'))
          })
      }

      return (
        <EditGradingPeriodSetForm
          key={set.id}
          ref={ref => {
            setRefs.current[getEditGradingPeriodSetRef(set)] = ref
          }}
          set={set}
          enrollmentTerms={selectableTermsForEditSetForm(set.id)}
          disabled={state.editSet.saving}
          onCancel={cancelCallback}
          onSave={saveCallback}
        />
      )
    },
    [state.editSet, setState, onSetUpdated, closeEditSetForm, selectableTermsForEditSetForm],
  )

  const renderNewGradingPeriodSetForm = useCallback(() => {
    if (state.showNewSetForm) {
      return (
        <NewGradingPeriodSetForm
          ref={newSetFormRef}
          closeForm={closeNewSetForm}
          urls={urls}
          enrollmentTerms={termsNotBelongingToActiveSets()}
          addGradingPeriodSet={addGradingPeriodSet}
        />
      )
    }
  }, [
    state.showNewSetForm,
    urls,
    termsNotBelongingToActiveSets,
    addGradingPeriodSet,
    closeNewSetForm,
  ])

  const renderAddSetFormButton = useCallback(() => {
    const disable = state.showNewSetForm || !!state.editSet.id
    if (!readOnly) {
      return (
        <Button
          ref={addSetFormButtonRef}
          color="primary"
          disabled={disable}
          onClick={openNewSetForm}
          aria-label={I18n.t('Add Set of Grading Periods')}
        >
          <PresentationContent>
            <i className="icon-plus" />
            &nbsp;
            {I18n.t('Set of Grading Periods')}
          </PresentationContent>
        </Button>
      )
    }
  }, [state.showNewSetForm, state.editSet.id, readOnly, openNewSetForm])

  const renderSets = useCallback(() => {
    const urlsForSet = {
      batchUpdateURL: urls.gradingPeriodsUpdateURL,
      gradingPeriodSetsURL: urls.gradingPeriodSetsURL,
      deleteGradingPeriodURL: urls.deleteGradingPeriodURL,
    }

    return map(getVisibleSets(), (set: GradingPeriodSetModel) => {
      if (state.editSet.id === set.id) {
        return renderEditGradingPeriodSetForm(set)
      } else {
        return (
          <GradingPeriodSet
            key={set.id}
            ref={ref => {
              setRefs.current[getShowGradingPeriodSetRef(set)] = ref
            }}
            set={set}
            gradingPeriods={set.gradingPeriods}
            urls={urlsForSet}
            actionsDisabled={!!state.editSet.id}
            readOnly={readOnly}
            permissions={set.permissions}
            terms={state.enrollmentTerms}
            expanded={includes(state.expandedSetIDs, set.id)}
            onEdit={editGradingPeriodSet}
            onDelete={removeGradingPeriodSet}
            onPeriodsChange={updateSetPeriods}
            onToggleBody={() => toggleSetBody(set.id)}
          />
        )
      }
    }) as JSX.Element[]
  }, [
    urls,
    state.editSet.id,
    state.expandedSetIDs,
    state.enrollmentTerms,
    readOnly,
    getVisibleSets,
    renderEditGradingPeriodSetForm,
    getShowGradingPeriodSetRef,
    editGradingPeriodSet,
    removeGradingPeriodSet,
    updateSetPeriods,
    toggleSetBody,
  ])

  return (
    <div>
      <div className="GradingPeriodSets__toolbar header-bar no-line ic-Form-action-box">
        <div className="ic-Form-action-box__Form">
          <div className="ic-Form-control">
            <EnrollmentTermsDropdown
              terms={termsBelongingToActiveSets()}
              changeSelectedEnrollmentTerm={changeSelectedEnrollmentTerm}
            />
          </div>

          <SearchGradingPeriodsField changeSearchText={changeSearchText} />
          <div className="ic-Form-action-box__Actions">{renderAddSetFormButton()}</div>
        </div>
      </div>

      {renderNewGradingPeriodSetForm()}
      <div id="grading-period-sets">{renderSets()}</div>
    </div>
  )
}

GradingPeriodSetCollection.propTypes = {
  readOnly: PropTypes.bool.isRequired,
  urls: PropTypes.shape({
    gradingPeriodSetsURL: PropTypes.string.isRequired,
    gradingPeriodsUpdateURL: PropTypes.string.isRequired,
    enrollmentTermsURL: PropTypes.string.isRequired,
    deleteGradingPeriodURL: PropTypes.string.isRequired,
  }).isRequired,
}

export default GradingPeriodSetCollection
