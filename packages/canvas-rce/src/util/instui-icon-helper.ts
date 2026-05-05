/*
 * Copyright (C) 2023 - present Instructure, Inc.
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

import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import * as AllIcons from '@instructure/ui-icons'

export interface InstUiIcon {
  variant: 'Line' | 'Solid'
  glyphName: string
  src: string
  deprecated: boolean
}

// Emotion injects <style> tags during SSR; TinyMCE/SVGIcon need raw SVG strings
export function renderIconSvg(IconComponent: React.ComponentType<any>): string {
  return renderToStaticMarkup(createElement(IconComponent)).replace(
    /<style\b[^>]*>[\s\S]*?<\/style>/g,
    '',
  )
}

// Map of "glyphName:variant" → component, built once on first use (no rendering)
let _iconMap: Map<string, React.ComponentType<any>> | null = null

function getIconMap(): Map<string, React.ComponentType<any>> {
  if (!_iconMap) {
    _iconMap = new Map()
    for (const val of Object.values(AllIcons) as any[]) {
      if (typeof val === 'function' && val.glyphName && val.variant) {
        _iconMap.set(`${val.glyphName}:${val.variant}`, val)
      }
    }
  }
  return _iconMap
}

export function findInstUiIconSvg(glyphName: string, variant: 'Line' | 'Solid'): string | null {
  const IconComponent = getIconMap().get(`${glyphName}:${variant}`)
  return IconComponent ? renderIconSvg(IconComponent) : null
}
