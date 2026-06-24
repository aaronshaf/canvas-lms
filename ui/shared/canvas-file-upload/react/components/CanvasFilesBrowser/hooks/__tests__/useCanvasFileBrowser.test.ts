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

import {waitFor} from '@testing-library/react'
import {renderHook} from '@testing-library/react'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import {useCanvasFileBrowser} from '../useCanvasFileBrowser'

const server = setupServer()

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('useCanvasFileBrowser', () => {
  const mockRootFolder = {
    id: '123',
    name: 'course files',
    parent_folder_id: null,
    created_at: '2024-01-01',
  }

  const mockSubfolders = [
    {
      id: '124',
      name: 'assignments',
      parent_folder_id: '123',
      created_at: '2024-01-02',
    },
    {
      id: '125',
      name: 'resources',
      parent_folder_id: '123',
      created_at: '2024-01-03',
    },
  ]

  const mockFiles = [
    {
      id: 'file-1',
      display_name: 'syllabus.pdf',
      filename: 'syllabus.pdf',
      folder_id: '123',
      created_at: '2024-01-01',
      locked: false,
    },
    {
      id: 'file-2',
      display_name: 'schedule.pdf',
      filename: 'schedule.pdf',
      folder_id: '123',
      created_at: '2024-01-02',
      locked: false,
    },
  ]

  function setupDefaultHandlers() {
    server.use(
      http.get('/api/v1/courses/1/folders/root', () => HttpResponse.json(mockRootFolder)),
      http.get('/api/v1/folders/123/files', () => HttpResponse.json([])),
      http.get('/api/v1/folders/123/folders', () => HttpResponse.json([])),
    )
  }

  describe('initialization', () => {
    it('should initialize with empty state', () => {
      setupDefaultHandlers()
      const {result} = renderHook(() => useCanvasFileBrowser({courseID: '1'}))

      expect(result.current.loadedFolders).toEqual({})
      expect(result.current.loadedFiles).toEqual({})
      expect(result.current.error).toBeNull()
      expect(result.current.isLoading).toBe(true)
      expect(result.current.selectedFolderID).toBeNull()
    })
  })

  describe('loading root folder', () => {
    it('should load course root folder on mount', async () => {
      setupDefaultHandlers()
      const {result} = renderHook(() => useCanvasFileBrowser({courseID: '1'}))

      await waitFor(() => {
        expect(result.current.selectedFolderID).toBe('123')
        expect(result.current.loadedFolders['123']).toBeDefined()
      })
    })

    it('should set isLoading true during root folder load then false when done', async () => {
      setupDefaultHandlers()
      const {result} = renderHook(() => useCanvasFileBrowser({courseID: '1'}))

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('should load root folder files and subfolders automatically', async () => {
      let filesRequested = false
      let foldersRequested = false

      server.use(
        http.get('/api/v1/courses/1/folders/root', () => HttpResponse.json(mockRootFolder)),
        http.get('/api/v1/folders/123/files', () => {
          filesRequested = true
          return HttpResponse.json(mockFiles)
        }),
        http.get('/api/v1/folders/123/folders', () => {
          foldersRequested = true
          return HttpResponse.json(mockSubfolders)
        }),
      )

      const {result} = renderHook(() => useCanvasFileBrowser({courseID: '1'}))

      await waitFor(() => {
        expect(result.current.selectedFolderID).toBe('123')
        expect(filesRequested).toBe(true)
        expect(foldersRequested).toBe(true)
      })
    })
  })

  describe('loading folder contents', () => {
    it('should mark folder contents as loaded', async () => {
      let requestCount = 0
      server.use(
        http.get('/api/v1/courses/1/folders/root', () => HttpResponse.json(mockRootFolder)),
        http.get('/api/v1/folders/123/files', () => {
          requestCount++
          return HttpResponse.json(mockFiles)
        }),
        http.get('/api/v1/folders/123/folders', () => {
          requestCount++
          return HttpResponse.json(mockSubfolders)
        }),
      )

      const {result} = renderHook(() => useCanvasFileBrowser({courseID: '1'}))

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      const countAfterLoad = requestCount

      result.current.handleUpdateSelectedFolder('123')

      // No new requests should be made since contents are already loaded
      await waitFor(() => {
        expect(requestCount).toBe(countAfterLoad)
      })
    })

    it('should handle pagination with link headers', async () => {
      const firstPageFiles = [mockFiles[0]]
      const secondPageFiles = [mockFiles[1]]

      server.use(
        http.get('/api/v1/courses/1/folders/root', () => HttpResponse.json(mockRootFolder)),
        http.get('/api/v1/folders/123/files', ({request}) => {
          const url = new URL(request.url)
          if (url.searchParams.get('page') === '2') {
            return HttpResponse.json(secondPageFiles)
          }
          return HttpResponse.json(firstPageFiles, {
            headers: {Link: '</api/v1/folders/123/files?page=2&include=user>; rel="next"'},
          })
        }),
        http.get('/api/v1/folders/123/folders', () => HttpResponse.json([])),
      )

      const {result} = renderHook(() => useCanvasFileBrowser({courseID: '1'}))

      await waitFor(() => {
        expect(result.current.selectedFolderID).toBe('123')
      })

      await waitFor(() => {
        expect(Object.keys(result.current.loadedFiles)).toHaveLength(2)
      })
    })
  })

  describe('handleUpdateSelectedFolder', () => {
    it('should load files and folders when selecting new folder', async () => {
      let folder124FilesRequested = false
      let folder124FoldersRequested = false

      server.use(
        http.get('/api/v1/courses/1/folders/root', () => HttpResponse.json(mockRootFolder)),
        http.get('/api/v1/folders/123/files', () => HttpResponse.json([])),
        http.get('/api/v1/folders/123/folders', () => HttpResponse.json(mockSubfolders)),
        http.get('/api/v1/folders/124/files', () => {
          folder124FilesRequested = true
          return HttpResponse.json([])
        }),
        http.get('/api/v1/folders/124/folders', () => {
          folder124FoldersRequested = true
          return HttpResponse.json([])
        }),
      )

      const {result} = renderHook(() => useCanvasFileBrowser({courseID: '1'}))

      await waitFor(() => expect(result.current.loadedFolders['124']).toBeDefined())

      result.current.handleUpdateSelectedFolder('124')

      await waitFor(() => {
        expect(folder124FilesRequested).toBe(true)
        expect(folder124FoldersRequested).toBe(true)
      })
    })

    it('should not reload already-loaded folder contents', async () => {
      let folder123RequestCount = 0
      server.use(
        http.get('/api/v1/courses/1/folders/root', () => HttpResponse.json(mockRootFolder)),
        http.get('/api/v1/folders/123/files', () => {
          folder123RequestCount++
          return HttpResponse.json(mockFiles)
        }),
        http.get('/api/v1/folders/123/folders', () => {
          folder123RequestCount++
          return HttpResponse.json(mockSubfolders)
        }),
      )

      const {result} = renderHook(() => useCanvasFileBrowser({courseID: '1'}))

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      const countBefore = folder123RequestCount

      result.current.handleUpdateSelectedFolder('123')

      await waitFor(() => {
        expect(folder123RequestCount).toBe(countBefore)
      })
    })

    it('should update selectedFolderID', async () => {
      server.use(
        http.get('/api/v1/courses/1/folders/root', () => HttpResponse.json(mockRootFolder)),
        http.get('/api/v1/folders/123/files', () => HttpResponse.json([])),
        http.get('/api/v1/folders/123/folders', () => HttpResponse.json(mockSubfolders)),
        http.get('/api/v1/folders/124/files', () => HttpResponse.json([])),
        http.get('/api/v1/folders/124/folders', () => HttpResponse.json([])),
      )

      const {result} = renderHook(() => useCanvasFileBrowser({courseID: '1'}))

      await waitFor(() => expect(result.current.loadedFolders['124']).toBeDefined())

      result.current.handleUpdateSelectedFolder('124')

      await waitFor(() => {
        expect(result.current.selectedFolderID).toBe('124')
      })
    })
  })

  describe('error handling', () => {
    it('should set error state when root folder load fails', async () => {
      server.use(
        http.get('/api/v1/courses/1/folders/root', () =>
          HttpResponse.json({error: 'not found'}, {status: 500}),
        ),
      )

      const {result} = renderHook(() => useCanvasFileBrowser({courseID: '1'}))

      await waitFor(() => {
        expect(result.current.error).not.toBeNull()
      })
    })

    it('should set error state when folder contents load fails', async () => {
      server.use(
        http.get('/api/v1/courses/1/folders/root', () => HttpResponse.json(mockRootFolder)),
        http.get('/api/v1/folders/123/files', () =>
          HttpResponse.json({error: 'server error'}, {status: 500}),
        ),
        http.get('/api/v1/folders/123/folders', () =>
          HttpResponse.json({error: 'server error'}, {status: 500}),
        ),
      )

      const {result} = renderHook(() => useCanvasFileBrowser({courseID: '1'}))

      await waitFor(() => {
        expect(result.current.selectedFolderID).toBe('123')
      })

      await waitFor(() => {
        expect(result.current.error).not.toBeNull()
      })
    })

    it('should decrement pendingAPIRequests on error', async () => {
      server.use(
        http.get('/api/v1/courses/1/folders/root', () =>
          HttpResponse.json({error: 'server error'}, {status: 500}),
        ),
      )

      const {result} = renderHook(() => useCanvasFileBrowser({courseID: '1'}))

      await waitFor(() => {
        expect(result.current.error).not.toBeNull()
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  describe('derived state', () => {
    it('should calculate isLoading from pendingAPIRequests', async () => {
      let resolveFiles: () => void
      let resolveFolders: () => void

      const filesBarrier = new Promise<void>(resolve => {
        resolveFiles = resolve
      })
      const foldersBarrier = new Promise<void>(resolve => {
        resolveFolders = resolve
      })

      server.use(
        http.get('/api/v1/courses/1/folders/root', () => HttpResponse.json(mockRootFolder)),
        http.get('/api/v1/folders/123/files', async () => {
          await filesBarrier
          return HttpResponse.json(mockFiles)
        }),
        http.get('/api/v1/folders/123/folders', async () => {
          await foldersBarrier
          return HttpResponse.json(mockSubfolders)
        }),
      )

      const {result} = renderHook(() => useCanvasFileBrowser({courseID: '1'}))

      await waitFor(() => {
        expect(result.current.selectedFolderID).toBe('123')
      })

      expect(result.current.isLoading).toBe(true)

      resolveFiles!()

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true)
      })

      resolveFolders!()

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })
})
