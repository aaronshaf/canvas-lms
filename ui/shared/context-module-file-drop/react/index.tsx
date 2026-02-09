/*
 * Copyright (C) 2020 - present Instructure, Inc.
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
import {instanceOf, string} from 'prop-types'
import {useScope as createI18nScope} from '@canvas/i18n'
import {getCourseRootFolder, getFolderFiles} from './apiClient'
import {showFlashAlert} from '@canvas/alerts/react/FlashAlert'
import {FileDrop} from '@instructure/ui-file-drop'
import {Billboard} from '@instructure/ui-billboard'
import {IconUploadLine} from '@instructure/ui-icons'
import {Text as InstuiText} from '@instructure/ui-text'
import BaseUploader from '@canvas/files/react/modules/BaseUploader'
import CurrentUploads from '@canvas/files/react/components/CurrentUploads'
import FilesystemObject from '@canvas/files/backbone/models/FilesystemObject'
import FileOptionsCollection from '@canvas/files/react/modules/FileOptionsCollection'
import UploadForm from '@canvas/files/react/components/UploadForm'
import {AccessibleContent} from '@instructure/ui-a11y-content'
import {Heading} from '@instructure/ui-heading'
import {View} from '@instructure/ui-view'

const I18n = createI18nScope('modules')

export default class ModuleFileDrop extends React.Component {
  static propTypes = {
    courseId: string.isRequired,
    moduleId: string.isRequired,
    contextModules: instanceOf(Element),
    moduleName: string,
  }

  static defaultProps = {
    contextModules: null,
    moduleName: null,
  }

  static folderState = {}

  static activeDrops = new Set()

  // @ts-expect-error -- legacy untyped React component
  constructor(props) {
    super(props)
    this.state = {
      hightlightUpload: false,
      isUploading: false,
      folder: null,
      contextType: null,
      contextId: null,
      interaction: true,
    }
  }

  componentDidMount() {
    if (Object.keys(ModuleFileDrop.folderState).length > 0) {
      this.setFolderState(ModuleFileDrop.folderState)
    }
    if (ModuleFileDrop.activeDrops.size === 0) {
      this.fetchRootFolder()
    }
    ModuleFileDrop.activeDrops.add(this)
  }

  fetchRootFolder() {
    // @ts-expect-error -- legacy untyped React component
    return getCourseRootFolder(this.props.courseId)
      .then(rootFolder => {
        return (
          getFolderFiles(rootFolder.id)
            // @ts-expect-error -- legacy untyped React component
            .then(files => {
              rootFolder.files = files
              ModuleFileDrop.folderState = {
                contextId: rootFolder.context_id,
                contextType: rootFolder.context_type,
                folder: rootFolder,
              }
              ModuleFileDrop.activeDrops.forEach(drop => {
                // @ts-expect-error -- legacy untyped React component
                drop.setFolderState(ModuleFileDrop.folderState)
              })
            })
            .catch(this.showAlert)
        )
      })
      .catch(this.showAlert)
  }

  showAlert = () => {
    showFlashAlert({
      type: 'error',
      message: I18n.t('Unable to set up drag and drop for modules'),
    })
  }

  // @ts-expect-error -- legacy untyped React component
  addFile(file) {
    const folderState = ModuleFileDrop.folderState
    // @ts-expect-error -- legacy untyped React component
    folderState.folder.files = [...folderState.folder.files, new FilesystemObject(file)]
    ModuleFileDrop.activeDrops.forEach(drop => {
      // @ts-expect-error -- legacy untyped React component
      drop.setFolderState(ModuleFileDrop.folderState)
    })
  }

  componentWillUnmount() {
    ModuleFileDrop.activeDrops.delete(this)
  }

  // @ts-expect-error -- legacy untyped React component
  setFolderState(folderState) {
    this.setState(folderState)
  }

  handleDragEnter = () => {
    this.setState({hightlightUpload: true})
  }

  handleDragLeave = () => {
    this.setState({hightlightUpload: false})
  }

  // @ts-expect-error -- legacy untyped React component
  handleDrop = files => {
    // @ts-expect-error -- legacy untyped React component
    const {moduleId, contextModules} = this.props
    // @ts-expect-error -- legacy untyped React component
    const {folder} = this.state
    this.setInteractionOnAll(false)
    // Setting the callback directly here (instead of the
    // constructor) because we may need to take back control
    // from select_content_dialog.js, which also uses this
    // callback to know when an upload is complete.
    BaseUploader.prototype.onUploadPosted = attachment => {
      this.addFile(attachment)
      if (contextModules) {
        const event = new Event('addFileToModule')
        // @ts-expect-error -- custom event fields
        event.moduleId = moduleId
        // @ts-expect-error -- custom event fields
        event.attachment = attachment
        // @ts-expect-error -- custom event fields
        event.returnToFileDrop = true
        contextModules.dispatchEvent(event)
      }
    }
    FileOptionsCollection.setUploadOptions({
      alwaysRename: false,
      alwaysUploadZips: true,
    })
    this.setState({hightlightUpload: false, isUploading: true}, () => {
      FileOptionsCollection.setFolder(folder)
      FileOptionsCollection.setOptionsFromFiles(files, true)
    })
  }

  // @ts-expect-error -- legacy untyped React component
  renderHero(size) {
    // @ts-expect-error -- legacy untyped React component
    const {hightlightUpload} = this.state
    return <IconUploadLine size={size} color={hightlightUpload ? 'brand' : 'primary'} />
  }

  renderBillboard() {
    // @ts-expect-error -- legacy untyped React component
    const {moduleName} = this.props
    // @ts-expect-error -- legacy untyped React component
    const {folder} = this.state
    // @ts-expect-error -- legacy untyped React component
    const hero = size => this.renderHero(size)

    let a11yMessage = I18n.t('Loading...')
    if (folder) {
      if (moduleName) {
        a11yMessage = I18n.t('Drop files here to add to %{moduleName} module or choose files', {
          moduleName,
        })
      } else {
        a11yMessage = I18n.t('Drop files here to add to module or choose files')
      }
    }
    return (
      <Billboard
        hero={hero}
        message={
          <AccessibleContent alt={a11yMessage}>
            <View as="span" display="block" margin="medium 0 0">
              <Heading level="h4" as="span" color="primary">
                {folder ? I18n.t('Drop files here to add to module') : I18n.t('Loading...')}
              </Heading>
            </View>

            <View as="span" display="block" margin="small 0 0">
              <InstuiText size="small" color="brand">
                {folder ? I18n.t('or choose files') : ''}
              </InstuiText>
            </View>
          </AccessibleContent>
        }
      />
    )
  }

  // @ts-expect-error -- legacy untyped React component
  setInteractionOnAll(interaction) {
    // @ts-expect-error -- legacy untyped React component
    ModuleFileDrop.activeDrops.forEach(drop => drop.setInteraction(interaction))
  }

  // @ts-expect-error -- legacy untyped React component
  setInteraction(interaction) {
    this.setState({interaction})
  }

  renderFileDrop() {
    // @ts-expect-error -- legacy untyped React component
    const {interaction, folder} = this.state
    return (
      <FileDrop
        data-testid="module-file-drop"
        shouldAllowMultiple={true}
        renderLabel={this.renderBillboard()}
        onDragEnter={this.handleDragEnter}
        onDragLeave={this.handleDragLeave}
        onDrop={this.handleDrop}
        interaction={interaction && folder ? 'enabled' : 'disabled'}
      />
    )
  }

  handleEmptyUpload = () => {
    this.setState({isUploading: false})
    this.setInteractionOnAll(true)
  }

  // @ts-expect-error -- legacy untyped React component
  renameFileMessage = nameToUse => {
    return I18n.t(
      'A file named "%{name}" already exists. Do you want to replace the existing file?',
      {name: nameToUse},
    )
  }

  // @ts-expect-error -- legacy untyped React component
  lockFileMessage = nameToUse => {
    return I18n.t('A locked file named "%{name}" already exists. Please enter a new name.', {
      name: nameToUse,
    })
  }

  renderUploading() {
    // @ts-expect-error -- legacy untyped React component
    const {folder, contextId, contextType} = this.state
    return (
      <>
        <UploadForm
          visible={false}
          currentFolder={folder}
          contextId={contextId}
          contextType={contextType}
          allowSkip={true}
          alwaysUploadZips={true}
          onEmptyOrClose={this.handleEmptyUpload}
          onRenameFileMessage={this.renameFileMessage}
          onLockFileMessage={this.lockFileMessage}
        />
        <CurrentUploads onUploadChange={this.handleUploadChange} />
      </>
    )
  }

  // @ts-expect-error -- legacy untyped React component
  handleUploadChange = queueSize => {
    if (queueSize === 0) {
      this.setInteractionOnAll(true)
    }
    this.setState({isUploading: queueSize > 0})
  }

  render() {
    // @ts-expect-error -- legacy untyped React component
    const {isUploading} = this.state
    return isUploading ? this.renderUploading() : this.renderFileDrop()
  }
}
