/*
 * Copyright (C) 2021 - present Instructure, Inc.
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

import elementDenylist from './elementDenylist'
import rceAllowlist from './rce_allowlist.json'

type RceAllowlistEntry = string | Record<string, string>

function elemsToTinyStringConfig(list: Record<string, RceAllowlistEntry[]>): string {
  return Object.entries(list)
    .map(pair => {
      const [tag, attrs] = pair
      if (attrs.length === 0) {
        return tag
      } else {
        const attrStr = attrs
          .map(attr => {
            if (typeof attr === 'string') {
              return attr
            } else if (typeof attr === 'object') {
              return Object.entries(attr).map(([key, value]) => `${key}=${value}`)
            }
          })
          .join('|')

        return `${tag}[${attrStr}]`
      }
    })
    .join()
}

const defaultTinymceConfig = {
  // ============================================================================
  // Values in this section have acceptable defaults which you may want
  // to override (though you really should provide content_css)
  // ============================================================================

  auto_focus: false,

  // any values provided (in an array) will be merged into the standard then sorted
  // you provide the translations
  block_formats: undefined,

  // replace to provide your own
  body_class: 'default-theme',

  // urls to branding css go here
  content_css: [],

  // these are up to you
  directionality: 'ltr',
  height: undefined, // '400px' is s the standard height
  language: 'en',

  // any menubar entries here will be appended to the standard menubar
  menubar: undefined,
  // any menus here will be merged into the standard menubar menus
  menu: undefined,

  // any toolbar data here will be merged into the standard toolbars
  toolbar: undefined,

  color_map: [
    // First row
    // tiny mce's default first row colors
    '#BFEDD2',
    'Light Green',
    '#FBEEB8',
    'Light Orange',
    '#F8CAC6',
    'Light Red',
    '#ECCAFA',
    'Light Purple',
    '#C2E0F4',
    'Light Blue',

    // Second row
    '#03893D', // InstUI Green45
    'Green',
    '#CF4A00', // InstUI Orange45
    'Orange',
    '#E62429', // InstUI Red45
    'Red',
    '#9E58BD', // InstUI Violet45
    'Purple',
    '#2B7ABC', // InstUI Blue45
    'Blue',

    // Third row
    '#027634', // InstUI Green57
    'Dark Green',
    '#B34000', // InstUI Orange57
    'Dark Orange',
    '#C71F23', // InstUI Red57
    'Dark Red',
    '#9242B4', // InstUI Violet57
    'Dark Purple',
    '#0E68B3', // InstUI Blue57
    'Dark Blue',

    // Fourth row
    '#FFFFFF',
    'White',
    '#6A7883', // InstUI Grey45
    'Light Gray',
    '#3F515E', // InstUI Grey82
    'Gray',
    '#273540', // InstUI Grey125
    'Dark Gray',
    '#000000',
    'Black',
  ],

  // plugins included here will be added to the standard set
  plugins: undefined,

  // ==================================================================================
  // values below this line define standard behavior and probably shouldn't be changed
  // but will be used if you do
  // ==================================================================================
  branding: false,
  browser_spellcheck: true,

  content_style: '',

  convert_urls: false,

  // fonts specified here need to either be web-safe or self-hosted and loaded in app/stylesheets/bundles/fonts.scss
  font_formats:
    "Lato Extended=Lato Extended,Helvetica Neue,Helvetica,Arial,sans-serif; Balsamiq Sans=Balsamiq Sans,Lato Extended,Helvetica Neue,Helvetica,Arial,sans-serif; Architect's Daughter=Architects Daughter,Lato Extended,Helvetica Neue,Helvetica,Arial,sans-serif; Arial=arial,helvetica,sans-serif; Arial Black=arial black,avant garde; Courier New=courier new,courier; Georgia=georgia,palatino; Tahoma=tahoma,arial,helvetica,sans-serif; Times New Roman=times new roman,times; Trebuchet MS=trebuchet ms,geneva; Verdana=verdana,geneva; Open Dyslexic=OpenDyslexic; Open Dyslexic Mono=OpenDyslexicMono, Monaco, Menlo, Consolas, Courier New, monospace;",

  language_load: false,
  language_url: 'none',

  toolbar_mode: 'floating',

  mobile: {theme: 'silver'},
  preview_styles:
    'font-family font-size font-weight font-style text-decoration text-transform border border-radius outline text-shadow',
  remove_script_host: true,
  resize: true,
  // will get set from textareaId
  // selector: '#textarea2',
  skin: false,
  statusbar: false,

  // part of unifying tinymce and canvas_sanitize's element whitelist
  // copied from
  // https://www.tiny.cloud/docs-3x/reference/configuration/Configuration3x@valid_elements/#defaultruleset
  // then edited.
  //
  // this list needs to be kept in sync with the list in gems/canvas_sanitize/lib/canvas_sanitize/canvas_sanitize.rb
  valid_elements: elemsToTinyStringConfig(
    rceAllowlist.valid_elements as Record<string, RceAllowlistEntry[]>,
  ),

  extended_valid_elements: elemsToTinyStringConfig(
    rceAllowlist.extended_valid_elements as Record<string, RceAllowlistEntry[]>,
  ),

  invalid_elements: elementDenylist.join(','),

  non_empty_elements:
    'td th iframe video audio object script a i area base basefont br col frame hr img input isindex link meta param embed source wbr track ruby',

  // tiny's external link create/edit dialog config
  target_list: false, // don't show the target list when creating/editing links
  link_title: false, // don't show the title input when creating/editing links
  default_link_target: '_blank',

  // Remove the ability to add h1 tags (since there will already be an h1 on the page)
  // but preserve the default Formats menu config otherwise
  style_formats: [
    {
      title: 'Headings',
      items: [
        {title: 'Heading 2', format: 'h2'},
        {title: 'Heading 3', format: 'h3'},
        {title: 'Heading 4', format: 'h4'},
        {title: 'Heading 5', format: 'h5'},
        {title: 'Heading 6', format: 'h6'},
      ],
    },
    {
      title: 'Inline',
      items: [
        {title: 'Bold', format: 'bold'},
        {title: 'Italic', format: 'italic'},
        {title: 'Underline', format: 'underline'},
        {title: 'Strikethrough', format: 'strikethrough'},
        {title: 'Superscript', format: 'superscript'},
        {title: 'Subscript', format: 'subscript'},
        {title: 'Code', format: 'code'},
      ],
    },
    {
      title: 'Blocks',
      items: [
        {title: 'Paragraph', format: 'p'},
        {title: 'Blockquote', format: 'blockquote'},
        {title: 'Div', format: 'div'},
        {title: 'Pre', format: 'pre'},
      ],
    },
    {
      title: 'Align',
      items: [
        {title: 'Left', format: 'alignleft'},
        {title: 'Center', format: 'aligncenter'},
        {title: 'Right', format: 'alignright'},
        {title: 'Justify', format: 'alignjustify'},
      ],
    },
  ],
}
export default defaultTinymceConfig
