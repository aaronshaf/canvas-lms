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
import {getAutoTrack} from '@canvas/canvas-media-player'
import {Assignment} from '@canvas/assignments/graphql/student/Assignment'
import {bool, func, string, object} from 'prop-types'
import elideString from '../../helpers/elideString'
import {isSubmitted} from '../../helpers/SubmissionHelpers'
import {useScope as createI18nScope} from '@canvas/i18n'
import {IconTrashLine, IconUploadLine, IconAttachMediaSolid} from '@instructure/ui-icons'
import {Img} from '@instructure/ui-img'
import LoadingIndicator from '@canvas/loading-indicator'
import React from 'react'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {Submission} from '@canvas/assignments/graphql/student/Submission'
import StudentViewContext from '@canvas/assignments/react/StudentViewContext'
import PhotographerPandaSVG from '../../../images/PhotographerPanda.svg'
import UploadFileSVG from '../../../images/UploadFile.svg'
import UploadMedia from '@instructure/canvas-media'
import CanvasStudioPlayer from '@canvas/canvas-studio-player'
import {
  UploadMediaStrings,
  MediaCaptureStrings,
  SelectStrings,
} from '@canvas/upload-media-translations'
import WithBreakpoints, {breakpointsShape} from '@canvas/with-breakpoints'

import {Button} from '@instructure/ui-buttons'
import {Flex} from '@instructure/ui-flex'
import {MediaPlayer} from '@instructure/ui-media-player'
import theme from '@instructure/canvas-theme'
import {View} from '@instructure/ui-view'
import FormattedErrorMessage from '@canvas/assignments/react/FormattedErrorMessage'

const I18n = createI18nScope('assignments_2_media_attempt')
const MEDIA_ERROR_MESSAGE = I18n.t('At least one submission type is required')

export const VIDEO_SIZE_OPTIONS = {height: '400px', width: '768px'}

class MediaAttempt extends React.Component {
  static propTypes = {
    assignment: Assignment.shape.isRequired,
    breakpoints: breakpointsShape,
    createSubmissionDraft: func.isRequired,
    focusOnInit: bool.isRequired,
    submission: Submission.shape.isRequired,
    updateUploadingFiles: func.isRequired,
    uploadingFiles: bool.isRequired,
    setIframeURL: func.isRequired,
    iframeURL: string,
    submitButtonRef: object,
  }

  state = {
    mediaModalOpen: false,
    mediaModalTabs: {record: false, upload: false},
    showErrorMessage: false,
  }

