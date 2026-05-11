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

import React, {useState} from 'react'
import {createRoot} from 'react-dom/client'
import {useTranslation} from '@canvas/i18next'
import {Button} from '@instructure/ui-buttons'
import {CanvasModal, CanvasModalProps} from '@instructure/platform-instui-bindings'
import {canvasErrorComponent} from '@canvas/canvas-error-page'
import {TextInput, TextInputProps} from '@instructure/ui-text-input'

const dialogHolderId = 'confirmation_dialog_with_prompt_holder'

type ButtonColor = 'primary' | 'primary-inverse' | 'secondary' | 'success' | 'danger'

interface ConfirmationDialogWithPromptProps extends ShowConfirmationDialogWithPromptOptions {
  open: boolean
  onConfirm: (value: string) => void
  onReject: () => void
}

export default function ConfirmationDialogWithPrompt({
  open,
  label,
  body,
  inputLabel,
  inputPlaceholder,
  confirmColor,
  confirmText,
  onConfirm,
  onReject,
  size = 'medium',
  initialValue = '',
  inputMode = 'text',
}: ConfirmationDialogWithPromptProps) {
  const {t} = useTranslation('ConfirmationDialogWithPrompt')
  const [inputValue, setInputValue] = useState(initialValue)

  const handleConfirm = () => {
    onConfirm(inputValue)
  }

  return (
    <CanvasModal
      label={label}
      onDismiss={onReject}
      open={open}
      size={size}
      closeButtonLabel={t('Close')}
      errorComponent={canvasErrorComponent()}
      footer={
        <>
          <Button key="cancel" data-testid="cancel-button" onClick={onReject}>
            {t('Cancel')}
          </Button>
          <Button
            key="confirm"
            data-testid="confirm-button"
            margin="0 0 0 small"
            color={confirmColor || 'primary'}
            onClick={handleConfirm}
          >
            {confirmText || t('Confirm')}
          </Button>
        </>
      }
    >
      <>
        {body}
        <TextInput
          renderLabel={inputLabel}
          placeholder={inputPlaceholder}
          value={inputValue}
          inputMode={inputMode}
          onChange={(_event, value) => setInputValue(value)}
          data-testid="prompt-input"
        />
      </>
    </CanvasModal>
  )
}

interface ShowConfirmationDialogWithPromptOptions {
  label: string
  body: React.ReactNode
  inputLabel: string
  inputPlaceholder?: string
  confirmColor?: ButtonColor
  confirmText?: string
  size?: CanvasModalProps['size']
  inputMode?: TextInputProps['inputMode']
  initialValue?: string
}

export async function showConfirmationDialogWithPrompt({
  label,
  body,
  inputLabel,
  inputPlaceholder,
  confirmText,
  confirmColor,
  size = 'medium',
  initialValue,
  inputMode,
}: ShowConfirmationDialogWithPromptOptions): Promise<string> {
  let resolver!: (value: string) => void
  let rejecter!: () => void
  const returnedPromise = new Promise<string>((resolve, reject) => {
    resolver = resolve
    rejecter = reject
  })

  function getDialogContainer(): HTMLElement {
    let dialogContainer = document.getElementById(dialogHolderId)
    if (!dialogContainer) {
      dialogContainer = document.createElement('div')
      dialogContainer.id = dialogHolderId
      document.body.appendChild(dialogContainer)
    }
    return dialogContainer
  }

  const container = getDialogContainer()
  const root = createRoot(container)

  const confirmationFunction = (value: string) => {
    root.unmount()
    resolver(value)
  }

  const rejectFunction = () => {
    root.unmount()
    rejecter()
  }

  root.render(
    <ConfirmationDialogWithPrompt
      open={true}
      label={label}
      inputLabel={inputLabel}
      inputPlaceholder={inputPlaceholder}
      inputMode={inputMode}
      confirmColor={confirmColor}
      confirmText={confirmText}
      onConfirm={confirmationFunction}
      onReject={rejectFunction}
      size={size}
      initialValue={initialValue}
      body={body}
    />,
  )

  return returnedPromise
}
