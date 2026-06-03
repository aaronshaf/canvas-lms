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
import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {FAKE_FILES, FAKE_FOLDERS, FAKE_FOLDERS_AND_FILES} from '../../../../../fixtures/fakeData'
import {type File, type Folder} from '../../../../../interfaces/File'
import MoveModal from '../MoveModal'
import {useFoldersQuery} from '../hooks'
import {FileManagementProvider} from '../../../../contexts/FileManagementContext'
import {RowFocusProvider} from '../../../../contexts/RowFocusContext'
import {createMockFileManagementContext} from '../../../../__tests__/createMockContext'
import {mockRowFocusContext} from '../../__tests__/testUtils'
import {setupServer} from 'msw/node'
import {http, HttpResponse} from 'msw'

vi.mock('../hooks', () => ({
  useFoldersQuery: vi.fn(),
}))

const server = setupServer()

let capturedRequests: Array<{path: string; body: any}> = []

const defaultProps = {
  open: true,
  onDismiss: vi.fn(),
  items: FAKE_FOLDERS_AND_FILES,
}

const renderComponent = (props: any = {}) =>
  render(
    <FileManagementProvider
      value={createMockFileManagementContext({
        rootFolder: FAKE_FOLDERS[0],
      })}
    >
      <RowFocusProvider value={mockRowFocusContext}>
        <MoveModal {...defaultProps} {...props} />
      </RowFocusProvider>
    </FileManagementProvider>,
  )

