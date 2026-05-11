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

import {useScope as createI18nScope} from '@canvas/i18n'
import {showConfirmationDialogWithPrompt} from '@canvas/dialogs/react/ConfirmationDialogWithPrompt'
import doFetchApi, {FetchApiError} from '@canvas/do-fetch-api-effect'
import {showFlashError} from '@instructure/platform-alerts'

const I18n = createI18nScope('profile')

interface SendVerificationResponse {
  otp_sent?: boolean
  channel_type?: 'sms' | 'email'
  masked_path?: string
  otp_not_required?: boolean
  error?: string
}

/**
 * This function will prompt the user to enter an MFA code
 * using a modal dialog. It first attempts to send an OTP if the user
 * has SMS or email-based MFA configured. It returns a promise that resolves
 * with the entered code, or rejects if the user cancels the dialog.
 * @returns Promise that resolves with the verification code
 */
export async function promptForMfaCode(options: {
  label: string
  confirmText: string
}): Promise<string> {
  let bodyText: string

  // Try to send OTP if user has SMS or email configured
  try {
    const {json} = await doFetchApi<SendVerificationResponse>({
      path: '/users/self/mfa/send_otp',
      method: 'POST',
    })

    if (json?.otp_sent && json.channel_type && json.masked_path) {
      if (json.channel_type === 'sms') {
        bodyText = I18n.t(
          'body.enter_mfa_code_sent_sms',
          'A verification code has been sent to %{phone}. Please enter the code below, or use a backup code.',
          {phone: json.masked_path},
        )
      } else {
        bodyText = I18n.t(
          'body.enter_mfa_code_sent_email',
          'A verification code has been sent to %{email}. Please enter the code below, or use a backup code.',
          {email: json.masked_path},
        )
      }
    } else {
      // Authenticator app - no OTP needed
      bodyText = I18n.t(
        'body.enter_mfa_code_authenticator',
        'Please enter your current verification code from your authenticator app or a backup code.',
      )
    }
  } catch (error: unknown) {
    let errorMessage = I18n.t(
      'errors.mfa_code_send_failed',
      'Failed to send verification code. Please try again.',
    )

    // Try to extract error message from backend response
    if (error instanceof FetchApiError) {
      try {
        const errorBody = await error.response.json()
        if (errorBody?.error) {
          errorMessage = errorBody.error
        }
      } catch {
        // Failed to parse error response body, use default message
      }
    }

    showFlashError(errorMessage)()
    return Promise.reject(error)
  }

  return showConfirmationDialogWithPrompt({
    label: options.label,
    body: bodyText,
    inputLabel: I18n.t('labels.verification_code', 'Verification Code'),
    inputPlaceholder: I18n.t('placeholders.six_digit_code', 'Enter 6-digit code'),
    confirmText: options.confirmText,
    inputMode: 'numeric',
    size: 'small',
    confirmColor: 'danger',
  }).then(code => code.trim())
}
