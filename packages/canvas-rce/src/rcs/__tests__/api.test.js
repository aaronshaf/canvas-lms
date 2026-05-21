/*
 * Copyright (C) 2021 - present Instructure, Inc.
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

import fetchMock from 'fetch-mock'
import RceApiSource from '../api'
import {saveClosedCaptions, saveClosedCaptionsForAttachment} from '@instructure/canvas-media'

vi.mock('@instructure/canvas-media')

let apiSource

beforeEach(() => {
  apiSource = new RceApiSource({
    jwt: 'theJWT',
    refreshToken: callback => {
      callback('freshJWT')
    },
    alertFunc: vi.fn(),
  })

  apiSource.fetchPage = vi.fn()

  fetchMock.mock('/api/session', '{}')
})

afterEach(() => {
  fetchMock.restore()
})

describe('fetchImages()', () => {
  let props
  const standardProps = {
    contextType: 'course',
    images: {
      course: {},
    },
    sortBy: 'date',
  }

  const subject = () => apiSource.fetchImages(props)

  beforeEach(() => {
    apiSource.hasSession = true
    fetchMock.mock(/\/api\/documents*/, '{"files": []}')
  })

  describe('with "category" set', () => {
    beforeEach(() => {
      props = {
        category: 'uncategorized',
        ...standardProps,
      }
    })

    it('sends the category', async () => {
      await subject()
      expect(
        fetchMock.called(
          '/api/documents?contextType=course&contextId=undefined&content_types=image&sort=undefined&order=undefined&category=uncategorized',
        ),
      ).toEqual(true)
    })
  })
})

describe('fetchFilesForFolder()', () => {
  let apiProps

  const subject = () => apiSource.fetchFilesForFolder(apiProps)

  beforeEach(() => {
    apiProps = {host: 'test.com', jwt: 'asd.asdf.asdf', filesUrl: '/api/files'}
    fetchMock.mock('/api/files', '{"files": []}')
  })

  it('fetches folder files without query params if none supplied in props', async () => {
    apiProps = {...apiProps}
    await subject()
    expect(apiSource.fetchPage).toHaveBeenCalledWith('/api/files', 'theJWT')
  })

  it('fetches folder files using the per_page query param', async () => {
    apiProps = {...apiProps, perPage: 5}
    await subject()
    expect(apiSource.fetchPage).toHaveBeenCalledWith('/api/files?per_page=5', 'theJWT')
  })

  it('fetches folder files using the encoded searchString query param', async () => {
    apiProps = {...apiProps, perPage: 5, searchString: 'an awesome file'}
    const encodedSearchString = encodeURIComponent(apiProps.searchString)
    await subject()
    expect(apiSource.fetchPage).toHaveBeenCalledWith(
      `/api/files?per_page=5&search_term=${encodedSearchString}`,
      'theJWT',
    )
  })
})

describe('fetchMedia', () => {
  let apiProps

  const subject = () => apiSource.fetchMedia(apiProps)

  beforeEach(() => {
    apiProps = {
      host: 'test.com',
      jwt: 'asd.asdf.asdf',
      contextType: 'course',
      media: {course: {}},
      sortBy: {
        sort: 'name',
        dir: 'asc',
      },
      contextId: 1,
    }

    apiSource.apiFetch = vi.fn().mockResolvedValue({files: []})
  })

  it('fetches media documents', async () => {
    await subject()
    expect(apiSource.apiFetch).toHaveBeenCalledWith(
      'http://test.com/api/documents?contextType=course&contextId=1&content_types=video,audio&sort=name&order=asc',
      {Authorization: 'Bearer theJWT'},
    )
  })
})

