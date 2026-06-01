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

import {captureException} from '@sentry/browser'
import {canvas, canvasHighContrast} from '@instructure/ui-themes'
import {getTypography} from '@instructure/platform-instui-bindings'
import ready from '@instructure/ready'

ready(async () => {
  const mountPoint = document.getElementById('oak-settings-mount')
  if (!mountPoint) return

  try {
    console.log('[OakSettings] Loading remote module...')
    const module = await import('igniteagent/adminConfig')
    console.log('[OakSettings] Remote module loaded successfully')

    if (typeof module.render !== 'function') {
      throw new Error('[OakSettings] adminConfig module does not export a render function')
    }

    const isHighContrast = Boolean(window.ENV?.use_high_contrast)
    const baseTheme = isHighContrast ? canvasHighContrast : canvas
    // Do not spread brand vars in HC mode — brand colors would override HC colors (a11y regression)
    const brandVars = isHighContrast ? {} : (window.CANVAS_ACTIVE_BRAND_VARIABLES ?? {})
    const props = {
      hostTheme: {
        ...baseTheme,
        ...brandVars,
        typography: {
          ...baseTheme.typography,
          ...getTypography(
            Boolean(ENV.K5_USER),
            Boolean(ENV.USE_CLASSIC_FONT),
            Boolean(ENV.use_dyslexic_font),
          ),
        },
      },
    }

    module.render(mountPoint, props)
  } catch (err) {
    const loadError = err instanceof Error ? err : new Error(String(err))
    console.error('[OakSettings] Failed to load IgniteAI Agent admin module:', loadError)
    captureException(loadError)
  }
})
