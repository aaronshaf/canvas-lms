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

import {GenericErrorPage} from '@instructure/platform-generic-error-page'
import {errorPageTranslations, reportError} from '@canvas/canvas-error-page'
import {useTranslation} from '@canvas/i18next'
import errorShipUrl from '@instructure/platform-images/assets/ErrorShip.svg'

export const FilesGenericErrorPage = () => {
  const {t} = useTranslation('files_v2')
  return (
    <GenericErrorPage
      imageUrl={errorShipUrl}
      onReportError={reportError}
      translations={errorPageTranslations}
      errorSubject={t('Files Index initial query error')}
      errorCategory={t('Files Index Error Page')}
    />
  )
}
