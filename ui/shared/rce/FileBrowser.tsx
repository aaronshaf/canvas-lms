// Copyright (C) 2017 - present Instructure, Inc.
//
// This file is part of Canvas.
//
// Canvas is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, version 3 of the License.
//
// Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
// WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
// A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
// details.
//
// You should have received a copy of the GNU Affero General Public License along
// with this program. If not, see <http://www.gnu.org/licenses/>.

import {useScope as createI18nScope} from '@canvas/i18n'
import React from 'react'
import {cloneDeep} from 'es-toolkit/compat'
import $ from 'jquery'
import axios from '@canvas/axios'
import minimatch from 'minimatch'
import {TreeBrowser} from '@instructure/ui-tree-browser'
import {Text} from '@instructure/ui-text'
import {Spinner} from '@instructure/ui-spinner'
import {Button} from '@instructure/ui-buttons'
import {Mask} from '@instructure/ui-overlays'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import splitAssetString from '@canvas/util/splitAssetString'
import {
  IconOpenFolderSolid,
  IconFolderSolid,
  IconUploadSolid,
  IconImageSolid,
} from '@instructure/ui-icons'
import PropTypes from 'prop-types'
import {getRootFolder, uploadFile} from '@canvas/files/util/apiFileUtils'
import parseLinkHeader from 'link-header-parsing/parseLinkHeader'
import {showFlashSuccess, showFlashError} from '@canvas/alerts/react/FlashAlert'
import natcompare from '@canvas/util/natcompare'
import {captureException} from '@sentry/react'

const I18n = createI18nScope('react_files')

class FileBrowser extends React.Component {
  static propTypes = {
    allowUpload: PropTypes.bool,
    contentTypes: PropTypes.arrayOf(PropTypes.string),
    defaultUploadFolderId: PropTypes.string,
    selectFile: PropTypes.func.isRequired,
    useContextAssets: PropTypes.bool,
  }

