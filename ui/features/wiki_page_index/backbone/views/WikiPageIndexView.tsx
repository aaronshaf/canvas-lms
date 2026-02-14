//
// Copyright (C) 2013 - present Instructure, Inc.
//
// This file is part of Canvas.
//
// Canvas is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, version 3 of the License.
//
// Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
// WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
// A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
// details.
//
// You should have received a copy of the GNU Affero General Public License along
// with this program. If not, see <http://www.gnu.org/licenses/>.

import $ from 'jquery'
import React from 'react'
import ReactDOM from 'react-dom'
import {createRoot} from 'react-dom/client'
import {useScope as createI18nScope} from '@canvas/i18n'
import WikiPage from '@canvas/wiki/backbone/models/WikiPage'
import PaginatedCollectionView from '@canvas/pagination/backbone/views/PaginatedCollectionView'
import WikiPageEditView from '@canvas/wiki/backbone/views/WikiPageEditView'
import renderChooseEditorModal from '@canvas/block-editor/react/renderChooseEditorModal'
import itemView from './WikiPageIndexItemView'
import template from '../../jst/WikiPageIndex.handlebars'
import {deletePages} from '../../react/apiClient'
import {showConfirmDelete} from '../../react/ConfirmDeleteModal'
import StickyHeaderMixin from '@canvas/wiki/backbone/views/StickyHeaderMixin'
import splitAssetString from '@canvas/util/splitAssetString'
import ContentTypeExternalToolTray from '@canvas/trays/react/ContentTypeExternalToolTray'
import DirectShareCourseTray from '@canvas/direct-sharing/react/components/DirectShareCourseTray'
import DirectShareUserModal from '@canvas/direct-sharing/react/components/DirectShareUserModal'
import '@canvas/jquery/jquery.disableWhileLoading'
import {ltiState} from '@canvas/lti/jquery/messages'
import ItemAssignToManager from '@canvas/context-modules/differentiated-modules/react/Item/ItemAssignToManager'
import {View} from '@instructure/ui-view'
import {Spinner} from '@instructure/ui-spinner'

const I18n = createI18nScope('pages')

