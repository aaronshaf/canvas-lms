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

import {Folder, File} from '../interfaces/File'

export type BackboneModel = {attributes: File}

export type MainFolderWrapperListener = (event: FilesCollectionEvent) => void

export type FilesCollectionEvent = 'add'

export class FileFolderWrapper {
  private fileOrFolder: File | Folder

  constructor(fileOrFolder: File | Folder) {
    this.fileOrFolder = fileOrFolder
  }

  get<T>(attribute: string) {
    return this.fileOrFolder[attribute] as T
  }
}

export class FilesCollectionWrapper extends Array<FileFolderWrapper> {
  private readonly folder: MainFolderWrapper

  constructor(folder: MainFolderWrapper) {
    super()
    this.folder = folder
  }

  // This is used in ui/shared/files/react/modules/FileOptionsCollection.jsx,
  // needed for compatibility
  add(item: BackboneModel) {
    const fileWrapper = new FileFolderWrapper(item.attributes)
    this.push(fileWrapper)
    this.folder.emit('add')
  }

  set(items: Array<FileFolderWrapper>) {
    this.clear()
    items.forEach(i => this.push(i))
  }

  clear() {
    this.length = 0
  }
}

export class MainFolderWrapper {
  private readonly folder: Folder
  private readonly filesCollection: FilesCollectionWrapper
  private readonly listeners: Set<MainFolderWrapperListener>

  constructor(folder: Folder) {
    this.folder = folder
    this.filesCollection = new FilesCollectionWrapper(this)
    this.listeners = new Set()
  }

  get<T>(attribute: string) {
    return this.folder[attribute] as T
  }

  addListener(listener: MainFolderWrapperListener) {
    this.listeners.add(listener)
  }

  removeListener(listener: MainFolderWrapperListener) {
    this.listeners.delete(listener)
  }

  emit(event: FilesCollectionEvent) {
    this.listeners.forEach(listener => listener(event))
  }

  get files() {
    return this.filesCollection
  }

  get id() {
    return this.folder.id
  }
}