  componentDidMount() {
    if (
      // @ts-expect-error
      this.props.focusOnInit &&
      // @ts-expect-error
      !this.props.uploadingFiles &&
      // @ts-expect-error
      !isSubmitted(this.props.submission) &&
      // @ts-expect-error
      !this.props.submission.submissionDraft?.mediaObject?._id
    ) {
      // @ts-expect-error
      this._mediaUploadRef.focus()
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
    // @ts-expect-error
    this.props.submitButtonRef.current?.removeEventListener('click', this.handleSubmitClick)
  }

  handleSubmitClick = () => {
    // @ts-expect-error
    if (!this.props.submission.submissionDraft?.meetsMediaRecordingCriteria) {
      // @ts-expect-error
      this._mediaUploadRef.focus()
      const container = document.getElementById('media_upload_container')
      container?.classList.add('error-outline')
      // @ts-expect-error
      this._mediaUploadRef.current?.setAttribute('aria-label', MEDIA_ERROR_MESSAGE)
      this.setState({showErrorMessage: true})
    }
  }

  // @ts-expect-error
  onComplete = (err, data) => {
    if (err) {
      // @ts-expect-error
      this.context.setOnFailure(I18n.t('There was an error submitting your attempt.'))
    } else {
      // @ts-expect-error
      this.props.updateUploadingFiles(true)
      if (data.mediaObject.embedded_iframe_url) {
        // @ts-expect-error
        this.props.setIframeURL(data.mediaObject.embedded_iframe_url)
      }
      // @ts-expect-error
      this.props.createSubmissionDraft({
        variables: {
          // @ts-expect-error
          id: this.props.submission.id,
          activeSubmissionType: 'media_recording',
          // @ts-expect-error
          attempt: this.props.submission.attempt || 1,
          mediaId: data.mediaObject.media_object.media_id,
        },
      })
    }
  }

  onDismiss = () => {
    this.setState({mediaModalOpen: false})
  }

  handleRemoveFile = () => {
    // @ts-expect-error
    this.props.updateUploadingFiles(true)
    // @ts-expect-error
    this.props.createSubmissionDraft({
      variables: {
        // @ts-expect-error
        id: this.props.submission.id,
        activeSubmissionType: 'media_recording',
        // @ts-expect-error
        attempt: this.props.submission.attempt || 1,
      },
    })
    // @ts-expect-error
    this.props.setIframeURL('')
  }

  // @ts-expect-error
  handleMediaClick = (record, upload) => {
    if (this.state.showErrorMessage) {
      // clear errors
      const container = document.getElementById('media_upload_container')
      container?.classList.remove('error-outline')
    }
    // @ts-expect-error
    this._mediaUploadRef.current?.removeAttribute('aria-label')
    this.setState({
      mediaModalTabs: {record: record, upload: upload},
      mediaModalOpen: true,
      showErrorMessage: false,
    })
  }

  // @ts-expect-error
  renderMediaComponent = (mediaId, mediaTracks, mediaSources, autoCCTrack) => {
    return ENV.FEATURES?.consolidated_media_player ? (
      <CanvasStudioPlayer media_id={mediaId} explicitSize={{width: '100%', height: '100%'}} />
    ) : (
      <MediaPlayer
        tracks={mediaTracks}
        sources={mediaSources}
        captionPosition="bottom"
        autoShowCaption={autoCCTrack}
      />
    )
  }

  // @ts-expect-error
  renderMediaPlayer = (mediaObject, renderTrashIcon) => {
    if (!mediaObject) {
      return null
    }
    // @ts-expect-error
    const mediaSources = mediaObject.mediaSources.map(mediaSource => ({
      ...mediaSource,
      label: `${mediaSource.width}x${mediaSource.height}`,
    }))

    const mediaId = mediaObject._id
    // @ts-expect-error
    const mediaTracks = mediaObject.mediaTracks.map(track => ({
      src: `/media_objects/${mediaObject._id}/media_tracks/${track._id}`,
      label: track.locale,
      type: track.kind,
      language: track.locale,
    }))
    // @ts-expect-error
    const shouldRenderWithIframeURL = mediaObject.mediaSources.length === 0 && this.props.iframeURL
    const autoCCTrack = getAutoTrack(mediaObject.mediaTracks)
    const {height, width} = mediaObject.mediaSources[0] || {}
    const ratio = Math.max(height && width ? (height / width) * 100 - 15 : 40, 30)

    return (
      <Flex direction="column" alignItems="center">
        <Flex.Item data-testid="media-recording" width="100%" height={`${ratio}vw`}>
          {shouldRenderWithIframeURL ? (
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '0',
                paddingBottom: '56.25%', // 16:9 aspect ratio
              }}
            >
              <iframe
                // @ts-expect-error
                src={this.props.iframeURL}
                title="preview"
                style={{
                  position: 'absolute',
                  border: 'none',
                  minWidth: '100%',
                  minHeight: '100%',
                }}
              />
            </div>
          ) : (
            this.renderMediaComponent(mediaId, mediaTracks, mediaSources, autoCCTrack)
          )}
        </Flex.Item>
        <Flex.Item overflowY="visible" margin="medium 0">
          <span aria-hidden={true} title={mediaObject.title}>
            {elideString(mediaObject.title)}
          </span>
          <ScreenReaderContent>{mediaObject.title}</ScreenReaderContent>
          {renderTrashIcon && (
            <Button
              data-testid="remove-media-recording"
              // @ts-expect-error
              renderIcon={IconTrashLine}
              id={mediaObject.id}
              margin="0 0 0 x-small"
              onClick={this.handleRemoveFile}
              size="small"
            >
              <ScreenReaderContent>
                {I18n.t('Remove %{filename}', {filename: mediaObject.title})}
              </ScreenReaderContent>
            </Button>
          )}
        </Flex.Item>
      </Flex>
    )
  }

  renderSubmissionDraft = () => {
    // @ts-expect-error
    const mediaObject = this.props.submission.submissionDraft.mediaObject
    return this.renderMediaPlayer(mediaObject, true)
  }

  renderSubmission = () => {
    // @ts-expect-error
    const mediaObject = this.props.submission.mediaObject
    return this.renderMediaPlayer(mediaObject, false)
  }

  renderMediaUpload = () => {
    // @ts-expect-error
    const {desktop} = this.props.breakpoints
    return (
      <>
        <UploadMedia
          onUploadComplete={this.onComplete}
          onDismiss={this.onDismiss}
          rcsConfig={{
            contextId: ENV.current_user.id,
            contextType: 'user',
          }}
          open={this.state.mediaModalOpen}
          tabs={this.state.mediaModalTabs}
          uploadMediaTranslations={{UploadMediaStrings, MediaCaptureStrings, SelectStrings}}
          liveRegion={() => document.getElementById('flash_screenreader_holder')}
          userLocale={ENV.LOCALE}
          useStudioPlayer={ENV.FEATURES?.consolidated_media_player}
        />
        <StudentViewContext.Consumer>
          {context => (
            <>
              <Flex
                id="media_upload_container"
                alignItems="center"
                justifyItems="center"
                direction={desktop ? 'row' : 'column'}
              >
                <Flex.Item margin="small">
                  <View
                    as="div"
                    height="350px"
                    width="400px"
                    borderRadius="large"
                    background="primary"
                  >
                    <Flex
                      direction="column"
                      alignItems="center"
                      justifyItems="space-around"
                      height="100%"
                      // @ts-expect-error
                      shouldShrink={true}
                    >
                      <Flex.Item>
                        <Img
                          src={PhotographerPandaSVG}
                          alt=""
                          height="180px"
                          data-testid="record-media-image"
                        />
                      </Flex.Item>
                      <Flex.Item overflowY="visible">
                        <Button
                          data-testid="open-record-media-modal-button"
                          disabled={!context.allowChangesToSubmission}
                          // @ts-expect-error
                          renderIcon={IconAttachMediaSolid}
                          color="primary"
                          elementRef={el => {
                            // @ts-expect-error
                            this._mediaUploadRef = el
                          }}
                          onClick={() => this.handleMediaClick(true, false)}
                        >
                          {I18n.t('Record Media')}
                        </Button>
                      </Flex.Item>
                    </Flex>
                  </View>
                </Flex.Item>
                <Flex.Item margin="medium">
                  <Flex
                    direction={desktop ? 'column' : 'row'}
                    justifyItems="space-between"
                    alignItems="center"
                  >
                    <Flex.Item>
                      <div
                        style={{
                          // @ts-expect-error
                          backgroundColor: theme.colors.backgroundDark,
                          height: desktop ? '9em' : '1px',
                          width: desktop ? '1px' : '9em',
                        }}
                      />
                    </Flex.Item>
                    <Flex.Item color="darkgrey" margin="small">
                      {I18n.t('or')}
                    </Flex.Item>
                    <Flex.Item>
                      <div
                        style={{
                          // @ts-expect-error
                          backgroundColor: theme.colors.backgroundDark,
                          height: desktop ? '9em' : '1px',
                          width: desktop ? '1px' : '9em',
                        }}
                      />
                    </Flex.Item>
                  </Flex>
                </Flex.Item>
                <Flex.Item margin="medium">
                  <View
                    as="div"
                    height="350px"
                    width="400px"
                    borderRadius="large"
                    background="primary"
                  >
                    <Flex
                      direction="column"
                      alignItems="center"
                      justifyItems="space-around"
                      height="100%"
                      // @ts-expect-error
                      shouldShrink={true}
                    >
                      <Flex.Item>
                        <Img
                          src={UploadFileSVG}
                          alt=""
                          height="180px"
                          data-testid="upload-media-image"
                        />
                      </Flex.Item>
                      <Flex.Item overflowY="visible">
                        <Button
                          data-testid="open-upload-media-modal-button"
                          disabled={!context.allowChangesToSubmission}
                          // @ts-expect-error
                          renderIcon={IconUploadLine}
                          color="primary"
                          onClick={() => this.handleMediaClick(false, true)}
                        >
                          {I18n.t('Upload Media')}
                        </Button>
                      </Flex.Item>
                    </Flex>
                  </View>
                </Flex.Item>
              </Flex>
              {this.state.showErrorMessage && (
                <View as="div" padding="small 0 0 0" background="primary">
                  <FormattedErrorMessage message={MEDIA_ERROR_MESSAGE} />
                </View>
              )}
            </>
          )}
        </StudentViewContext.Consumer>
      </>
    )
  }

  render() {
    // @ts-expect-error
    if (this.props.uploadingFiles) {
      return <LoadingIndicator />
    }

    // @ts-expect-error
    if (isSubmitted(this.props.submission)) {
      return this.renderSubmission()
    }

    // @ts-expect-error
    if (this.props.submission.submissionDraft?.mediaObject?._id) {
      return this.renderSubmissionDraft()
    }

    return this.renderMediaUpload()
  }
}

MediaAttempt.contextType = AlertManagerContext

export default WithBreakpoints(MediaAttempt)