  static defaultProps = {
    allowUpload: true,
    contentTypes: ['*/*'],
    defaultUploadFolderId: null,
    useContextAssets: true,
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  constructor(props) {
    super(props)
    this.state = {
      collections: {0: {id: 0, collections: []}},
      items: {},
      openFolders: [],
      uploadFolder: null,
      uploading: false,
      loadingCount: 0,
    }
  }

  componentDidMount() {
    this.getRootFolders()
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  getContextName(contextType) {
    if (contextType === 'courses') {
      return I18n.t('Course files')
    } else {
      return I18n.t('Group files')
    }
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  getContextInfo(assetString) {
    const contextTypeAndId = splitAssetString(assetString)
    if (contextTypeAndId && contextTypeAndId[0] && contextTypeAndId[1]) {
      const contextName = this.getContextName(contextTypeAndId[0])
      return {name: contextName, type: contextTypeAndId[0], id: contextTypeAndId[1]}
    }
  }

  getRootFolders() {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    if (this.props.useContextAssets) {
      this.getContextFolders()
    }
    this.getUserFolders()
  }

  getUserFolders() {
    this.getRootFolderData('users', 'self', {name: I18n.t('My files')})
  }

  getContextFolders() {
    if (!ENV.context_asset_string) return
    const contextInfo = this.getContextInfo(ENV.context_asset_string)
    if (contextInfo && contextInfo.type && contextInfo.id) {
      this.getRootFolderData(contextInfo.type, contextInfo.id, {name: contextInfo.name})
    }
  }

  increaseLoadingCount() {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    let {loadingCount} = this.state
    loadingCount += 1
    this.setState({loadingCount})
  }

  decreaseLoadingCount() {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    let {loadingCount} = this.state
    loadingCount -= 1
    this.setState({loadingCount})
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  getRootFolderData(context, id, opts = {}) {
    this.increaseLoadingCount()
    getRootFolder(context, id)
      .then(response => this.populateRootFolder(response.data, opts))
      .catch(error => {
        this.decreaseLoadingCount()
        if (error.response && error.response.status !== 401) {
          this.setFailureMessage(I18n.t('Something went wrong'))
        }
      })
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  populateRootFolder(data, opts = {}) {
    this.decreaseLoadingCount()
    this.populateCollectionsList([data], opts)
    this.getFolderData(data.id)
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  getFolderData(id) {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    const {collections} = this.state
    if (!collections[id].locked) {
      this.getPaginatedData(this.folderFileApiUrl(id, 'folders'), this.populateCollectionsList)
      this.getPaginatedData(this.folderFileApiUrl(id), this.populateItemsList)
    }
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  getPaginatedData(url, callback) {
    axios
      .get(url)
      .then(response => {
        callback(response.data)
        // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        const nextUrl = parseLinkHeader(response.headers.link).next
        if (nextUrl) {
          this.getPaginatedData(nextUrl, callback)
        }
      })
      .catch(error => {
        console.error('Error fetching data from API')
        console.error(error)
        captureException(error)
      })
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  folderFileApiUrl(folderId, type = 'files') {
    return `/api/v1/folders/${folderId}/${type}`
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  populateCollectionsList = (folderList, opts = {}) => {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.setState(function ({collections}) {
      const newCollections = cloneDeep(collections)
      // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
      folderList.forEach(folder => {
        // @ts-expect-error TS2683 -- TypeScriptify (no 'any')
        const collection = this.formatFolderInfo(folder, opts)
        newCollections[collection.id] = collection
        const parent_id = folder.parent_folder_id || 0
        const collectionCollections = newCollections[parent_id].collections
        if (!collectionCollections.includes(collection.id)) {
          collectionCollections.push(collection.id)
          // @ts-expect-error TS2683 -- TypeScriptify (no 'any')
          newCollections[parent_id].collections = this.orderedIdsFromList(
            newCollections,
            collectionCollections,
          )
        }
      })
      return {collections: newCollections}
    })

    // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
    folderList.forEach(folder => {
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      if (this.state.openFolders.includes(folder.parent_folder_id)) {
        this.getFolderData(folder.id)
      }
    })
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  contentTypeIsAllowed(contentType) {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    for (const pattern of this.props.contentTypes) {
      if (minimatch(contentType, pattern)) {
        return true
      }
    }
    return false
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  populateItemsList = fileList => {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.setState(function ({items, collections}) {
      const newItems = cloneDeep(items)
      const newCollections = cloneDeep(collections)
      // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
      fileList.forEach(file => {
        // @ts-expect-error TS2683 -- TypeScriptify (no 'any')
        if (this.contentTypeIsAllowed(file['content-type'])) {
          // @ts-expect-error TS2683 -- TypeScriptify (no 'any')
          const item = this.formatFileInfo(file)
          newItems[item.id] = item
          const folder_id = file.folder_id
          const collectionItems = newCollections[folder_id].items
          if (!collectionItems.includes(item.id)) {
            collectionItems.push(item.id)
            // @ts-expect-error TS2683 -- TypeScriptify (no 'any')
            newCollections[folder_id].items = this.orderedIdsFromList(newItems, collectionItems)
          }
        }
      })
      return {items: newItems, collections: newCollections}
    })
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  formatFolderInfo(apiFolder, opts = {}) {
    const descriptor = apiFolder.locked_for_user ? I18n.t('Locked') : null
    const folder = {
      api: apiFolder,
      id: apiFolder.id,
      collections: [],
      items: [],
      name: apiFolder.name,
      context: `/${apiFolder.context_type.toLowerCase()}s/${apiFolder.context_id}`,
      canUpload: apiFolder.can_upload,
      locked: apiFolder.locked_for_user,
      descriptor,
      ...opts,
    }
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    const existingCollections = this.state.collections[apiFolder.id]
    Object.assign(
      folder,
      existingCollections && {
        collections: existingCollections.collections,
        items: existingCollections.items,
      },
    )
    return folder
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  formatFileInfo(apiFile, opts = {}) {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    const {collections} = this.state
    const context = collections[apiFile.folder_id].context
    const file = {
      api: apiFile,
      id: apiFile.id,
      name: apiFile.display_name,
      thumbnail: apiFile.thumbnail_url,
      src: `${context}/files/${apiFile.id}/preview${
        context.includes('user') ? `?verifier=${apiFile.uuid}` : ''
      }`,
      alt: apiFile.display_name,
      ...opts,
    }
    return file
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  orderedIdsFromList(list, ids) {
    try {
      // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
      const sortedIds = ids.sort((a, b) => natcompare.strings(list[a].name, list[b].name))
      return sortedIds
    } catch (error) {
      console.error(error)
      captureException(error)
      return ids
    }
  }

  uploadFolderId = () => {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    return this.state.uploadFolder || this.props.defaultUploadFolderId
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  onFolderToggle = folder => {
    return this.onFolderClick(folder.id, folder)
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  onFolderClick = (folderId, _folder) => {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    const collection = this.state.collections[folderId]
    // @ts-expect-error TS7034 -- TypeScriptify (no 'any')
    let newFolders = []
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    const {openFolders} = this.state
    if (!collection.locked && openFolders.includes(folderId)) {
      // @ts-expect-error TS7005,TS7006 -- TypeScriptify (no 'any')
      newFolders = newFolders.concat(openFolders.filter(id => id !== folderId))
    } else if (!collection.locked) {
      // @ts-expect-error TS7005 -- TypeScriptify (no 'any')
      newFolders = newFolders.concat(openFolders)
      newFolders.push(folderId)
      // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
      collection.collections.forEach(id => this.getFolderData(id))
    }
    return this.setState({openFolders: newFolders, uploadFolder: folderId})
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  onFileClick = file => {
    const folder = this.findFolderForFile(file)
    this.setState({uploadFolder: folder && folder.id})
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.props.selectFile(this.state.items[file.id])
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  onInputChange = files => {
    if (files) {
      this.submitFile(files[0])
    }
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  submitFile = file => {
    this.setState({uploading: true})
    uploadFile(file, this.uploadFolderId(), this.onUploadSucceed, this.onUploadFail)
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  onUploadSucceed = response => {
    this.populateItemsList([response])
    this.clearUploadInfo()
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    const folder = this.state.collections[response.folder_id]
    this.setSuccessMessage(I18n.t('Success: File uploaded'))
    if ($(`button:contains('${response.display_name}')`).length === 0) {
      $(`button:contains('${folder && folder.name}')`).click()
    }
    const button = $(`button:contains('${response.display_name}')`)
    // @ts-expect-error TS2345 -- TypeScriptify (no 'any')
    $('.file-browser__tree').scrollTo(button)
    button.click()
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  findFolderForFile(file) {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    const {collections} = this.state
    const folderKey = Object.keys(collections).find(key => {
      const items = collections[key].items
      if (items && items.includes(file.id)) return key
      return false
    })
    return collections[folderKey]
  }

  onUploadFail = () => {
    this.clearUploadInfo()
    this.setFailureMessage(I18n.t('File upload failed'))
  }

  clearUploadInfo() {
    this.setState({uploading: false})
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    if (this.uploadInput) {
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      this.uploadInput.value = ''
    }
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  setSuccessMessage = message => {
    showFlashSuccess(message)()
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  setFailureMessage = message => {
    showFlashError(message)()
  }

  selectLocalFile = () => {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.uploadInput.click()
  }

  renderUploadDialog() {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    if (!this.props.allowUpload) {
      return null
    }
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    const uploadFolder = this.state.collections[this.uploadFolderId()]
    const disabled = !uploadFolder || uploadFolder.locked || !uploadFolder.canUpload
    const srError = disabled ? (
      <ScreenReaderContent>{I18n.t('Upload not available for this folder')}</ScreenReaderContent>
    ) : (
      ''
    )
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    const acceptContentTypes = this.props.contentTypes.join(',')
    return (
      <div className="image-upload__form">
        <input
          onChange={e => this.onInputChange(e.target.files)}
          ref={i => {
            // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
            this.uploadInput = i
          }}
          type="file"
          accept={acceptContentTypes}
          className="hidden"
        />
        <Button
          id="image-upload__upload"
          onClick={this.selectLocalFile}
          disabled={disabled}
          color="primary"
          withBackground={false}
          // @ts-expect-error TS2769 -- TypeScriptify (no 'any')
          renderIcon={IconUploadSolid}
        >
          {I18n.t('Upload File')} {srError}
        </Button>
      </div>
    )
  }

  renderMask() {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    if (this.state.uploading) {
      return (
        <Mask>
          <Spinner renderTitle={I18n.t('File uploading')} />
        </Mask>
      )
    } else {
      return null
    }
  }

  renderLoading() {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    if (this.state.loadingCount > 0) {
      return <Spinner renderTitle={I18n.t('Loading folders')} size="small" />
    } else {
      return null
    }
  }

  render() {
    const element = (
      <div className="file-browser__container">
        <Text>{I18n.t('Available folders')}</Text>
        <div className="file-browser__tree">
          <TreeBrowser
            // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
            collections={this.state.collections}
            // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
            items={this.state.items}
            size="medium"
            onCollectionToggle={this.onFolderToggle}
            onCollectionClick={this.onFolderClick}
            onItemClick={this.onFileClick}
            treeLabel={I18n.t('Folder tree')}
            rootId={0}
            showRootCollection={false}
            // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
            defaultExpanded={this.state.openFolders}
            collectionIconExpanded={IconOpenFolderSolid}
            collectionIcon={IconFolderSolid}
            itemIcon={IconImageSolid}
            selectionType="single"
          />
          {this.renderMask()}
          {this.renderLoading()}
        </div>
        {this.renderUploadDialog()}
      </div>
    )
    return element
  }
}

export default FileBrowser
