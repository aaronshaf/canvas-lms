/*
 * Copyright (C) 2019 - present Instructure, Inc.
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

import {AlertManagerContext} from '@canvas/alerts/react/AlertManager'
import {Assignment} from '@canvas/assignments/graphql/student/Assignment'
import elideString from '../../helpers/elideString'
import {arrayOf, bool, func, number, shape, string, object} from 'prop-types'
import {getFileThumbnail} from '@canvas/util/fileHelper'
import {useScope as createI18nScope} from '@canvas/i18n'
import MoreOptions from './MoreOptions/index'
import React, {Component, createRef} from 'react'
import {Submission} from '@canvas/assignments/graphql/student/Submission'
import UploadFileSVG from '../../../images/UploadFile.svg'
import WithBreakpoints, {breakpointsShape} from '@canvas/with-breakpoints'

import {FileDrop} from '@instructure/ui-file-drop'
import {Flex} from '@instructure/ui-flex'
import {IconButton} from '@instructure/ui-buttons'
import {IconCompleteSolid, IconTrashLine} from '@instructure/ui-icons'
import {Img} from '@instructure/ui-img'
import {ProgressBar} from '@instructure/ui-progress'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import StudentViewContext from '@canvas/assignments/react/StudentViewContext'
import {Table} from '@instructure/ui-table'
import {Text} from '@instructure/ui-text'
import {View} from '@instructure/ui-view'
import theme from '@instructure/canvas-theme'
import FormattedErrorMessage from '@canvas/assignments/react/FormattedErrorMessage'

const I18n = createI18nScope('assignments_2_file_upload')

const FILE_REQUIRED_ERROR_MESSAGE = I18n.t('At least one submission type is required')

class FileUpload extends Component {
  static propTypes = {
    assignment: Assignment.shape,
    breakpoints: breakpointsShape,
    createSubmissionDraft: func,
    filesToUpload: arrayOf(
      shape({
        _id: string,
        index: number,
        name: string,
        loaded: number,
        total: number,
      }),
    ).isRequired,
    focusOnInit: bool.isRequired,
    onCanvasFileRequested: func.isRequired,
    onUploadRequested: func.isRequired,
    submission: Submission.shape,
    submitButtonRef: object,
  }

  state = {
    messages: [],
    showErorrMessage: false,
  }

  _isMounted = false
  _inputFileDropRef = createRef()

  componentDidMount() {
    this._isMounted = true
    window.addEventListener('message', this.handleLTIFiles)
    const fileDrop = document.getElementById('inputFileDrop')
    // @ts-expect-error
    if (fileDrop && this.props.focusOnInit) {
      fileDrop.focus()
    }
    // @ts-expect-error
    this.props.submitButtonRef?.current?.addEventListener('click', this.handleSubmitClick)
  }

  // @ts-expect-error
  componentDidUpdate(_prevProps) {
    // @ts-expect-error
    this.props.submitButtonRef?.current?.addEventListener('click', this.handleSubmitClick)
  }

  componentWillUnmount() {
    this._isMounted = false
    window.removeEventListener('message', this.handleLTIFiles)
    // @ts-expect-error
    this.props.submitButtonRef.current?.removeEventListener('click', this.handleSubmitClick)
  }

  handleSubmitClick = () => {
    // @ts-expect-error
    if (!this.props.submission.submissionDraft?.meetsUploadCriteria) {
      const fileDrop = document.getElementById('inputFileDrop')
      fileDrop?.focus()

      const container = document.getElementById('file-upload-container')
      // @ts-expect-error
      container.classList.add('error-outline')
      // @ts-expect-error
      fileDrop.setAttribute('aria-label', FILE_REQUIRED_ERROR_MESSAGE)
      this.setState({showErrorMessage: true})
    }
  }

  clearErrors = () => {
    const fileDrop = document.getElementById('inputFileDrop')
    const container = document.getElementById('file-upload-container')
    container?.classList.remove('error-outline')
    fileDrop?.removeAttribute('aria-label')
    this.setState({showErrorMessage: false})
  }

  getDraftAttachments = () => {
    // @ts-expect-error
    return this.props.submission.submissionDraft &&
      // @ts-expect-error
      this.props.submission.submissionDraft.attachments
      ? // @ts-expect-error
        this.props.submission.submissionDraft.attachments
      : []
  }

  // @ts-expect-error
  handleLTIFiles = async e => {
    if (e.data.subject === 'LtiDeepLinkingResponse') {
      if (e.data.errormsg) {
        // @ts-expect-error
        this.context.setOnFailure(e.data.errormsg)
        return
      }
      await this.handleDropAccepted(e.data.content_items)
    }

    // Since LTI 1.0 handles its own message alerting we don't have to
    if (e.data.subject === 'A2ExternalContentReady') {
      if (!e.data.errormsg) {
        // Content type will be set on back-end to allow for DocViewer rendering
        // @ts-expect-error
        const files = e.data.content_items.map(file => ({...file, mediaType: ''}))
        await this.handleDropAccepted(files)
      }
    }
  }

  // @ts-expect-error
  handleCanvasFiles = async fileID => {
    this.clearErrors()
    if (!fileID) {
      // @ts-expect-error
      this.context.setOnFailure(I18n.t('Error adding canvas file to submission draft'))
      return
    }
    // @ts-expect-error
    this.props.onCanvasFileRequested({
      fileID,
      onError: () => {
        // @ts-expect-error
        this.context.setOnFailure(I18n.t('Error updating submission draft'))
      },
    })
  }

  // @ts-expect-error
  handleDropAccepted = async files => {
    this.clearErrors()
    if (!files.length) {
      // @ts-expect-error
      this.context.setOnFailure(I18n.t('Error adding files to submission draft'))
      return
    }
    // @ts-expect-error
    await this.props.onUploadRequested({
      files,
      onError: () => {
        // @ts-expect-error
        this.context.setOnFailure(I18n.t('Error updating submission draft'))
      },
      onSuccess: () => {
        // @ts-expect-error
        this.context.setOnSuccess(I18n.t('Uploading files'))
      },
    })
  }

  // @ts-expect-error
  handleWebcamPhotoUpload = async ({filename, image}) => {
    this.clearErrors()
    const {blob} = image
    blob.name = filename

    await this.handleDropAccepted([blob])
  }

  handleDropRejected = () => {
    this.setState({
      messages: [
        {
          text: I18n.t('Invalid file type'),
          type: 'newError',
        },
      ],
    })
  }

  // @ts-expect-error
  handleRemoveFile = async e => {
    const fileId = parseInt(e.currentTarget.id, 10)
    const fileIndex = this.getDraftAttachments().findIndex(
      // @ts-expect-error
      file => parseInt(file._id, 10) === fileId,
    )

    // @ts-expect-error
    const updatedFiles = this.getDraftAttachments().filter((_, i) => i !== fileIndex)
    // @ts-expect-error
    await this.props.createSubmissionDraft({
      variables: {
        // @ts-expect-error
        id: this.props.submission.id,
        activeSubmissionType: 'online_upload',
        // @ts-expect-error
        attempt: this.props.submission.attempt,
        // @ts-expect-error
        fileIds: updatedFiles.map(file => file._id),
      },
    })

    if (this._isMounted) {
      this.setState({
        messages: [],
      })
    }

    const focusElement =
      this.getDraftAttachments().length === 0 || fileIndex === 0
        ? 'inputFileDrop'
        : this.getDraftAttachments()[fileIndex - 1]._id

    // TODO: this could break if there is ever another element in the dom that
    //       shares an id. As we are using _id (ie, '4') as the id, it's not
    //       exactly a great unique id. Should probably swap to using refs here.
    // @ts-expect-error
    document.getElementById(focusElement).focus()
  }

  renderUploadBox() {
    // @ts-expect-error
    const {desktopOnly, desktop, mobileOnly} = this.props.breakpoints

    const fileDropLabel = (
      <View background="primary" as="div">
        {desktopOnly && (
          <ScreenReaderContent>
            {I18n.t('Drag a file here, or click to select a file to upload')}
          </ScreenReaderContent>
        )}
        <Flex direction="column" justifyItems="center" padding="large">
          <Flex.Item>
            <Img src={UploadFileSVG} width="160px" />
          </Flex.Item>
          <Flex.Item padding="medium 0 0 0">
            <Flex direction="column" textAlign="center">
              {desktopOnly && (
                <Flex.Item margin="0 0 small 0" overflowY="visible">
                  <Text size="x-large">{I18n.t('Drag a file here, or')}</Text>
                </Flex.Item>
              )}
              <Flex.Item>
                <Text color="brand" size="medium">
                  {I18n.t('Choose a file to upload')}
                </Text>
              </Flex.Item>
              {/* @ts-expect-error */}
              {this.props.assignment.allowedExtensions.length && (
                <Flex.Item>
                  {I18n.t('File permitted: %{fileTypes}', {
                    // @ts-expect-error
                    fileTypes: this.props.assignment.allowedExtensions
                      // @ts-expect-error
                      .map(ext => ext.toUpperCase())
                      .join(', '),
                  })}
                </Flex.Item>
              )}
            </Flex>
          </Flex.Item>
        </Flex>
      </View>
    )

    // @ts-expect-error
    const {allowedExtensions} = this.props.assignment
    const allowWebcamUploads =
      allowedExtensions.length === 0 ||
      // @ts-expect-error
      allowedExtensions.some(extension => extension.toLowerCase() === 'png')

    const flexLineProps = {
      ...(desktop
        ? {width: '120px', padding: '0 xx-small', height: '310px'}
        : {width: '400px', height: '50px', padding: 'small'}),
      ...(mobileOnly && {width: '100%'}),
    }
    const lineContainerStyle = {
      display: 'flex',
      height: '100%',
      position: 'relative',
      flexDirection: desktop ? 'column' : 'row',
      justifyContent: 'center',
      alignItems: 'center',
    }
    const textOrStyle = {
      display: desktop ? 'block' : 'inline',
      width: desktop ? '100%' : '60px',
      zIndex: 99,
      backgroundColor: theme.colors.contrasts.grey1111,
      padding: desktop ? `${theme.spacing.medium} 0` : '0',
    }
    const lineStyle = {
      height: desktop ? '100%' : '1px',
      width: desktop ? '1px' : '100%',
      left: desktop ? '50%' : '0',
      position: 'absolute',
      backgroundColor: theme.colors.contrasts.grey4570,
    }

    return (
      <StudentViewContext.Consumer>
        {context => (
          <div data-testid="upload-box">
            <Flex
              justifyItems="center"
              alignItems="center"
              wrap={desktop ? 'no-wrap' : 'wrap'}
              direction={desktop ? 'row' : 'column'}
            >
              <Flex.Item overflowY="visible" width={mobileOnly ? '100%' : '400px'}>
                <FileDrop
                  accept={
                    // @ts-expect-error
                    this.props.assignment.allowedExtensions.length
                      ? // @ts-expect-error
                        this.props.assignment.allowedExtensions
                      : ''
                  }
                  id="inputFileDrop"
                  interaction={!context.allowChangesToSubmission ? 'readonly' : 'enabled'}
                  data-testid="input-file-drop"
                  margin="xx-small"
                  messages={this.state.messages}
                  onDropAccepted={files => this.handleDropAccepted(files)}
                  onDropRejected={this.handleDropRejected}
                  onClick={this.clearErrors}
                  renderLabel={fileDropLabel}
                  shouldAllowMultiple={true}
                  shouldEnablePreview={true}
                />
              </Flex.Item>
              {context.allowChangesToSubmission && (
                <Flex.Item textAlign="center" as="div" {...flexLineProps}>
                  {/* @ts-expect-error */}
                  <div style={lineContainerStyle}>
                    <span style={textOrStyle}>{I18n.t('or')}</span>
                    {/* @ts-expect-error */}
                    <div style={lineStyle}>&nbsp;</div>
                  </div>
                </Flex.Item>
              )}
              {context.allowChangesToSubmission && (
                <Flex.Item
                  padding="xx-small"
                  width={mobileOnly ? '100%' : desktop ? '330px' : '400px'}
                >
                  <MoreOptions
                    // @ts-expect-error
                    allowedExtensions={this.props.assignment.allowedExtensions}
                    // @ts-expect-error
                    assignmentID={this.props.assignment._id}
                    // @ts-expect-error
                    courseID={this.props.assignment.env.courseId}
                    handleCanvasFiles={this.handleCanvasFiles}
                    handleWebcamPhotoUpload={
                      allowWebcamUploads ? this.handleWebcamPhotoUpload : null
                    }
                    renderCanvasFiles={true}
                    // @ts-expect-error
                    userID={this.props.assignment.env.currentUser?.id}
                  />
                </Flex.Item>
              )}
            </Flex>
          </div>
        )}
      </StudentViewContext.Consumer>
    )
  }

  // @ts-expect-error
  renderFileProgress = file => {
    // If we're calling this function, we know that "file" represents one of
    // the entries in the filesToUpload prop, and so it will have values
    // representing the progress of the upload.
    const {name, loaded, total} = file

    return (
      <ProgressBar
        formatScreenReaderValue={({valueNow, valueMax}) => {
          return Math.round((valueNow / valueMax) * 100) + ' percent'
        }}
        meterColor="brand"
        screenReaderLabel={I18n.t('Upload progress for %{name}', {name})}
        size="x-small"
        valueMax={total}
        valueNow={loaded}
      />
    )
  }

  // @ts-expect-error
  renderTableRow = file => {
    // "file" is either a previously-uploaded file or one being uploaded right
    // now.  For the former, we can use the displayName property; files being
    // uploaded don't have that set yet, so use the local name (which we've set
    // to the URL for files from an LTI).
    const displayName = file.displayName || file.name
    const cellTheme = {background: theme.colors.contrasts.grey1111}

    return (
      <Table.Row key={file._id}>
        <Table.Cell themeOverride={cellTheme}>{getFileThumbnail(file, 'small')}</Table.Cell>
        <Table.Cell themeOverride={cellTheme}>
          {displayName && (
            <>
              <span aria-hidden={true} title={displayName}>
                {elideString(displayName)}
              </span>
              <ScreenReaderContent>{displayName}</ScreenReaderContent>
            </>
          )}
        </Table.Cell>
        <Table.Cell themeOverride={cellTheme}>
          {file.isLoading && this.renderFileProgress(file)}
        </Table.Cell>
        <Table.Cell themeOverride={cellTheme}>
          {!file.isLoading && <IconCompleteSolid color="success" />}
        </Table.Cell>
        <Table.Cell themeOverride={cellTheme}>
          {!file.isLoading && (
            <IconButton
              id={file._id}
              onClick={this.handleRemoveFile}
              screenReaderLabel={I18n.t('Remove %{displayName}', {displayName})}
              size="small"
              withBackground={false}
              withBorder={false}
            >
              <IconTrashLine />
            </IconButton>
          )}
        </Table.Cell>
      </Table.Row>
    )
  }

  // @ts-expect-error
  renderUploadedFiles = files => {
    const cellTheme = {background: theme.colors.contrasts.grey1111}

    return (
      <Table caption={I18n.t('Uploaded files')} data-testid="uploaded_files_table">
        <Table.Head>
          <Table.Row>
            <Table.ColHeader id="thumbnail" width="1rem" themeOverride={cellTheme} />
            <Table.ColHeader id="filename" themeOverride={cellTheme}>
              {I18n.t('File Name')}
            </Table.ColHeader>
            <Table.ColHeader id="upload-progress" width="30%" themeOverride={cellTheme} />
            <Table.ColHeader id="upload-success" width="1rem" themeOverride={cellTheme} />
            <Table.ColHeader id="delete" width="1rem" themeOverride={cellTheme} />
          </Table.Row>
        </Table.Head>
        <Table.Body>{files.map(this.renderTableRow)}</Table.Body>
      </Table>
    )
  }

  render() {
    let files = this.getDraftAttachments()
    // @ts-expect-error
    if (this.props.filesToUpload.length) {
      // @ts-expect-error
      files = files.concat(this.props.filesToUpload)
    }

    return (
      <>
        <Flex
          id="file-upload-container"
          data-testid="upload-pane"
          direction="column"
          width="100%"
          alignItems="stretch"
        >
          {files.length > 0 && (
            <Flex.Item padding="0 x-large x-large">{this.renderUploadedFiles(files)}</Flex.Item>
          )}

          <Flex.Item overflowY="hidden" padding="large small">
            {this.renderUploadBox()}
          </Flex.Item>
        </Flex>
        {/* @ts-expect-error */}
        {this.state.showErrorMessage && (
          <View as="div" padding="small 0 0 0" background="primary">
            <FormattedErrorMessage message={FILE_REQUIRED_ERROR_MESSAGE} />
          </View>
        )}
      </>
    )
  }
}

FileUpload.contextType = AlertManagerContext

export default WithBreakpoints(FileUpload)