describe('MoveModal', () => {
  let flashElements: any

  beforeAll(() => server.listen())
  afterAll(() => server.close())

  beforeEach(() => {
    capturedRequests = []
    vi.mocked(useFoldersQuery).mockReturnValue({
      folders: {[FAKE_FOLDERS[1].id]: FAKE_FOLDERS[1]},
      foldersLoading: false,
      foldersError: false,
    })
    flashElements = document.createElement('div')
    flashElements.setAttribute('id', 'flash_screenreader_holder')
    flashElements.setAttribute('role', 'alert')
    document.body.appendChild(flashElements)
    server.use(
      http.get('/api/v1/folders/:folderId/folders', () => HttpResponse.json([])),
      http.get('/api/v1/folders/:folderId/all', () => HttpResponse.json([])),
      http.put('/api/v1/folders/:folderId', async ({request}) => {
        capturedRequests.push({
          path: new URL(request.url).pathname,
          body: await request.json(),
        })
        return HttpResponse.json({})
      }),
      http.put('/api/v1/files/:fileId', async ({request}) => {
        capturedRequests.push({
          path: new URL(request.url).pathname,
          body: await request.json(),
        })
        return HttpResponse.json({})
      }),
    )
  })

  afterEach(() => {
    server.resetHandlers()
    document.body.removeChild(flashElements)
    flashElements = undefined
  })

  it('renders header', async () => {
    renderComponent()
    expect(await screen.findByText('Move To...')).toBeInTheDocument()
  })

  describe('renders body', () => {
    describe('with preview', () => {
      it('for a files and folders', async () => {
        renderComponent()
        expect(
          await screen.findByText(`Selected Items (${FAKE_FOLDERS_AND_FILES.length})`),
        ).toBeInTheDocument()
      })

      it('for a file', async () => {
        renderComponent({items: [FAKE_FILES[0]]})
        expect(await screen.findByText(FAKE_FILES[0].display_name)).toBeInTheDocument()
      })

      it('for a folder', async () => {
        renderComponent({items: [FAKE_FOLDERS[0]]})
        const names = await screen.findAllByText(FAKE_FOLDERS[0].name)
        // the folder name and the tree
        expect(names).toHaveLength(2)
      })
    })

    describe('with text', () => {
      it('for a files and folders', async () => {
        renderComponent()
        expect(
          await screen.findByText('Where would you like to move these items?'),
        ).toBeInTheDocument()
      })

      it('for a file', async () => {
        renderComponent({items: [FAKE_FILES[0]]})
        expect(
          await screen.findByText('Where would you like to move this file?'),
        ).toBeInTheDocument()
      })

      it('for a folder', async () => {
        renderComponent({items: [FAKE_FOLDERS[0]]})
        expect(
          await screen.findByText('Where would you like to move this folder?'),
        ).toBeInTheDocument()
      })
    })
  })

  it('renders footer', async () => {
    renderComponent()
    expect(await screen.findByTestId('move-cancel-button')).toBeInTheDocument()
    expect(await screen.findByTestId('move-move-button')).toBeInTheDocument()
  })

  it('shows an error when there is not a selected folder', async () => {
    renderComponent()
    await userEvent.click(await screen.findByTestId('move-move-button'))
    expect(await screen.findByText('A target folder should be selected.')).toBeInTheDocument()
  })

  it('performs fetch request', async () => {
    vi.mocked(useFoldersQuery).mockReturnValue({
      folders: {[FAKE_FOLDERS[2].id]: FAKE_FOLDERS[2]},
      foldersLoading: false,
      foldersError: false,
    })

    const rootFolder = FAKE_FOLDERS[1]
    const childFolder = FAKE_FOLDERS[2]

    renderComponent()
    await userEvent.click(await screen.findByText(childFolder.name))
    await userEvent.click(await screen.findByTestId('move-move-button'))

    await waitFor(() => {
      expect(screen.getAllByText(/success/i)[0]).toBeInTheDocument()

      const folderRequest = capturedRequests.find(
        req => req.path === `/api/v1/folders/${rootFolder.id}`,
      )
      expect(folderRequest).toBeDefined()
      expect(folderRequest?.body).toEqual(
        expect.objectContaining({
          parent_folder_id: childFolder.id,
        }),
      )
    })
  })

  // Make the PUT endpoints echo back the moved item so sendMoveRequests can
  // build the exact "X successfully moved to Y." flash from the response name.
  const useEchoingMoveHandlers = (items: (File | Folder)[]) => {
    const byId = new Map(items.map(item => [item.id, item]))
    server.use(
      http.put('/api/v1/folders/:folderId', async ({request, params}) => {
        capturedRequests.push({
          path: new URL(request.url).pathname,
          body: await request.json(),
        })
        return HttpResponse.json(byId.get(params.folderId as string) ?? {})
      }),
      http.put('/api/v1/files/:fileId', async ({request, params}) => {
        capturedRequests.push({
          path: new URL(request.url).pathname,
          body: await request.json(),
        })
        return HttpResponse.json(byId.get(params.fileId as string) ?? {})
      }),
    )
  }

  describe('moving via the modal', () => {
    // covers spec/selenium/files_v2/files_folders_spec.rb:166
    it('moves a single folder into the selected target with the exact success flash', async () => {
      vi.mocked(useFoldersQuery).mockReturnValue({
        folders: {[FAKE_FOLDERS[2].id]: FAKE_FOLDERS[2]},
        foldersLoading: false,
        foldersError: false,
      })

      const movedFolder = FAKE_FOLDERS[1] // id '44', name '2nd Folder'
      const targetFolder = FAKE_FOLDERS[2] // id '47', name 'a'
      useEchoingMoveHandlers([movedFolder])

      renderComponent({items: [movedFolder]})
      await userEvent.click(await screen.findByText(targetFolder.name))
      await userEvent.click(await screen.findByTestId('move-move-button'))

      await waitFor(() => {
        const folderRequest = capturedRequests.find(
          req => req.path === `/api/v1/folders/${movedFolder.id}`,
        )
        expect(folderRequest).toBeDefined()
        expect(folderRequest?.body).toEqual(
          expect.objectContaining({parent_folder_id: targetFolder.id}),
        )
      })

      // The success flash renders in both the visible alert and the
      // screenreader live region, so match all occurrences.
      expect(
        await screen.findAllByText(
          `${movedFolder.name} successfully moved to ${targetFolder.name}.`,
        ),
      ).not.toHaveLength(0)
      expect(defaultProps.onDismiss).toHaveBeenCalled()
    })

    // covers spec/selenium/files_v2/files_folders_spec.rb:175
    it('moves multiple selected folders to the chosen target', async () => {
      vi.mocked(useFoldersQuery).mockReturnValue({
        folders: {[FAKE_FOLDERS[2].id]: FAKE_FOLDERS[2]},
        foldersLoading: false,
        foldersError: false,
      })

      const firstFolder = FAKE_FOLDERS[1] // id '44'
      const secondFolder = FAKE_FOLDERS[3] // id '43'
      const targetFolder = FAKE_FOLDERS[2] // id '47'
      useEchoingMoveHandlers([firstFolder, secondFolder])

      renderComponent({items: [firstFolder, secondFolder]})
      await userEvent.click(await screen.findByText(targetFolder.name))
      await userEvent.click(await screen.findByTestId('move-move-button'))

      await waitFor(() => {
        const firstRequest = capturedRequests.find(
          req => req.path === `/api/v1/folders/${firstFolder.id}`,
        )
        const secondRequest = capturedRequests.find(
          req => req.path === `/api/v1/folders/${secondFolder.id}`,
        )
        expect(firstRequest?.body).toEqual(
          expect.objectContaining({parent_folder_id: targetFolder.id}),
        )
        expect(secondRequest?.body).toEqual(
          expect.objectContaining({parent_folder_id: targetFolder.id}),
        )
      })

      expect(defaultProps.onDismiss).toHaveBeenCalled()
    })

    // covers spec/selenium/files_v2/files_folders_spec.rb:195
    it('moves a folder and a file together with the exact success flash for each', async () => {
      vi.mocked(useFoldersQuery).mockReturnValue({
        folders: {[FAKE_FOLDERS[2].id]: FAKE_FOLDERS[2]},
        foldersLoading: false,
        foldersError: false,
      })

      const movedFolder = FAKE_FOLDERS[1] // id '44', name '2nd Folder'
      const movedFile = FAKE_FILES[5] // id '180', 'Submitting_Assignment_Canvas.pdf'
      const targetFolder = FAKE_FOLDERS[2] // id '47', name 'a'
      useEchoingMoveHandlers([movedFolder, movedFile])

      renderComponent({items: [movedFolder, movedFile]})
      await userEvent.click(await screen.findByText(targetFolder.name))
      await userEvent.click(await screen.findByTestId('move-move-button'))

      await waitFor(() => {
        const folderRequest = capturedRequests.find(
          req => req.path === `/api/v1/folders/${movedFolder.id}`,
        )
        const fileRequest = capturedRequests.find(
          req => req.path === `/api/v1/files/${movedFile.id}`,
        )
        expect(folderRequest?.body).toEqual(
          expect.objectContaining({parent_folder_id: targetFolder.id}),
        )
        expect(fileRequest?.body).toEqual(
          expect.objectContaining({parent_folder_id: targetFolder.id}),
        )
      })

      // Each success flash renders in both the visible alert and the
      // screenreader live region, so match all occurrences.
      expect(
        await screen.findAllByText(
          `${movedFolder.name} successfully moved to ${targetFolder.name}.`,
        ),
      ).not.toHaveLength(0)
      expect(
        await screen.findAllByText(
          `${movedFile.display_name} successfully moved to ${targetFolder.name}.`,
        ),
      ).not.toHaveLength(0)
      expect(defaultProps.onDismiss).toHaveBeenCalled()
    })
  })
})
