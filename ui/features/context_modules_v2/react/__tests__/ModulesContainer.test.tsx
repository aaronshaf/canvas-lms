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

import React from 'react'
import {render} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import ModulesContainer from '../ModulesContainer'
import {ContextModuleProvider, contextModuleDefaultProps} from '../hooks/useModuleContext'
import {moduleItemsFetchQueue} from '../hooks/queries/useModuleItems'

vi.mock('../componentsTeacher/ModulesList', () => ({
  default: () => <div data-testid="modules-list-stub" />,
}))

describe('ModulesContainer', () => {
  let queryClient: QueryClient

  const setup = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    return render(
      <QueryClientProvider client={queryClient}>
        <ContextModuleProvider {...contextModuleDefaultProps} courseId="1">
          <ModulesContainer />
        </ContextModuleProvider>
      </QueryClientProvider>,
    )
  }

  afterEach(() => {
    queryClient?.clear()
  })

  describe('moduleItemsFetchQueue cleanup', () => {
    it('clears the module-items fetch queue on unmount', () => {
      const clearSpy = vi.spyOn(moduleItemsFetchQueue, 'clear')
      const {unmount} = setup()

      unmount()
      expect(clearSpy).toHaveBeenCalledTimes(1)

      clearSpy.mockRestore()
    })
  })
})