export default class WikiPageIndexView extends PaginatedCollectionView {
  static initClass() {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.mixin(StickyHeaderMixin)
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.mixin({
      events: {
        'click .delete_pages': 'confirmDeletePages',
        'click .new_page': 'openChooseEditorModalMaybe',
        'keyclick .new_page': 'openChooseEditorModalMaybe',
        'click .new_rce_page': 'openRCE',
        'keyclick .new_rce_page': 'openRCE',
        'click .new_block_editor_page': 'openBlockEditor',
        'keyclick .new_block_editor_page': 'openBlockEditor',
        'click .header-row a[data-sort-field]': 'sort',
        'click .header-bar-right .menu_tool_link': 'openExternalTool',
        'click .pages-mobile-header a[data-sort-mobile-field]': 'sortBySelect',
      },

      els: {
        '.no-pages': '$noPages',
        '.no-pages a:first-child': '$noPagesLink',
        '.header-row a[data-sort-field]': '$sortHeaders',
        '#external-tool-mount-point': '$externalToolMountPoint',
        '#copy-to-mount-point': '$copyToMountPoint',
        '#send-to-mount-point': '$sendToMountPoint',
        '#assign-to-mount-point': '$assignToMountPoint',
      },
    })

    this.prototype.template = template
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.prototype.itemView = itemView

    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.optionProperty('default_editing_roles')
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.optionProperty('WIKI_RIGHTS')
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.optionProperty('selectedPages')

    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.lastFocusField = null
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  initialize(options) {
    super.initialize(...arguments)

    // Poor man's dependency injection just so we can stub out the react components
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.DirectShareCourseTray = DirectShareCourseTray
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.DirectShareUserModal = DirectShareUserModal
    // @ts-expect-error TS2551 -- TypeScriptify (no 'any')
    this.ContentTypeExternalToolTray = ContentTypeExternalToolTray

    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    if (!this.WIKI_RIGHTS) this.WIKI_RIGHTS = {}

    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    if (!this.itemViewOptions) this.itemViewOptions = {}
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.itemViewOptions.indexView = this
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.itemViewOptions.collection = this.collection
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.itemViewOptions.WIKI_RIGHTS = this.WIKI_RIGHTS
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.itemViewOptions.collectionHasTodoDate = this.collectionHasTodoDate
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.focusAfterRenderSelector = null

    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.contextAssetString = options != null ? options.contextAssetString : undefined
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    if (this.contextAssetString) {
      // @ts-expect-error TS2339,TS2769 -- TypeScriptify (no 'any')
      ;[this.contextName, this.contextId] = Array.from(splitAssetString(this.contextAssetString))
    }

    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.wikiIndexPlacements = options != null ? options.wikiIndexPlacements : []
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    if (!this.wikiIndexPlacements) this.wikiIndexPlacements = []

    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.itemViewOptions.contextName = this.contextName

    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    if (!this.selectedPages) this.selectedPages = {}
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.itemViewOptions.selectedPages = this.selectedPages

    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.collection.on('fetch', () => {
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      if (!this.fetched) {
        // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        this.fetched = true
        // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        return this.render()
      }
    })
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.collection.on('fetched:last', () => {
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      this.fetchedLast = true
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      if (this.focusAfterRenderSelector) {
        // We do a setTimeout here just to force it to the next tick.
        return setTimeout(() => {
          // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
          $(this.focusAfterRenderSelector).focus()
        }, 1)
      }
    })

    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.collection.on('sortChanged', this.sortChanged.bind(this))
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    return (this.currentSortField = this.collection.currentSortField)
  }

  afterRender() {
    super.afterRender(...arguments)
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.$noPages.redirectClickTo(this.$noPagesLink)
    this.renderSortHeaders()
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    if (this.focusAfterRenderSelector) {
      // We do a setTimeout here just to force it to the next tick.
      return setTimeout(() => {
        // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        $(this.focusAfterRenderSelector).focus()
      }, 1)
    }

    const node = document.querySelector('.paginatedLoadingIndicator')
    if (node instanceof HTMLElement) {
      ReactDOM.render(
        <View padding="x-small" textAlign="center" as="div" display="block">
          <Spinner delay={300} size="x-small" renderTitle={() => I18n.t('Loading')} />
        </View>,
        node,
      )
    }

    let parent = document.getElementById('wikiPageIndexEditModal')
    if (!parent) {
      parent = document.createElement('div')
      parent.setAttribute('id', 'wikiPageIndexEditModal')
      document.body.appendChild(parent)
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      this.itemViewOptions.editModalRoot = createRoot(parent)
    }
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  openRCE(e) {
    e.preventDefault()
    this.createNewPage(e, 'rce')
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  openBlockEditor(e) {
    e.preventDefault()
    this.createNewPage(e, 'block_editor')
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  openChooseEditorModalMaybe(e) {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    if (window.ENV.text_editor_preference != null) {
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      return this.createNewPage(e, window.ENV.text_editor_preference)
    }

    // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
    const createPageAction = editor => {
      this.createNewPage(e, editor)
    }
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    ENV.EDITOR_FEATURE !== null
      ? // @ts-expect-error TS2345 -- TypeScriptify (no 'any')
        renderChooseEditorModal(e, createPageAction)
      : this.createNewPage(e)
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  sortBySelect(event) {
    event.preventDefault()
    const {sortMobileField, sortMobileKey} = event.target.dataset
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    return this.$el.disableWhileLoading(this.collection.sortByField(sortMobileField, sortMobileKey))
  }

  sort(event = {}) {
    let sortField, sortOrder
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    event.preventDefault()
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.lastFocusField = sortField = $(event.currentTarget).data('sort-field')
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    if (!this.currentSortField) {
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      sortOrder = this.collection.sortOrders[sortField]
    }
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    return this.$el.disableWhileLoading(this.collection.sortByField(sortField, sortOrder))
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  sortChanged(currentSortField) {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.currentSortField = currentSortField
    return this.renderSortHeaders()
  }

  renderSortHeaders() {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    if (!this.$sortHeaders) return

    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    const {sortOrders} = this.collection
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    for (const sortHeader of Array.from(this.$sortHeaders)) {
      // @ts-expect-error TS2769 -- TypeScriptify (no 'any')
      const $sortHeader = $(sortHeader)
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      const $i = $sortHeader.find('i')

      // @ts-expect-error TS2345 -- TypeScriptify (no 'any')
      const sortField = $sortHeader.data('sort-field')
      const sortOrder = sortOrders[sortField] === 'asc' ? 'up' : 'down'

      if (sortOrder === 'up') {
        // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        $sortHeader.attr(
          'aria-label',
          // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
          I18n.t('headers.sort_ascending', '%{title}, Sort ascending', {title: $sortHeader.text()}),
        )
      } else {
        // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        $sortHeader.attr(
          'aria-label',
          I18n.t('headers.sort_descending', '%{title}, Sort descending', {
            // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
            title: $sortHeader.text(),
          }),
        )
      }

      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      $sortHeader.toggleClass('sort-field-active', sortField === this.currentSortField)
      $i.removeClass('icon-mini-arrow-up icon-mini-arrow-down')
      $i.addClass(`icon-mini-arrow-${sortOrder}`)
    }

    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    if (this.lastFocusField) {
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      $(`[data-sort-field='${this.lastFocusField}']`).focus()
    }
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  confirmDeletePages(ev) {
    if (ev != null) {
      ev.preventDefault()
    }
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    const pages = Object.values(this.itemViewOptions.selectedPages)
    if (pages.length > 0) {
      // @ts-expect-error TS18046 -- TypeScriptify (no 'any')
      const titles = pages.map(page => page.get('title'))
      // @ts-expect-error TS18046 -- TypeScriptify (no 'any')
      const urls = pages.map(page => page.get('url'))
      showConfirmDelete({
        pageTitles: titles,
        // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        onConfirm: () => deletePages(this.contextName, this.contextId, urls),
        // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
        onHide: (confirmed, error) => this.onDeleteModalHide(confirmed, error),
      })
    }
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  onDeleteModalHide(confirmed, error) {
    if (confirmed) {
      if (error) {
        $.flashError(I18n.t('Failed to delete selected pages'))
      } else {
        $.flashMessage(I18n.t('Selected pages have been deleted'))
        // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        this.itemViewOptions.selectedPages = {}
        // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        this.collection.fetch()
      }
    }
    $('.delete_pages').focus()
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  createNewPage(ev, editor = 'rce') {
    if (ev != null) {
      ev.preventDefault()
    }

    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.$el.hide()
    $('body').removeClass('index')
    $('body').addClass('edit')

    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.editModel = new WikiPage(
      // @ts-expect-error TS2554 -- TypeScriptify (no 'any')
      {
        // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        editing_roles: this.default_editing_roles,
        editor,
        block_editor_attributes:
          editor === 'block_editor'
            ? {
                version: '0.2',
                blocks: undefined,
              }
            : null,
      },
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      {contextAssetString: this.contextAssetString},
    )
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.editView = new WikiPageEditView({
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      model: this.editModel,
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      wiki_pages_path: ENV.WIKI_PAGES_PATH,
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      WIKI_RIGHTS: ENV.WIKI_RIGHTS,
      PAGE_RIGHTS: {
        // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        update: ENV.WIKI_RIGHTS.update_page,
        // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        update_content: ENV.WIKI_RIGHTS.update_page,
        // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        read_revisions: ENV.WIKI_RIGHTS.read_revisions,
      },
    })
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.$el.parent().append(this.editView.$el)

    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.editView.render()

    // override the cancel behavior
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    return this.editView.on('cancel', () => {
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      this.editView.destroyEditor()
      $('body').removeClass('edit with-right-side')
      $('body').addClass('index')
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      return this.$el.show()
    })
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  openExternalTool(ev) {
    if (ev != null) {
      ev.preventDefault()
    }
    // @ts-expect-error TS2339,TS7006 -- TypeScriptify (no 'any')
    const tool = this.wikiIndexPlacements.find(t => t.id === ev.target.dataset.toolId)
    this.setExternalToolTray(tool, $('.al-trigger')[0])
  }

  reloadPage() {
    window.location.reload()
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  setExternalToolTray(tool, returnFocusTo) {
    const handleDismiss = () => {
      // @ts-expect-error TS2554 -- TypeScriptify (no 'any')
      this.setExternalToolTray(null)
      returnFocusTo.focus()
      if (ltiState?.tray?.refreshOnClose) {
        this.reloadPage()
      }
    }

    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    const {ContentTypeExternalToolTray: ExternalToolTray} = this

    ReactDOM.render(
      <ExternalToolTray
        tool={tool}
        placement="wiki_index_menu"
        acceptedResourceTypes={['page']}
        targetResourceType="page"
        allowItemSelection={false}
        selectableItems={[]}
        onDismiss={handleDismiss}
        open={tool !== null}
      />,
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      this.$externalToolMountPoint[0],
    )
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  setCopyToItem(newCopyToItem, returnFocusTo) {
    const handleDismiss = () => {
      // @ts-expect-error TS2554 -- TypeScriptify (no 'any')
      this.setCopyToItem(null)
      returnFocusTo.focus()
    }

    const pageId = newCopyToItem?.id
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    const {DirectShareCourseTray: CourseTray} = this

    ReactDOM.render(
      <CourseTray
        open={newCopyToItem !== null}
        sourceCourseId={ENV.COURSE_ID}
        contentSelection={{pages: [pageId]}}
        shouldReturnFocus={false}
        onDismiss={handleDismiss}
      />,
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      this.$copyToMountPoint[0],
    )
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  setSendToItem(newSendToItem, returnFocusTo) {
    const handleDismiss = () => {
      // @ts-expect-error TS2554 -- TypeScriptify (no 'any')
      this.setSendToItem(null)
      // focus still gets mucked up even with shouldReturnFocus={false}, so set it later.
      setTimeout(() => returnFocusTo.focus(), 100)
    }

    const pageId = newSendToItem?.id
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    const {DirectShareUserModal: UserModal} = this

    ReactDOM.render(
      <UserModal
        open={newSendToItem !== null}
        courseId={ENV.COURSE_ID}
        contentShare={{content_type: 'page', content_id: pageId}}
        shouldReturnFocus={false}
        onDismiss={handleDismiss}
      />,
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      this.$sendToMountPoint[0],
    )
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  setAssignToItem(open, newAssignToItem, returnFocusTo) {
    // not supported in group contexts
    if (ENV.COURSE_ID == null) {
      return
    }
    const handleTrayClose = () => {
      this.setAssignToItem(false, newAssignToItem, returnFocusTo)
      setTimeout(() => returnFocusTo?.focus(), 100)
    }
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    const handleTrayExited = () => ReactDOM.unmountComponentAtNode(this.$assignToMountPoint[0])

    ReactDOM.render(
      <ItemAssignToManager
        open={open}
        onClose={handleTrayClose}
        onDismiss={handleTrayClose}
        onExited={handleTrayExited}
        iconType="page"
        itemType="page"
        locale={ENV.LOCALE || 'en'}
        timezone={ENV.TIMEZONE || 'UTC'}
        courseId={ENV.COURSE_ID}
        itemName={newAssignToItem.get('title')}
        itemContentId={newAssignToItem.get('page_id')}
        removeDueDateInput={true}
      />,
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      this.$assignToMountPoint[0],
    )
  }

  collectionHasTodoDate() {
    // @ts-expect-error TS2339,TS7006 -- TypeScriptify (no 'any')
    return !!this.collection.find(m => m.has('todo_date'))
  }

  toJSON() {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    const json = super.toJSON(...arguments)
    json.CAN = {
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      CREATE: !!this.WIKI_RIGHTS.create_page,
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      MANAGE: !!this.WIKI_RIGHTS.update || !!this.WIKI_RIGHTS.delete_page,
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      DELETE: !!this.WIKI_RIGHTS.delete_page,
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      PUBLISH: !!this.WIKI_RIGHTS.publish_page,
    }
    json.CAN.VIEW_TOOLBAR = json.CAN.CREATE || json.CAN.DELETE
    // NOTE: if permissions need to change for OPEN_MANAGE_OPTIONS, please update WikiPageIndexItemView.js to match
    json.CAN.OPEN_MANAGE_OPTIONS =
      json.CAN.MANAGE || json.CAN.CREATE || json.CAN.PUBLISH || ENV.DIRECT_SHARE_ENABLED

    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    json.fetched = !!this.fetched
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    json.fetchedLast = !!this.fetchedLast
    json.collectionHasTodoDate = this.collectionHasTodoDate()
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    json.hasWikiIndexPlacements = this.wikiIndexPlacements.length > 0
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    json.wikiIndexPlacements = this.wikiIndexPlacements

    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    json.block_editor_is_preferred = window.ENV.text_editor_preference === 'block_editor'
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    json.rce_is_preferred = window.ENV.text_editor_preference === 'rce'
    json.no_preferred_editor = !json.block_editor_is_preferred && !json.rce_is_preferred

    json.block_editor =
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      ENV.EDITOR_FEATURE === 'block_editor' || ENV.EDITOR_FEATURE === 'block_content_editor'
    return json
  }
}
WikiPageIndexView.initClass()
