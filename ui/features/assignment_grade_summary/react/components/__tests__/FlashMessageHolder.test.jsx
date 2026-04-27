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
import {render, act, waitFor} from '@testing-library/react'
import {Provider} from 'react-redux'

import * as FlashAlert from '@instructure/platform-alerts'
import * as AssignmentActions from '../../assignment/AssignmentActions'
import * as GradeActions from '../../grades/GradeActions'
import * as StudentActions from '../../students/StudentActions'
import FlashMessageHolder from '../FlashMessageHolder'
import configureStore from '../../configureStore'

vi.mock('@instructure/platform-alerts', async () => {
  const actual = await vi.importActual('@instructure/platform-alerts')
  return {
    ...actual,
    showFlashAlert: vi.fn(),
  }
})

describe('GradeSummary FlashMessageHolder', () => {
  let storeEnv
  let store
  let wrapper

  beforeEach(() => {
    storeEnv = {
      assignment: {
        courseId: '1201',
        id: '2301',
        title: 'Example Assignment',
      },
      currentUser: {
        graderId: 'teach',
        id: '1105',
      },
      graders: [
        {graderId: '1101', graderName: 'Miss Frizzle'},
        {graderId: '1102', graderName: 'Mr. Keating'},
      ],
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  function mountComponent() {
    store = configureStore(storeEnv)
    wrapper = render(
      <Provider store={store}>
        <FlashMessageHolder />
      </Provider>,
    )
  }

  describe('when students fail to load', () => {
    beforeEach(async () => {
      mountComponent()
      await act(async () => {
        store.dispatch(StudentActions.setLoadStudentsStatus(StudentActions.FAILURE))
      })
    })

    test('displays a flash alert', async () => {
      await waitFor(() => {
        expect(FlashAlert.showFlashAlert).toHaveBeenCalledTimes(1)
      })
    })

    test('uses the error type', async () => {
      await waitFor(() => {
        const {type} = FlashAlert.showFlashAlert.mock.lastCall[0]
        expect(type).toBe('error')
      })
    })

    test('includes a message about loading students', async () => {
      await waitFor(() => {
        const {message} = FlashAlert.showFlashAlert.mock.lastCall[0]
        expect(message).toContain('loading students')
      })
    })
  })

  describe('when a provisional grade selection succeeds', () => {
    beforeEach(async () => {
      mountComponent()
      const gradeInfo = {
        grade: 'A',
        graderId: '1101',
        id: '4601',
        score: 10,
        selected: false,
        studentId: '1111',
      }
      await act(async () => {
        store.dispatch(GradeActions.setSelectProvisionalGradeStatus(gradeInfo, GradeActions.SUCCESS))
      })
    })

    test('displays a flash alert', async () => {
      await waitFor(() => {
        expect(FlashAlert.showFlashAlert).toHaveBeenCalledTimes(1)
      })
    })

    test('uses the success type', async () => {
      await waitFor(() => {
        const {type} = FlashAlert.showFlashAlert.mock.lastCall[0]
        expect(type).toBe('success')
      })
    })

    test('includes a "Grade saved" message', async () => {
      await waitFor(() => {
        const {message} = FlashAlert.showFlashAlert.mock.lastCall[0]
        expect(message).toBe('Grade saved.')
      })
    })
  })

  describe('when a provisional grade selection fails', () => {
    beforeEach(async () => {
      mountComponent()
      const gradeInfo = {
        grade: 'A',
        graderId: '1101',
        id: '4601',
        score: 10,
        selected: false,
        studentId: '1111',
      }
      await act(async () => {
        store.dispatch(GradeActions.setSelectProvisionalGradeStatus(gradeInfo, GradeActions.FAILURE))
      })
    })

    test('displays a flash alert', async () => {
      await waitFor(() => {
        expect(FlashAlert.showFlashAlert).toHaveBeenCalledTimes(1)
      })
    })

    test('uses the error type', async () => {
      await waitFor(() => {
        const {type} = FlashAlert.showFlashAlert.mock.lastCall[0]
        expect(type).toBe('error')
      })
    })

    test('includes a message about saving the grade', async () => {
      await waitFor(() => {
        const {message} = FlashAlert.showFlashAlert.mock.lastCall[0]
        expect(message).toBe('There was a problem saving the grade.')
      })
    })
  })

  test('does not display a flash alert when releasing grades starts', async () => {
    mountComponent()
    await act(async () => {
      store.dispatch(AssignmentActions.setReleaseGradesStatus(AssignmentActions.STARTED))
    })
    expect(FlashAlert.showFlashAlert).toHaveBeenCalledTimes(0)
  })

  describe('when a bulk provisional grade selection succeeds', () => {
    beforeEach(async () => {
      mountComponent()
      await act(async () => {
        store.dispatch(
          GradeActions.setBulkSelectProvisionalGradesStatus('1101', GradeActions.SUCCESS),
        )
      })
    })

    test('displays a flash alert', async () => {
      await waitFor(() => {
        expect(FlashAlert.showFlashAlert).toHaveBeenCalledTimes(1)
      })
    })

    test('uses the success type', async () => {
      await waitFor(() => {
        const {type} = FlashAlert.showFlashAlert.mock.lastCall[0]
        expect(type).toBe('success')
      })
    })

    test('includes a "Grades saved" message', async () => {
      await waitFor(() => {
        const {message} = FlashAlert.showFlashAlert.mock.lastCall[0]
        expect(message).toBe('Grades saved.')
      })
    })
  })

  describe('when a bulk provisional grade selection fails', () => {
    beforeEach(async () => {
      mountComponent()
      await act(async () => {
        store.dispatch(
          GradeActions.setBulkSelectProvisionalGradesStatus('1101', GradeActions.FAILURE),
        )
      })
    })

    test('displays a flash alert', async () => {
      await waitFor(() => {
        expect(FlashAlert.showFlashAlert).toHaveBeenCalledTimes(1)
      })
    })

    test('uses the error type', async () => {
      await waitFor(() => {
        const {type} = FlashAlert.showFlashAlert.mock.lastCall[0]
        expect(type).toBe('error')
      })
    })

    test('includes a message about saving the grade', async () => {
      await waitFor(() => {
        const {message} = FlashAlert.showFlashAlert.mock.lastCall[0]
        expect(message).toBe('There was a problem saving the grades.')
      })
    })
  })

  test('does not display a flash alert when releasing grades starts (2)', async () => {
    mountComponent()
    await act(async () => {
      store.dispatch(AssignmentActions.setReleaseGradesStatus(AssignmentActions.STARTED))
    })
    expect(FlashAlert.showFlashAlert).toHaveBeenCalledTimes(0)
  })

  describe('when updating a selected grade succeeds', () => {
    beforeEach(async () => {
      mountComponent()
      const gradeInfo = {
        grade: 'A',
        graderId: '1101',
        id: '4601',
        score: 10,
        selected: true,
        studentId: '1111',
      }
      await act(async () => {
        store.dispatch(GradeActions.setUpdateGradeStatus(gradeInfo, GradeActions.SUCCESS))
      })
    })

    test('displays a flash alert', async () => {
      await waitFor(() => {
        expect(FlashAlert.showFlashAlert).toHaveBeenCalledTimes(1)
      })
    })

    test('uses the success type', async () => {
      await waitFor(() => {
        const {type} = FlashAlert.showFlashAlert.mock.lastCall[0]
        expect(type).toBe('success')
      })
    })

    test('includes a "Grade saved" message', async () => {
      await waitFor(() => {
        const {message} = FlashAlert.showFlashAlert.mock.lastCall[0]
        expect(message).toBe('Grade saved.')
      })
    })
  })

  describe('when updating a selected grade', () => {
    let gradeInfo

    beforeEach(() => {
      mountComponent()
      gradeInfo = {
        grade: 'A',
        graderId: '1101',
        id: '4601',
        score: 10,
        selected: true,
        studentId: '1111',
      }
    })

    test('does not display a flash alert when updating a selected grade starts', async () => {
      mountComponent()
      await act(async () => {
        store.dispatch(GradeActions.setUpdateGradeStatus(gradeInfo, GradeActions.STARTED))
      })
      expect(FlashAlert.showFlashAlert).toHaveBeenCalledTimes(0)
    })

    describe('when the update succeeds', () => {
      beforeEach(async () => {
        await act(async () => {
          store.dispatch(GradeActions.setUpdateGradeStatus(gradeInfo, GradeActions.SUCCESS))
        })
      })

      test('displays a flash alert', async () => {
        await waitFor(() => {
          expect(FlashAlert.showFlashAlert).toHaveBeenCalledTimes(1)
        })
      })

      test('uses the success type', async () => {
        await waitFor(() => {
          const {type} = FlashAlert.showFlashAlert.mock.lastCall[0]
          expect(type).toBe('success')
        })
      })

      test('includes a "Grade saved" message', async () => {
        await waitFor(() => {
          const {message} = FlashAlert.showFlashAlert.mock.lastCall[0]
          expect(message).toBe('Grade saved.')
        })
      })
    })

    describe('when the update fails', () => {
      beforeEach(async () => {
        await act(async () => {
          store.dispatch(GradeActions.setUpdateGradeStatus(gradeInfo, GradeActions.FAILURE))
        })
      })

      test('displays a flash alert', async () => {
        await waitFor(() => {
          expect(FlashAlert.showFlashAlert).toHaveBeenCalledTimes(1)
        })
      })

      test('uses the error type', async () => {
        await waitFor(() => {
          const {type} = FlashAlert.showFlashAlert.mock.lastCall[0]
          expect(type).toBe('error')
        })
      })

      test('includes a message about updating the grade', async () => {
        await waitFor(() => {
          const {message} = FlashAlert.showFlashAlert.mock.lastCall[0]
          expect(message).toBe('There was a problem updating the grade.')
        })
      })
    })
  })

  describe('when updating a non-selected grade', () => {
    let gradeInfo

    beforeEach(() => {
      mountComponent()
      gradeInfo = {
        grade: 'A',
        graderId: '1101',
        id: '4601',
        score: 10,
        selected: false,
        studentId: '1111',
      }
    })

    test('does not display a flash alert when the update starts', async () => {
      await act(async () => {
        store.dispatch(GradeActions.setUpdateGradeStatus(gradeInfo, GradeActions.STARTED))
      })
      expect(FlashAlert.showFlashAlert).toHaveBeenCalledTimes(0)
    })

    test('does not display a flash alert when the update succeeds', async () => {
      // The action of selecting this grade continues and will be announced upon
      // success or failure.
      await act(async () => {
        store.dispatch(GradeActions.setUpdateGradeStatus(gradeInfo, GradeActions.SUCCESS))
      })
      expect(FlashAlert.showFlashAlert).toHaveBeenCalledTimes(0)
    })

    describe('when the update fails', () => {
      beforeEach(async () => {
        await act(async () => {
          store.dispatch(GradeActions.setUpdateGradeStatus(gradeInfo, GradeActions.FAILURE))
        })
      })

      test('displays a flash alert', async () => {
        await waitFor(() => {
          expect(FlashAlert.showFlashAlert).toHaveBeenCalledTimes(1)
        })
      })

      test('uses the error type', async () => {
        await waitFor(() => {
          const {type} = FlashAlert.showFlashAlert.mock.lastCall[0]
          expect(type).toBe('error')
        })
      })

      test('includes a message about updating the grade', async () => {
        await waitFor(() => {
          const {message} = FlashAlert.showFlashAlert.mock.lastCall[0]
          expect(message).toBe('There was a problem updating the grade.')
        })
      })
    })
  })

  describe('when releasing grades succeeds', () => {
    beforeEach(async () => {
      mountComponent()
      await act(async () => {
        store.dispatch(AssignmentActions.setReleaseGradesStatus(AssignmentActions.SUCCESS))
      })
    })

    test('displays a flash alert', async () => {
      await waitFor(() => {
        expect(FlashAlert.showFlashAlert).toHaveBeenCalledTimes(1)
      })
    })

    test('uses the success type', async () => {
      await waitFor(() => {
        const {type} = FlashAlert.showFlashAlert.mock.lastCall[0]
        expect(type).toBe('success')
      })
    })

    test('includes a message about grades being released', async () => {
      await waitFor(() => {
        const {message} = FlashAlert.showFlashAlert.mock.lastCall[0]
        expect(message).toBe('Grades were successfully released to the gradebook.')
      })
    })
  })

  describe('when releasing grades fails for having already been released', () => {
    beforeEach(async () => {
      mountComponent()
      await act(async () => {
        store.dispatch(
          AssignmentActions.setReleaseGradesStatus(AssignmentActions.GRADES_ALREADY_RELEASED),
        )
      })
    })

    test('displays a flash alert', async () => {
      await waitFor(() => {
        expect(FlashAlert.showFlashAlert).toHaveBeenCalledTimes(1)
      })
    })

    test('uses the error type', async () => {
      await waitFor(() => {
        const {type} = FlashAlert.showFlashAlert.mock.lastCall[0]
        expect(type).toBe('error')
      })
    })

    test('includes a message about grades already being released', async () => {
      await waitFor(() => {
        const {message} = FlashAlert.showFlashAlert.mock.lastCall[0]
        expect(message).toBe('Assignment grades have already been released.')
      })
    })
  })

  describe('when releasing grades fails for not having all grade selections', () => {
    beforeEach(async () => {
      mountComponent()
      await act(async () => {
        store.dispatch(
          AssignmentActions.setReleaseGradesStatus(
            AssignmentActions.NOT_ALL_SUBMISSIONS_HAVE_SELECTED_GRADE,
          ),
        )
      })
    })

    test('displays a flash alert', async () => {
      await waitFor(() => {
        expect(FlashAlert.showFlashAlert).toHaveBeenCalledTimes(1)
      })
    })

    test('uses the error type', async () => {
      await waitFor(() => {
        const {type} = FlashAlert.showFlashAlert.mock.lastCall[0]
        expect(type).toBe('error')
      })
    })

    test('includes a message about grades already being released', async () => {
      await waitFor(() => {
        const {message} = FlashAlert.showFlashAlert.mock.lastCall[0]
        expect(message).toBe('All submissions must have a selected grade.')
      })
    })
  })

  describe('when releasing grades fails for some other reason', () => {
    beforeEach(async () => {
      mountComponent()
      await act(async () => {
        store.dispatch(AssignmentActions.setReleaseGradesStatus(AssignmentActions.FAILURE))
      })
    })

    test('displays a flash alert', async () => {
      await waitFor(() => {
        expect(FlashAlert.showFlashAlert).toHaveBeenCalledTimes(1)
      })
    })

    test('uses the error type', async () => {
      await waitFor(() => {
        const {type} = FlashAlert.showFlashAlert.mock.lastCall[0]
        expect(type).toBe('error')
      })
    })

    test('includes a message about grades already being released', async () => {
      await waitFor(() => {
        const {message} = FlashAlert.showFlashAlert.mock.lastCall[0]
        expect(message).toBe('There was a problem releasing grades.')
      })
    })
  })

  test('does not display a flash alert when unmuting the assignment starts', async () => {
    mountComponent()
    await act(async () => {
      store.dispatch(AssignmentActions.setUnmuteAssignmentStatus(AssignmentActions.STARTED))
    })
    expect(FlashAlert.showFlashAlert).toHaveBeenCalledTimes(0)
  })

  describe('when unmuting the assignment succeeds', () => {
    beforeEach(async () => {
      mountComponent()
      await act(async () => {
        store.dispatch(AssignmentActions.setUnmuteAssignmentStatus(AssignmentActions.SUCCESS))
      })
    })

    test('displays a flash alert', async () => {
      await waitFor(() => {
        expect(FlashAlert.showFlashAlert).toHaveBeenCalledTimes(1)
      })
    })

    test('uses the success type', async () => {
      await waitFor(() => {
        const {type} = FlashAlert.showFlashAlert.mock.lastCall[0]
        expect(type).toBe('success')
      })
    })

    test('includes a message about grades being visible to students', async () => {
      await waitFor(() => {
        const {message} = FlashAlert.showFlashAlert.mock.lastCall[0]
        expect(message).toBe('Grades for this assignment are now visible to students.')
      })
    })
  })

  describe('when unmuting the assignment fails', () => {
    beforeEach(async () => {
      mountComponent()
      await act(async () => {
        store.dispatch(AssignmentActions.setUnmuteAssignmentStatus(AssignmentActions.FAILURE))
      })
    })

    test('displays a flash alert', async () => {
      await waitFor(() => {
        expect(FlashAlert.showFlashAlert).toHaveBeenCalledTimes(1)
      })
    })

    test('uses the error type', async () => {
      await waitFor(() => {
        const {type} = FlashAlert.showFlashAlert.mock.lastCall[0]
        expect(type).toBe('error')
      })
    })

    test('includes a message about updating the assignment', async () => {
      await waitFor(() => {
        const {message} = FlashAlert.showFlashAlert.mock.lastCall[0]
        expect(message).toBe('There was a problem updating the assignment.')
      })
    })
  })
})
