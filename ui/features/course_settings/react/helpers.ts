/*
 * Copyright (C) 2016 - present Instructure, Inc.
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

interface FileInfo {
  file: File
  type: string
}

const Helpers = {
  isValidImageType(mimeType: string): boolean {
    return [
      'image/apng',
      'image/avif',
      'image/bmp',
      'image/gif',
      'image/jpeg',
      'image/png',
      'image/svg+xml',
      'image/webp',
    ].includes(mimeType)
  },

  extractInfoFromEvent(
    event: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLElement>
  ): FileInfo {
    let file: File
    let type: string
    if (event.type === 'change') {
      const target = event.target as HTMLInputElement
      file = target.files![0]
      type = file.type
    } else {
      const dragEvent = event as React.DragEvent<HTMLElement>
      file = dragEvent.dataTransfer.files[0]
      type = file.type
    }

    return {file, type}
  },
}

export default Helpers
