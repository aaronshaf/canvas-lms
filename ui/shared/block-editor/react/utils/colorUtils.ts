/*
 * Copyright (C) 2024 - present Instructure, Inc.
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

import {type SerializedNode} from '@craftjs/core'
import tinycolor from 'tinycolor2'
import conversions, {contrast} from '@instructure/ui-color-utils'
import {white, black} from './constants'

type ColorsInUse = {
  foreground: string[]
  background: string[]
  border: string[]
}

const isTransparent = (color?: string): boolean => {
  if (!color) return true
  const c = tinycolor(color)
  return c.isValid() && c.getAlpha() === 0
}

const INSTUIcalcBlendedColor = (
  c1: {r: number; g: number; b: number; a: number},
  c2: {r: number; g: number; b: number; a: number},
) => {
  const alpha = 1 - (1 - c1.a) * (1 - c2.a)
  return {
    r: (c2.r * c2.a) / alpha + (c1.r * c1.a * (1 - c2.a)) / alpha,
    g: (c2.g * c2.a) / alpha + (c1.g * c1.a * (1 - c2.a)) / alpha,
    b: (c2.b * c2.a) / alpha + (c1.b * c1.a * (1 - c2.a)) / alpha,
    a: 1,
  }
}

const getContrastStatus = (color1: string, color2: string): boolean => {
  const c1RGBA = conversions.colorToRGB(color1)
  const c2RGBA = conversions.colorToRGB(color2)
  const c1OnWhite = INSTUIcalcBlendedColor({r: 255, g: 255, b: 255, a: 1}, c1RGBA)
  const c2OnC1OnWhite = INSTUIcalcBlendedColor(c1OnWhite, c2RGBA)
  return (
    contrast(conversions.colorToHex8(c1OnWhite), conversions.colorToHex8(c2OnC1OnWhite), 2) >= 4.5
  )
}

const getDefaultColors = (): string[] => {
  const fontcolor =
    window
      .getComputedStyle(document.documentElement)
      .getPropertyValue('--ic-brand-font-color-dark') || '#000000'
  return [fontcolor.toLowerCase(), '#ffffff']
}

const getContrastingColor = (color1: string) => {
  const color2 = contrast(color1, white) > contrast(color1, black) ? white : black
  return color2
}

const getContrastingButtonColor = (color1: string) => {
  const buttonColor = color1 === white ? 'primary-inverse' : 'secondary'
  return buttonColor
}

const getEffectiveBackgroundColor = (elem: HTMLElement | null): string => {
  if (!elem) return '#ffffff'
  let bgcolor = window.getComputedStyle(elem).backgroundColor
  while (isTransparent(bgcolor) && elem.parentElement) {
    elem = elem.parentElement
    bgcolor = window.getComputedStyle(elem).backgroundColor
  }
  return tinycolor(bgcolor).toHexString().toLowerCase()
}

const getEffectiveColor = (elem: HTMLElement) => {
  if (!elem) return '#000000'
  // getComputedStyle returns the effective color.
  // we don't have to walk up the tree
  const color = window.getComputedStyle(elem).color
  return tinycolor(color).toHexString().toLowerCase()
}

const sortByBrightness = (a: string, b: string) => {
  const brightnessA = tinycolor(a).getBrightness()
  const brightnessB = tinycolor(b).getBrightness()
  return brightnessA - brightnessB
}

interface Query {
  getSerializedNodes: () => Record<string, SerializedNode>
}

const getColorsInUse = (query: Query) => {
  const defaultColors = getDefaultColors()

  const colors: ColorsInUse = {
    foreground: [],
    background: [],
    border: [],
  }

  Object.values(query.getSerializedNodes()).forEach(value => {
    const n = value
    if (n.props.color && n.props.color[0] === '#' && !isTransparent(n.props.color)) {
      const c = tinycolor(n.props.color).toHexString().toLowerCase()
      if (!(defaultColors.includes(c) || colors.foreground.includes(c))) {
        colors.foreground.push(c)
      }
    }

    if (n.props.background && n.props.background[0] === '#' && !isTransparent(n.props.background)) {
      const c = tinycolor(n.props.background).toHexString().toLowerCase()
      if (!(defaultColors.includes(c) || colors.background.includes(c))) {
        colors.background.push(c)
      }
    }

    if (
      n.props.borderColor &&
      n.props.borderColor[0] === '#' &&
      !isTransparent(n.props.borderColor)
    ) {
      const c = tinycolor(n.props.borderColor).toHexString().toLowerCase()
      if (!(defaultColors.includes(c) || colors.border.includes(c))) {
        colors.border.push(c)
      }
    }
  })
  colors.foreground.sort(sortByBrightness)
  colors.background.sort(sortByBrightness)
  colors.border.sort(sortByBrightness)
  return colors
}

export {
  getContrastingColor,
  getContrastingButtonColor,
  getContrastStatus,
  isTransparent,
  getEffectiveBackgroundColor,
  getEffectiveColor,
  getColorsInUse,
  getDefaultColors,
  white,
  black,
  type ColorsInUse,
}