describe('saveClosedCaptions()', () => {
  let apiProps, media_object_id, attachment_id, subtitles, maxBytes

  const subject = params => apiSource.updateClosedCaptions(apiProps, params, maxBytes)

  beforeEach(() => {
    apiProps = {host: 'test.com', jwt: 'asd.asdf.asdf'}
    media_object_id = 'm-id'
    attachment_id = '123'
    subtitles = [
      {
        language: {selectedOptionId: 'en'},
        file: new Blob(['file contents'], {type: 'text/plain'}),
        isNew: true,
      },
    ]
    maxBytes = 10
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('using media objects url', async () => {
    saveClosedCaptions.mockImplementation(() => Promise.resolve())
    await subject({media_object_id, subtitles})
    expect(saveClosedCaptions).toHaveBeenCalledWith(
      media_object_id,
      subtitles,
      {
        headers: {
          Authorization: 'Bearer asd.asdf.asdf',
        },
        origin: 'http://test.com',
      },
      maxBytes,
    )
  })

  it('using media objects url due null attachment', async () => {
    attachment_id = null
    saveClosedCaptions.mockImplementation(() => Promise.resolve())
    await subject({media_object_id, attachment_id, subtitles})
    expect(saveClosedCaptions).toHaveBeenCalledWith(
      media_object_id,
      subtitles,
      {
        headers: {
          Authorization: 'Bearer asd.asdf.asdf',
        },
        origin: 'http://test.com',
      },
      maxBytes,
    )
  })

  it('using media attachments url', async () => {
    saveClosedCaptionsForAttachment.mockImplementation(() => Promise.resolve())
    await subject({media_object_id, attachment_id, subtitles})
    expect(saveClosedCaptionsForAttachment).toHaveBeenCalledWith(
      attachment_id,
      subtitles,
      {
        headers: {
          Authorization: 'Bearer asd.asdf.asdf',
        },
        origin: 'http://test.com',
      },
      maxBytes,
    )
  })

  describe('with a captions file that is too large', () => {
    beforeEach(async () => {
      const {saveClosedCaptions: realSaveClosedCaptions} = await vi.importActual(
        '@instructure/canvas-media',
      )
      saveClosedCaptions.mockImplementation(realSaveClosedCaptions)
      maxBytes = 5
    })

    it('Notifies the user of a file size issue', async () => {
      await subject({media_object_id, subtitles})
      expect(apiSource.alertFunc).toHaveBeenCalledWith({
        text: 'Closed caption file must be less than 0.005 kb',
        variant: 'error',
      })
    })
  })
})

describe('uploadFRD() S3 XML response (regression: 0c58dcd0fc6)', () => {
  const preflightProps = {
    upload_url: 'https://s3.example.com/upload',
    upload_params: {'x-amz-signature': 'abc123'},
  }

  it('parses XML Location from S3 201 response', async () => {
    const xmlBody =
      '<?xml version="1.0"?><PostResponse><Location>https://s3.example.com/files/test.pdf</Location></PostResponse>'
    fetchMock.post('https://s3.example.com/upload', {
      status: 201,
      headers: {'content-type': 'application/xml; charset=UTF-8'},
      body: xmlBody,
    })
    apiSource.finalizeUpload = vi.fn().mockResolvedValue({})
    await apiSource.uploadFRD(new window.File(['data'], 'test.pdf'), preflightProps)
    expect(apiSource.finalizeUpload).toHaveBeenCalledWith(
      preflightProps,
      expect.objectContaining({Location: 'https://s3.example.com/files/test.pdf'}),
    )
    fetchMock.restore()
  })

  it('falls back to res.json() for non-XML responses', async () => {
    fetchMock.post('https://s3.example.com/upload', {
      status: 200,
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({id: 42}),
    })
    apiSource.finalizeUpload = vi.fn().mockResolvedValue({})
    await apiSource.uploadFRD(new window.File(['data'], 'test.pdf'), preflightProps)
    expect(apiSource.finalizeUpload).toHaveBeenCalledWith(
      preflightProps,
      expect.objectContaining({id: 42}),
    )
    fetchMock.restore()
  })
})

describe('uploadFRD() null content-type guard (regression: 3e97eebab5a)', () => {
  const preflightProps = {
    upload_url: 'https://s3.example.com/upload',
    upload_params: {'x-amz-signature': 'abc123'},
  }

  it('does not crash when S3 response has no content-type header', async () => {
    // Before fix: res.headers.get('content-type').includes(...) threw TypeError
    // when content-type was absent (null). After fix: ?. makes it return undefined
    // (falsy) and fall through to res.json().
    fetchMock.post('https://s3.example.com/upload', {
      status: 200,
      headers: {},
      body: JSON.stringify({id: 99}),
    })
    apiSource.finalizeUpload = vi.fn().mockResolvedValue({})
    await apiSource.uploadFRD(new window.File(['data'], 'test.pdf'), preflightProps)
    expect(apiSource.finalizeUpload).toHaveBeenCalledWith(
      preflightProps,
      expect.objectContaining({id: 99}),
    )
    fetchMock.restore()
  })
})

describe('apiPost() network error propagation (regression: 3e97eebab5a)', () => {
  let originalFetch

  beforeEach(() => {
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('re-throws the original network error without crashing on e.response.json()', async () => {
    // Before fix: apiPost's catch tried e.response.json() when e.response was undefined,
    // replacing the original TypeError with "Cannot read properties of undefined (reading 'json')".
    // After fix: if (!e.response) throw e — network errors pass through unchanged.
    const networkError = new TypeError('network failure')
    global.fetch = vi.fn().mockRejectedValue(networkError)
    // throwConnectionError logs the TypeError to console.error — suppress it
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      apiSource.updateMediaObject(
        {host: 'test.com', jwt: 'asd.asdf.asdf'},
        {media_object_id: 'm-id', title: '', attachment_id: null},
      ),
    ).rejects.toThrow('network failure')
  })
})

describe('updateMediaData()', () => {
  const apiProps = {host: 'test.com', jwt: 'asd.asdf.asdf'}
  const media_object_id = 'm-id',
    attachment_id = '123'

  it('Uses the media object route with no attachment_id', async () => {
    apiSource.apiPost = vi.fn()
    await apiSource.updateMediaObject(apiProps, {media_object_id, title: '', attachment_id: null})
    expect(apiSource.apiPost).toHaveBeenCalledWith(
      'http://test.com/api/media_objects/m-id?user_entered_title=',
      expect.anything(),
      {viewer_restrictions: {}},
      expect.anything(),
    )
  })

  it('Uses the media attachment route with the attachment_id', async () => {
    apiSource.apiPost = vi.fn()
    await apiSource.updateMediaObject(apiProps, {media_object_id, title: '', attachment_id})
    expect(apiSource.apiPost).toHaveBeenCalledWith(
      'http://test.com/api/media_attachments/123?user_entered_title=',
      expect.anything(),
      {viewer_restrictions: {}},
      expect.anything(),
    )
  })

  it('sends provided viewerRestrictions in the body', async () => {
    apiSource.apiPost = vi.fn()
    await apiSource.updateMediaObject(apiProps, {
      media_object_id,
      title: '',
      attachment_id: null,
      viewerRestrictions: {show_rolling_transcript: true},
    })
    expect(apiSource.apiPost).toHaveBeenCalledWith(
      'http://test.com/api/media_objects/m-id?user_entered_title=',
      expect.anything(),
      {viewer_restrictions: {show_rolling_transcript: true}},
      expect.anything(),
    )
  })
})
