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

import React from 'react'
import {render} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContextModulesHeader from '../ContextModulesHeader'

const defaultProps = {
  title: 'Modules',
  publishMenu: {
    courseId: '1',
    runningProgressId: null,
    disabled: false,
    visible: true,
  },
  viewProgress: {
    label: 'View Progress',
    url: '/courses/1/modules/progress',
    visible: true,
  },
  expandCollapseAll: {
    onExpandCollapseAll: vi.fn(),
    anyModuleExpanded: true,
  },
  addModule: {
    label: 'Add Module',
    visible: true,
  },
  moreMenu: {
    label: 'More',
    menuTools: {
      items: [
        {
          href: '#url',
          'data-tool-id': 1,
          'data-tool-launch-type': null,
          class: null,
          icon: null,
          title: 'External Tool',
        },
      ],
      visible: true,
    },
    exportCourseContent: {
      label: 'Export Course Content',
      url: '/courses/1/modules/export',
      visible: true,
    },
  },
  lastExport: {
    label: 'Last Export:',
    url: '/courses/1/modules/last_export',
    date: '2024-01-01 00:00:00',
    visible: true,
  },
} as const

describe('ContextModulesHeader', () => {
  let originalInnerWidth: number

  beforeEach(() => {
    originalInnerWidth = window.innerWidth
  })

  afterEach(() => {
    document.body.innerHTML = ''
    window.innerWidth = originalInnerWidth
  })

  describe('basic rendering', () => {
    it('renders the title', () => {
      // @ts-expect-error
      const {getByText} = render(<ContextModulesHeader {...defaultProps} />)
      expect(getByText(defaultProps.title, {selector: 'h1'})).toBeInTheDocument()
    })

    it('"Publish All" is visible', () => {
      // @ts-expect-error
      const {getByText} = render(<ContextModulesHeader {...defaultProps} />)
      expect(getByText('Publish All')).toBeInTheDocument()
    })

    it('"Publish All" is disabled', () => {
      window.innerWidth = 500
      window.dispatchEvent(new Event('resize'))

      const props = {
        ...defaultProps,
        publishMenu: {...defaultProps.publishMenu, disabled: true},
      }
      // @ts-expect-error
      const {container} = render(<ContextModulesHeader {...props} />)
      expect(
        container.querySelector('.context-modules-header-publish-menu-responsive button'),
      ).toBeDisabled()
    })

    it('"Publish All" is not visible', () => {
      const props = {
        ...defaultProps,
        publishMenu: {...defaultProps.publishMenu, visible: false},
      }
      // @ts-expect-error
      const {getByText} = render(<ContextModulesHeader {...props} />)
      expect(() => getByText('Publish All')).toThrow(/Unable to find an element/)
    })

    it('"View Progress" is visible', () => {
      // @ts-expect-error
      const {getByText} = render(<ContextModulesHeader {...defaultProps} />)
      expect(getByText(defaultProps.viewProgress.label)).toBeInTheDocument()
    })

    it('"View Progress" is not visible', () => {
      const props = {
        ...defaultProps,
        viewProgress: {...defaultProps.viewProgress, visible: false},
      }
      // @ts-expect-error
      const {getByText} = render(<ContextModulesHeader {...props} />)
      expect(() => getByText(defaultProps.viewProgress.label)).toThrow(/Unable to find an element/)
    })

    it('Expand All is hidden when no modules present', () => {
      const props = {
        ...defaultProps,
        overrides: {
          hasModules: false,
        },
      }
      // @ts-expect-error
      const {queryByText} = render(<ContextModulesHeader {...props} />)
      expect(queryByText('Expand All')).not.toBeInTheDocument()
    })

    it('"Expand All" is visible', () => {
      const {getByText} = render(
        // @ts-expect-error
        <ContextModulesHeader
          {...defaultProps}
          expandCollapseAll={{
            ...defaultProps.expandCollapseAll,
            anyModuleExpanded: false,
            disabled: false,
          }}
        />,
      )
      expect(getByText('Expand All')).toBeInTheDocument()
    })

    it('"Collapse All" is visible', () => {
      // @ts-expect-error
      const {getByText} = render(<ContextModulesHeader {...defaultProps} />)
      expect(getByText('Collapse All')).toBeInTheDocument()
    })

    it('"Add Module" is visible', () => {
      // @ts-expect-error
      const {getByText} = render(<ContextModulesHeader {...defaultProps} />)
      expect(getByText(defaultProps.addModule.label)).toBeInTheDocument()
    })

    it('"Add Module" is not visible', () => {
      const props = {
        ...defaultProps,
        addModule: {...defaultProps.addModule, visible: false},
      }
      // @ts-expect-error
      const {getByText} = render(<ContextModulesHeader {...props} />)
      expect(() => getByText(defaultProps.addModule.label)).toThrow(/Unable to find an element/)
    })

    it('"Last Export" is visible', () => {
      // @ts-expect-error
      const {getByText} = render(<ContextModulesHeader {...defaultProps} />)
      expect(
        getByText(`${defaultProps.lastExport.label} ${defaultProps.lastExport.date}`),
      ).toBeInTheDocument()
    })

    it('"Last Export" is not visible', () => {
      const props = {
        ...defaultProps,
        lastExport: {...defaultProps.lastExport, visible: false},
      }
      // @ts-expect-error
      const {getByText} = render(<ContextModulesHeader {...props} />)
      expect(() =>
        getByText(`${defaultProps.lastExport.label} ${defaultProps.lastExport.date}`),
      ).toThrow(/Unable to find an element/)
    })

    it('"More Menu" is visible', () => {
      const props = {
        ...defaultProps,
        moreMenu: {
          ...defaultProps.moreMenu,
          exportCourseContent: {
            ...defaultProps.moreMenu.exportCourseContent,
            visible: false,
          },
          menuTools: {
            ...defaultProps.moreMenu.menuTools,
            visible: true,
          },
        },
      }
      // @ts-expect-error
      const {getByText} = render(<ContextModulesHeader {...props} />)
      expect(getByText('More')).toBeInTheDocument()
    })

    it('"Export Course Content" is visible inside "More Menu"', async () => {
      const props = {
        ...defaultProps,
        moreMenu: {
          ...defaultProps.moreMenu,
          exportCourseContent: {
            ...defaultProps.moreMenu.exportCourseContent,
            visible: true,
          },
          menuTools: {
            ...defaultProps.moreMenu.menuTools,
            visible: true,
          },
        },
      }
      // @ts-expect-error
      const {getByText} = render(<ContextModulesHeader {...props} />)
      // getByText returns the inner <span>; InstUI sets pointer-events:none on it,
      // so climb to the actual <button> to perform the click.
      await userEvent.click(getByText('More').closest('button')!)
      expect(getByText(defaultProps.moreMenu.exportCourseContent.label)).toBeInTheDocument()
    })

    it('"Export Course Content" is not visible inside "More Menu"', async () => {
      const props = {
        ...defaultProps,
        moreMenu: {
          ...defaultProps.moreMenu,
          exportCourseContent: {
            ...defaultProps.moreMenu.exportCourseContent,
            visible: false,
          },
          menuTools: {
            ...defaultProps.moreMenu.menuTools,
            visible: true,
          },
        },
      }
      // @ts-expect-error
      const {getByText, queryByText} = render(<ContextModulesHeader {...props} />)
      await userEvent.click(getByText('More').closest('button')!)
      expect(queryByText(defaultProps.moreMenu.exportCourseContent.label)).not.toBeInTheDocument()
    })

    it('"Tools menu" is visible inside "More Menu"', async () => {
      const props = {
        ...defaultProps,
        moreMenu: {
          ...defaultProps.moreMenu,
          exportCourseContent: {
            ...defaultProps.moreMenu.exportCourseContent,
            visible: false,
          },
          menuTools: {
            ...defaultProps.moreMenu.menuTools,
            visible: true,
          },
        },
      }
      // @ts-expect-error
      const {getByText} = render(<ContextModulesHeader {...props} />)
      await userEvent.click(getByText('More').closest('button')!)
      expect(getByText(defaultProps.moreMenu.menuTools.items[0].title)).toBeInTheDocument()
    })

    it('sanitizes external-tool icon HTML rendered via dangerouslySetInnerHTML', async () => {
      // tool.icon is LTI-vendor-supplied HTML (typically an <img> tag).
      // A compromised vendor could ship an <img onerror=...> payload;
      // sanitizeHTML strips the event handler at the render boundary.
      const props = {
        ...defaultProps,
        moreMenu: {
          ...defaultProps.moreMenu,
          exportCourseContent: {
            ...defaultProps.moreMenu.exportCourseContent,
            visible: false,
          },
          menuTools: {
            visible: true,
            items: [
              {
                href: '#evil',
                'data-tool-id': 99,
                'data-tool-launch-type': null,
                title: 'Hostile Tool',
                icon: '<img src="x" onerror="window.__pwned=1">',
              },
            ],
          },
        },
      }
      // @ts-expect-error
      const {getByRole, container} = render(<ContextModulesHeader {...props} />)
      await userEvent.click(getByRole('button', {name: 'More'}))
      // Find the rendered tool icon img. Wherever it lives in the menu,
      // it must NOT carry an onerror after sanitization.
      const img = container.ownerDocument.querySelector('img[src="x"]')
      expect(img).not.toBeNull()
      expect(img!.getAttribute('onerror')).toBeNull()
    })

    it('"Export Course Content" is visible outside "More Menu"', () => {
      const props = {
        ...defaultProps,
        moreMenu: {
          ...defaultProps.moreMenu,
          exportCourseContent: {
            ...defaultProps.moreMenu.exportCourseContent,
            visible: true,
          },
          menuTools: {
            ...defaultProps.moreMenu.menuTools,
            visible: false,
          },
        },
      }
      // @ts-expect-error
      const {getByText} = render(<ContextModulesHeader {...props} />)
      expect(getByText(defaultProps.moreMenu.exportCourseContent.label)).toBeInTheDocument()
    })

    it('"More Menu" is not visible', () => {
      const props = {
        ...defaultProps,
        moreMenu: {
          ...defaultProps.moreMenu,
          exportCourseContent: {
            ...defaultProps.moreMenu.exportCourseContent,
            visible: false,
          },
          menuTools: {
            ...defaultProps.moreMenu.menuTools,
            visible: false,
          },
        },
      }
      // @ts-expect-error
      const {queryByText} = render(<ContextModulesHeader {...props} />)
      expect(queryByText('More')).not.toBeInTheDocument()
    })

    it('sanitizes hostile HTML in LTI tool icon', async () => {
      const props = {
        ...defaultProps,
        moreMenu: {
          ...defaultProps.moreMenu,
          exportCourseContent: {
            ...defaultProps.moreMenu.exportCourseContent,
            visible: false,
          },
          menuTools: {
            ...defaultProps.moreMenu.menuTools,
            items: [
              {
                ...defaultProps.moreMenu.menuTools.items[0],
                icon: '<img src=x onerror="window.__xss_fired = true"><script>window.__xss_fired = true</script>',
              },
            ],
            visible: true,
          },
        },
      }
      delete (window as any).__xss_fired
      // @ts-expect-error
      const {getByText, baseElement} = render(<ContextModulesHeader {...props} />)
      await userEvent.click(getByText('More').closest('button')!)
      expect(baseElement.querySelector('script')).toBeNull()
      baseElement.querySelectorAll('img').forEach(img => {
        expect(img.getAttribute('onerror')).toBeNull()
      })
      expect((window as any).__xss_fired).toBeUndefined()
    })

    it('sanitizes hostile HTML in LTI tool icon', async () => {
      const props = {
        ...defaultProps,
        moreMenu: {
          ...defaultProps.moreMenu,
          exportCourseContent: {
            ...defaultProps.moreMenu.exportCourseContent,
            visible: false,
          },
          menuTools: {
            ...defaultProps.moreMenu.menuTools,
            items: [
              {
                ...defaultProps.moreMenu.menuTools.items[0],
                icon: '<img src=x onerror="window.__xss_fired = true"><script>window.__xss_fired = true</script>',
              },
            ],
            visible: true,
          },
        },
      }
      delete (window as any).__xss_fired
      // @ts-expect-error
      const {getByRole, baseElement} = render(<ContextModulesHeader {...props} />)
      const button = getByRole('button', {name: 'More'})
      await userEvent.click(button)
      expect(baseElement.querySelector('script')).toBeNull()
      baseElement.querySelectorAll('img').forEach(img => {
        expect(img.getAttribute('onerror')).toBeNull()
      })
      expect((window as any).__xss_fired).toBeUndefined()
    })
  })
})
