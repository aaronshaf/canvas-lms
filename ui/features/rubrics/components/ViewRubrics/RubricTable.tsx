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

import React from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import type {Rubric} from '@canvas/rubrics/react/types/rubric'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {Checkbox} from '@instructure/ui-checkbox'
import {Flex} from '@instructure/ui-flex'
import {Link} from '@instructure/ui-link'
import {Pill} from '@instructure/ui-pill'
import {Table} from '@instructure/ui-table'
import {useParams} from 'react-router-dom'
import {RubricPopover} from './RubricPopover'

const I18n = createI18nScope('rubrics-list-table')

const {Head, Row, Cell, ColHeader, Body} = Table

export type RubricSortColumn = 'Title' | 'TotalPoints' | 'Criterion' | 'LocationUsed'

export type RubricTableProps = {
  active: boolean
  canManageRubrics: boolean
  handleArchiveRubricChange: (rubricId: string) => void
  handleCheckboxChange: (event: React.ChangeEvent<HTMLInputElement>, rubricId: string) => void
  onLocationsClick: (rubricId: string) => void
  onPreviewClick: (rubricId: string) => void
  onSort: (columnId: RubricSortColumn) => void
  rubrics: Rubric[]
  selectedRubricIds: string[]
  sortDirection: 'ascending' | 'descending'
  sortedColumn: RubricSortColumn | undefined
}

export const RubricTable = React.memo(
  ({
    active,
    canManageRubrics,
    handleArchiveRubricChange,
    handleCheckboxChange,
    onLocationsClick,
    onPreviewClick,
    onSort,
    rubrics,
    selectedRubricIds,
    sortDirection,
    sortedColumn,
  }: RubricTableProps) => {
    const {accountId, courseId} = useParams()

    return (
      <Table caption={I18n.t('Rubrics')}>
        <Head renderSortLabel={<ScreenReaderContent>{I18n.t('Sort by')}</ScreenReaderContent>}>
          <Row>
            <ColHeader
              id="Title"
              stackedSortByLabel={I18n.t('Rubric Name')}
              onRequestSort={() => onSort('Title')}
              sortDirection={sortedColumn === 'Title' ? sortDirection : undefined}
              data-testid="rubric-name-header"
            >
              {I18n.t('Rubric Name')}
            </ColHeader>
            <ColHeader
              id="TotalPoints"
              stackedSortByLabel={I18n.t('Total Points')}
              onRequestSort={() => onSort('TotalPoints')}
              sortDirection={sortedColumn === 'TotalPoints' ? sortDirection : undefined}
              data-testid="rubric-points-header"
            >
              {I18n.t('Total Points')}
            </ColHeader>
            <ColHeader
              id="Criterion"
              stackedSortByLabel={I18n.t('Criterion')}
              onRequestSort={() => onSort('Criterion')}
              sortDirection={sortedColumn === 'Criterion' ? sortDirection : undefined}
              data-testid="rubric-criterion-header"
            >
              {I18n.t('Criteria')}
            </ColHeader>
            <ColHeader
              id="LocationUsed"
              stackedSortByLabel={I18n.t('Location Used')}
              onRequestSort={() => onSort('LocationUsed')}
              sortDirection={sortedColumn === 'LocationUsed' ? sortDirection : undefined}
              data-testid="rubric-locations-header"
            >
              {I18n.t('Location Used')}
            </ColHeader>
            <ColHeader id="Actions" tabIndex={0} data-testid="rubric-actions-header">
              {I18n.t('Actions')}
            </ColHeader>
          </Row>
        </Head>
        <Body>
          {rubrics.map((rubric, index) => (
            <Row key={rubric.id} data-testid={`rubric-row-${rubric.id}`}>
              <Cell data-testid={`rubric-title-${index}`}>
                <Flex direction="row" alignItems="center">
                  <Flex.Item margin="0 small 0 0">
                    <Checkbox
                      label={
                        <ScreenReaderContent>{`${I18n.t('Select')} ${rubric.title}`}</ScreenReaderContent>
                      }
                      value={rubric.id}
                      onChange={event => handleCheckboxChange(event, rubric.id)}
                      checked={selectedRubricIds.includes(rubric.id)}
                      data-testid={`rubric-select-checkbox-${rubric.id}`}
                      id={`rubric-select-checkbox-${rubric.id}`}
                    />
                  </Flex.Item>
                  <Flex.Item>
                    <Link
                      forceButtonRole={true}
                      isWithinText={false}
                      data-testid={`rubric-title-preview-${rubric.id}`}
                      onClick={() => onPreviewClick(rubric.id)}
                    >
                      {rubric.title}
                    </Link>
                    {rubric.workflowState === 'draft' && (
                      <Pill margin="x-small">{I18n.t('Draft')}</Pill>
                    )}
                  </Flex.Item>
                </Flex>
              </Cell>

              <Cell data-testid={`rubric-points-${index}`}>
                {rubric.hidePoints ? '--' : rubric.pointsPossible}
              </Cell>
              <Cell data-testid={`rubric-criterion-count-${index}`}>{rubric.criteriaCount}</Cell>
              <Cell data-testid={`rubric-locations-${index}`}>
                {rubric.hasRubricAssociations ? (
                  <Link
                    forceButtonRole={true}
                    isWithinText={false}
                    onClick={() => onLocationsClick(rubric.id)}
                  >
                    {I18n.t('courses and assignments')}
                  </Link>
                ) : (
                  '-'
                )}
              </Cell>
              <Cell data-testid={`rubric-options-${rubric.id}`}>
                {canManageRubrics && (
                  <RubricPopover
                    id={rubric.id}
                    title={rubric.title}
                    accountId={accountId}
                    courseId={courseId}
                    hidePoints={rubric.hidePoints}
                    criteria={rubric.criteria}
                    pointsPossible={rubric.pointsPossible}
                    buttonDisplay={rubric.buttonDisplay}
                    ratingOrder={rubric.ratingOrder}
                    freeFormCriterionComments={rubric.freeFormCriterionComments}
                    hasRubricAssociations={rubric.hasRubricAssociations}
                    onArchiveRubricChange={() => handleArchiveRubricChange(rubric.id)}
                    workflowState={rubric.workflowState}
                    active={active}
                  />
                )}
              </Cell>
            </Row>
          ))}
        </Body>
      </Table>
    )
  },
)
