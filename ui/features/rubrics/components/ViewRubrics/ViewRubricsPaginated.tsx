/*
 * Copyright (C) 2024 - present Instructure, Inc.
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

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import {useScope as createI18nScope} from '@canvas/i18n'
import {LoadingIndicator} from '@instructure/platform-loading-indicator'
import {Button} from '@instructure/ui-buttons'
import {Flex} from '@instructure/ui-flex'
import {Heading} from '@instructure/ui-heading'
import {IconAddLine, IconImportLine, IconDownloadLine} from '@instructure/ui-icons'
import {Tabs} from '@instructure/ui-tabs'
import {View} from '@instructure/ui-view'
import {RubricTable, type RubricSortColumn} from './RubricTable'
import {RubricsInfiniteFooter} from './RubricsInfiniteFooter'
import {RubricsSearchInput} from './RubricsSearchInput'
import {useRubricsQuery} from './useRubricsQuery'
import {Responsive} from '@instructure/ui-responsive'
import {canvas} from '@instructure/ui-themes'
import {
  fetchRubricCriterion,
  fetchRubricUsedLocations,
  archiveRubric,
  unarchiveRubric,
  downloadRubrics,
  type RubricSortInput,
} from '../../queries/ViewRubricQueries'
import {RubricAssessmentTray} from '@canvas/rubrics/react/RubricAssessment'
import {showFlashAlert, showFlashError, showFlashSuccess} from '@instructure/platform-alerts'
import {type FetchUsedLocationResponse, UsedLocationsModal} from './UsedLocationsModal'
import {ImportRubric} from './ImportRubric'
import {colors} from '@instructure/canvas-theme'
import {useQuery} from '@tanstack/react-query'
import {TABS, type ViewRubricsProps} from './shared'

const {Item: FlexItem} = Flex

const I18n = createI18nScope('rubrics-list-view')

const ACTIVE_WORKFLOW_STATES = ['active', 'draft']
const ARCHIVED_WORKFLOW_STATES = ['archived']

const SORT_COLUMN_TO_FIELD: Record<RubricSortColumn, RubricSortInput['field']> = {
  Title: 'title',
  TotalPoints: 'points_possible',
  Criterion: 'criteria_count',
  LocationUsed: 'has_rubric_associations',
}

export const ViewRubricsPaginated = ({
  canManageRubrics = false,
  showHeader = true,
}: ViewRubricsProps) => {
  const navigate = useNavigate()
  const {accountId, courseId} = useParams()
  const [selectedTab, setSelectedTab] = useState<string | undefined>(TABS.saved)
  const [isPreviewTrayOpen, setIsPreviewTrayOpen] = useState(false)
  const [rubricIdForPreview, setRubricIdForPreview] = useState<string | undefined>(undefined)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortedColumn, setSortedColumn] = useState<RubricSortColumn>('Title')
  const [sortDirection, setSortDirection] = useState<'ascending' | 'descending'>('ascending')
  const [rubricIdForLocations, setRubricIdForLocations] = useState<string>()
  const [loadingUsedLocations, setLoadingUsedLocations] = useState(false)
  const [importTrayIsOpen, setImportTrayIsOpen] = useState(false)
  const [selectedRubricIds, setSelectedRubricIds] = useState<string[]>([])

  const workflowStates =
    selectedTab === TABS.saved ? ACTIVE_WORKFLOW_STATES : ARCHIVED_WORKFLOW_STATES
  const sort: RubricSortInput = useMemo(
    () => ({field: SORT_COLUMN_TO_FIELD[sortedColumn], direction: sortDirection}),
    [sortedColumn, sortDirection],
  )

  const handleSort = useCallback((columnId: RubricSortColumn) => {
    setSortedColumn(prevColumn => {
      if (prevColumn === columnId) {
        setSortDirection(d => (d === 'ascending' ? 'descending' : 'ascending'))
        return prevColumn
      }
      setSortDirection('ascending')
      return columnId
    })
  }, [])

  const handleCheckboxChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, rubricId: string) => {
      setSelectedRubricIds(prev =>
        event.target.checked ? [...prev, rubricId] : prev.filter(id => id !== rubricId),
      )
    },
    [],
  )

  const handleDownloadRubrics = async () => {
    try {
      await downloadRubrics(courseId, accountId, selectedRubricIds)
    } catch (error) {
      showFlashError(I18n.t('Error Downloading Rubrics'))()
    }
  }

  const path = useRef<string | undefined>(undefined)

  const {
    rubrics,
    totalCount,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    invalidate: invalidateRubrics,
  } = useRubricsQuery({
    selectedTab,
    searchTerm: debouncedSearch,
    sort,
    workflowStates,
  })

  // When the user clicks "Load More", capture where the new batch starts so we
  // can move keyboard focus to the first newly-loaded row once the fetch lands.
  const newBatchStartIndexRef = useRef<number | null>(null)

  const handleLoadMore = () => {
    newBatchStartIndexRef.current = rubrics.length
    fetchNextPage()
  }

  useEffect(() => {
    if (isFetchingNextPage) return
    const startIndex = newBatchStartIndexRef.current
    if (startIndex == null) return
    newBatchStartIndexRef.current = null

    const firstNewRubric = rubrics[startIndex]
    if (!firstNewRubric) return

    const addedCount = rubrics.length - startIndex
    showFlashAlert({
      message: I18n.t(
        {one: 'Loaded 1 more rubric', other: 'Loaded %{count} more rubrics'},
        {count: addedCount},
      ),
      srOnly: true,
      politeness: 'polite',
    })

    document.getElementById(`rubric-select-checkbox-${firstNewRubric.id}`)?.focus()
  }, [isFetchingNextPage, rubrics])

  const handleArchiveRubric = useCallback(
    async (rubricId: string) => {
      try {
        await archiveRubric(rubricId)
        await invalidateRubrics()
        showFlashSuccess(I18n.t('Rubric archived successfully'))()
      } catch (_error) {
        showFlashError(I18n.t('Error Archiving Rubric'))()
      }
    },
    [invalidateRubrics],
  )

  const handleUnarchiveRubric = useCallback(
    async (rubricId: string) => {
      try {
        await unarchiveRubric(rubricId)
        await invalidateRubrics()
        showFlashSuccess(I18n.t('Rubric un-archived successfully'))()
      } catch (_error) {
        showFlashError(I18n.t('Error Un-Archiving Rubric'))()
      }
    },
    [invalidateRubrics],
  )

  const {data: rubricPreview, isLoading: isLoadingPreview} = useQuery({
    queryKey: [`rubric-preview-${rubricIdForPreview}`],
    queryFn: async () => fetchRubricCriterion(rubricIdForPreview),
    enabled: !!rubricIdForPreview,
  })

  const handlePreviewClick = useCallback((rubricId: string) => {
    setRubricIdForPreview(prev => {
      if (prev === rubricId) {
        setIsPreviewTrayOpen(false)
        return undefined
      }
      setIsPreviewTrayOpen(true)
      return rubricId
    })
  }, [])

  const handleLocationsClick = useCallback((rubricId: string) => {
    setRubricIdForLocations(prev => (prev === rubricId ? undefined : rubricId))
  }, [])

  const handleLocationsUsedModalClose = () => {
    setRubricIdForLocations(undefined)
    path.current = undefined
  }

  const executeFetchLocations = async (): Promise<FetchUsedLocationResponse> => {
    setLoadingUsedLocations(true)
    try {
      const usedLocations = await fetchRubricUsedLocations({
        accountId,
        courseId,
        id: rubricIdForLocations,
        nextPagePath: path.current,
      })

      path.current = usedLocations?.nextPage
      setLoadingUsedLocations(false)
      return usedLocations
    } catch (error) {
      setLoadingUsedLocations(false)
      throw error
    }
  }

  const handleImportSuccess = async () => {
    await invalidateRubrics()
  }

  const showTableSpinner = isFetching && !isFetchingNextPage

  const renderTable = (active: boolean) => {
    if (showTableSpinner) {
      return (
        <View as="div" padding="x-large" textAlign="center">
          <LoadingIndicator />
        </View>
      )
    }
    return (
      <RubricTable
        handleCheckboxChange={handleCheckboxChange}
        selectedRubricIds={selectedRubricIds}
        canManageRubrics={canManageRubrics}
        rubrics={rubrics}
        onLocationsClick={handleLocationsClick}
        onPreviewClick={handlePreviewClick}
        handleArchiveRubricChange={active ? handleArchiveRubric : handleUnarchiveRubric}
        active={active}
        sortedColumn={sortedColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
      />
    )
  }

  const renderInfiniteFooter = () =>
    showTableSpinner ? null : (
      <RubricsInfiniteFooter
        loadedCount={rubrics.length}
        totalCount={totalCount}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={handleLoadMore}
      />
    )

  return (
    <Responsive
      match="media"
      query={{
        expanded: {minWidth: canvas.breakpoints.medium},
      }}
      render={(_, matches) => {
        const expanded = matches?.includes('expanded')
        return (
          <View as="div">
            <Flex
              justifyItems="end"
              gap="small medium"
              wrap="wrap"
              direction={expanded ? 'row' : 'column'}
            >
              {showHeader && (
                <FlexItem shouldGrow={true}>
                  <Heading level="h1" themeOverride={{h1FontWeight: 700}} margin="medium 0 0 0">
                    {I18n.t('Rubrics')}
                  </Heading>
                </FlexItem>
              )}
              <FlexItem>
                <RubricsSearchInput onDebouncedChange={setDebouncedSearch} />
              </FlexItem>
              <FlexItem>
                {canManageRubrics && (
                  <Button
                    renderIcon={<IconImportLine />}
                    color="secondary"
                    data-testid="import-rubric-button"
                    onClick={() => setImportTrayIsOpen(true)}
                  >
                    {I18n.t('Import Rubric')}
                  </Button>
                )}
              </FlexItem>
              <FlexItem>
                {canManageRubrics && (
                  <Button
                    renderIcon={<IconAddLine />}
                    color="primary"
                    onClick={() => navigate('./create')}
                    data-testid="create-new-rubric-button"
                  >
                    {I18n.t('Create New Rubric')}
                  </Button>
                )}
              </FlexItem>
            </Flex>

            <Tabs
              margin="large auto"
              padding="medium"
              onRequestTabChange={(_e: any, {id}: {id?: string}) => setSelectedTab(id)}
            >
              <Tabs.Panel
                id={TABS.saved}
                data-testid="saved-rubrics-panel"
                renderTitle={I18n.t('Saved')}
                isSelected={selectedTab === TABS.saved}
                padding="none"
              >
                <View as="div" margin="medium 0" data-testid="saved-rubrics-table">
                  {renderTable(true)}
                  {renderInfiniteFooter()}
                </View>
              </Tabs.Panel>
              <Tabs.Panel
                id={TABS.archived}
                data-testid="archived-rubrics-panel"
                renderTitle={I18n.t('Archived')}
                isSelected={selectedTab === TABS.archived}
                padding="none"
              >
                <View as="div" margin="medium 0" data-testid="archived-rubrics-table">
                  {renderTable(false)}
                  {renderInfiniteFooter()}
                </View>
              </Tabs.Panel>
            </Tabs>

            <div
              id="enhanced-rubric-builder-footer"
              style={{backgroundColor: colors.contrasts.white1010}}
            >
              <View
                as="div"
                margin="small large"
                themeOverride={{marginLarge: '48px', marginSmall: '12px'}}
              >
                <Flex justifyItems="end">
                  <Flex.Item margin="0 medium 0 0">
                    <Button
                      onClick={() => setSelectedRubricIds([])}
                      data-testid="cancel-select-mode-button"
                    >
                      {I18n.t('Cancel')}
                    </Button>
                  </Flex.Item>

                  <Flex.Item margin="0 medium 0 0">
                    <Button
                      color="primary"
                      renderIcon={<IconDownloadLine />}
                      data-testid="download-rubrics"
                      disabled={selectedRubricIds.length === 0}
                      onClick={handleDownloadRubrics}
                    >
                      {I18n.t('Download Selected Rubrics')}
                    </Button>
                  </Flex.Item>
                </Flex>
              </View>
            </div>

            <RubricAssessmentTray
              currentUserId={ENV.current_user_id ?? ''}
              isLoading={isLoadingPreview}
              isOpen={isPreviewTrayOpen}
              isPreviewMode={false}
              hidePoints={rubricPreview?.hidePoints ?? false}
              rubric={rubricPreview}
              rubricAssessmentData={[]}
              onDismiss={() => {
                setRubricIdForPreview(undefined)
                setIsPreviewTrayOpen(false)
              }}
            />

            <UsedLocationsModal
              isLoading={loadingUsedLocations}
              fetchUsedLocations={executeFetchLocations}
              itemId={rubricIdForLocations}
              isOpen={!!rubricIdForLocations}
              onClose={handleLocationsUsedModalClose}
            />

            <ImportRubric
              accountId={accountId}
              courseId={courseId}
              isTrayOpen={importTrayIsOpen}
              handleImportSuccess={handleImportSuccess}
              handleTrayClose={() => setImportTrayIsOpen(false)}
            />
          </View>
        )
      }}
    />
  )
}
