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

// This test relies on types from codegen, generated with "yarn run graphql:codegen":
// It makes sure the Zod types we use actually correspond to the GraphQL queries.
import {visit, type FieldNode} from 'graphql'
import {GetCourseAssignmentsAssetReportsQuery} from '@canvas/graphql/codegen/graphql'
import {
  COURSE_ASSIGNMENTS_ASSET_REPORTS_QUERY,
  ZGetCourseAssignmentsAssetReportsResult,
  type GetCourseAssignmentsAssetReportsResult,
} from '../getCourseAssignmentsAssetReports'

// LegacyNode codegen types are weird and the codegen type shows that the query
// can return many types of objects. Just do our type checks on the results
// that can really happen (a course with assignments
type GetCourseAssignmentsAssetReportsQueryLegacyNodeTypeSelected =
  GetCourseAssignmentsAssetReportsQuery & {legacyNode: {__typename: 'Course'}}
type GetCourseAssignmentsAssetReportsResultNodeTypeSelected =
  GetCourseAssignmentsAssetReportsResult & {legacyNode: {__typename: 'Course'}}

type DeepNonNullable<T> = T extends object
  ? {[K in keyof T]-?: DeepNonNullable<NonNullable<T[K]>>}
  : NonNullable<T>
type DeepRequired<T> = T extends object
  ? {[K in keyof T]-?: DeepRequired<NonNullable<T[K]>>}
  : NonNullable<T>

describe('GetCourseAssignmentsAssetReportsResult', () => {
  const zodQuery: DeepRequired<
    DeepNonNullable<GetCourseAssignmentsAssetReportsResultNodeTypeSelected>
  > = {
    __typename: 'Query',
    legacyNode: {
      __typename: 'Course',
      assignmentsConnection: {
        __typename: 'AssignmentConnection',
        nodes: [
          {
            __typename: 'Assignment',
            _id: '1234',
            name: 'Test Assignment',
            ltiAssetProcessorsConnection: {
              __typename: 'LtiAssetProcessorConnection',
              nodes: [
                {
                  __typename: 'LtiAssetProcessor',
                  _id: '2000',
                  title: 'CourseAssetProcessor1',
                  iconOrToolIconUrl: '',
                  externalTool: {
                    __typename: 'ExternalTool',
                    _id: '223',
                    name: 'CourseTool1',
                    labelFor: 'CourseToolTitle1',
                  },
                },
              ],
            },
            submissionsConnection: {
              __typename: 'SubmissionConnection',
              nodes: [
                {
                  __typename: 'Submission',
                  _id: '5678',
                  submissionType: 'online_text_entry',
                  ltiAssetReportsConnection: {
                    __typename: 'LtiAssetReportConnection',
                    nodes: [
                      {
                        __typename: 'LtiAssetReport',
                        _id: '9999',
                        comment: 'comment for Course Assignment Report',
                        errorCode: '',
                        indicationAlt: '',
                        indicationColor: '',
                        launchUrlPath: '/launch/report/9999',
                        priority: 1,
                        processingProgress: 'Processed',
                        processorId: '2000',
                        resubmitAvailable: false,
                        result: '',
                        resultTruncated: '',
                        title: 'Course Assignment Report',
                        asset: {
                          __typename: 'LtiAsset',
                          attachmentId: '',
                          attachmentName: 'test-file.txt',
                          submissionAttempt: 1,
                          discussionEntryVersion: {
                            __typename: 'DiscussionEntryVersion',
                            _id: 'dev-4',
                            messageIntro: 'Test discussion entry message for course assignment',
                            createdAt: '2023-01-01T00:00:00Z',
                          },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
        pageInfo: {
          __typename: 'PageInfo',
          endCursor: 'cursor123',
          hasPreviousPage: false,
          hasNextPage: true,
          startCursor: 'cursor456',
        },
      },
    },
  }

  it('defines a zod schema compatible with the GraphQL type', () => {
    // Most of the magic in this test is in the Typescript checking.
    // This test relies on types from codegen, generated with "yarn run graphql:codegen"
    //
    // This part was tricky to get right; if it turns out to be tedious to
    // maintain, we can think about either using the codgen types directly in
    // the code (at the time of writing only tests use codegen types in
    // Canvas), or have a looser test, such as making sure the zod strict
    // parsing of Codegen type returns the same value
    const codegenQuery: DeepRequired<
      DeepNonNullable<GetCourseAssignmentsAssetReportsQueryLegacyNodeTypeSelected>
    > = zodQuery
    const zodQuery2: DeepRequired<
      DeepNonNullable<GetCourseAssignmentsAssetReportsResultNodeTypeSelected>
    > = codegenQuery
    const looseZodQuery: GetCourseAssignmentsAssetReportsResultNodeTypeSelected = zodQuery2
    const looseCodegenQuery: GetCourseAssignmentsAssetReportsQueryLegacyNodeTypeSelected =
      looseZodQuery
    const looseZodQuery2: GetCourseAssignmentsAssetReportsResultNodeTypeSelected = looseCodegenQuery

    // Also, parsed query should be compatible with the GraphQL type, and all fields should be present
    const zodParsed = ZGetCourseAssignmentsAssetReportsResult.parse(zodQuery)
    const legacyNodeParsed = zodParsed.legacyNode
    if (legacyNodeParsed) {
      const zodParsedLegacyNodeOfCodegenType: GetCourseAssignmentsAssetReportsQueryLegacyNodeTypeSelected['legacyNode'] =
        {
          ...legacyNodeParsed,
          __typename: 'Course',
        }
      expect(zodParsedLegacyNodeOfCodegenType).toEqual(looseZodQuery2.legacyNode)
    }
  })
})

describe('COURSE_ASSIGNMENTS_ASSET_REPORTS_QUERY complexity guards', () => {
  const EXEMPT_CONNECTIONS = new Set(['assignmentsConnection'])

  it('caps every nested connection with an explicit `first` argument', () => {
    const offenders: string[] = []
    visit(COURSE_ASSIGNMENTS_ASSET_REPORTS_QUERY, {
      Field(node: FieldNode) {
        if (!node.name.value.endsWith('Connection')) return
        if (EXEMPT_CONNECTIONS.has(node.name.value)) return
        const hasFirst = node.arguments?.some(a => a.name.value === 'first')
        if (!hasFirst) offenders.push(node.name.value)
      },
    })
    expect(offenders).toEqual([])
  })

  it('keeps submissionsConnection at first: 1 (safe due to unique (user_id, assignment_id) index)', () => {
    let submissionsFirst: number | undefined
    visit(COURSE_ASSIGNMENTS_ASSET_REPORTS_QUERY, {
      Field(node: FieldNode) {
        if (node.name.value !== 'submissionsConnection') return
        const arg = node.arguments?.find(a => a.name.value === 'first')
        if (arg?.value.kind === 'IntValue') submissionsFirst = Number(arg.value.value)
      },
    })
    expect(submissionsFirst).toBe(1)
  })
})
