// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
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
import {Editor} from '@craftjs/core'
import {render, screen, waitFor} from '@testing-library/react'
import {ToolbarColor} from '../ToolbarColor'

const DEFAULT_FONT_COLOR = '#273540'

const baseTabs = {
  foreground: {
    color: DEFAULT_FONT_COLOR,
    default: DEFAULT_FONT_COLOR,
  },
  background: {
    color: '#aaaaaa',
    default: '#00000000',
  },
  border: {
    color: DEFAULT_FONT_COLOR,
    default: DEFAULT_FONT_COLOR,
  },
  effectiveBgColor: '#ffffff',
}
const cloneBaseTabs = () => JSON.parse(JSON.stringify(baseTabs))

const renderComponent = (props = {}) => {
  return render(
    <Editor enabled={false}>
      <ToolbarColor tabs={baseTabs} onChange={() => {}} {...props} />
    </Editor>,
  )
}

describe('ToolbarColor', () => {
  it('renders the button', () => {
    const {getByText} = renderComponent()

    const button = getByText('Color').closest('button')

    expect(button).toBeInTheDocument()
  })

  it('renders the popup', async () => {
    const {getAllByRole, getByText, getByTestId} = renderComponent()
    const button = getByText('Color').closest('button') as HTMLButtonElement
    button.click()

    await waitFor(() => {
      const tabs = getAllByRole('tab')
      expect(tabs[0]).toHaveTextContent('Color')
      expect(tabs[1]).toHaveTextContent('Background')
      expect(tabs[2]).toHaveTextContent('Border')

      expect(getByText('Previously chosen colors')).toBeInTheDocument()
      expect(getByTestId('color-mixer')).toBeInTheDocument()
      expect(getByTestId('color-preset')).toBeInTheDocument()
      expect(getByTestId('color-contrast-summary')).toBeInTheDocument()
    })
  })

  it('includes the background tab', async () => {
    const tabs = cloneBaseTabs()
    delete tabs.foreground
    delete tabs.border

    const {getByText} = renderComponent({tabs})
    const button = getByText('Color').closest('button') as HTMLButtonElement
    button.click()

    await waitFor(() => {
      const tabelems = screen.getAllByRole('tab')
      expect(tabelems).toHaveLength(1)
      expect(tabelems[0]).toHaveTextContent('Background')
    })
  })

  it('includes the Border tab and omits the Color tab', async () => {
    const tabs = cloneBaseTabs()
    delete tabs.foreground
    const {getByText} = renderComponent({tabs})
    const button = getByText('Color').closest('button') as HTMLButtonElement
    button.click()

    await waitFor(() => {
      const tabelems = screen.getAllByRole('tab')
      expect(tabelems).toHaveLength(2)
      expect(tabelems[0]).toHaveTextContent('Background')
      expect(tabelems[1]).toHaveTextContent('Border')
    })
  })

  it('includes the Color tab and omits the Border tab', async () => {
    const {getAllByRole, getByText} = renderComponent({
      tabs: {
        background: {
          color: '#fff',
          default: '#fff',
        },
        foreground: {
          color: '#ff0000',
          default: '#000000',
        },
        effectiveBgColor: '#ffffff',
      },
    })
    const button = getByText('Color').closest('button') as HTMLButtonElement
    button.click()

    await waitFor(() => {
      const tabs = getAllByRole('tab')
      expect(tabs).toHaveLength(2)
      expect(tabs[0]).toHaveTextContent('Color')
      expect(tabs[1]).toHaveTextContent('Background')
    })
  })

  it('includes the default foreground color', async () => {
    const tabs = cloneBaseTabs()
    delete tabs.border
    window.getComputedStyle = vi.fn().mockReturnValue({
      getPropertyValue: vi.fn().mockReturnValue(DEFAULT_FONT_COLOR),
    })
    const {getByText} = renderComponent({tabs})
    const button = getByText('Color').closest('button') as HTMLButtonElement
    button.click()

    await waitFor(() => {
      expect(screen.getByDisplayValue('custom')).toBeInTheDocument()
    })

    // change to custom colors to enable ColorPresets
    screen.getByDisplayValue('custom').click()

    await waitFor(() => {
      const c1 = document
        .getElementById('foreground')
        ?.querySelectorAll('button')[0]
        ?.getAttribute('aria-label')
      expect(c1).toMatch(DEFAULT_FONT_COLOR)
    })
  })

  describe('color tab', () => {
    it('renders the color tab panel', async () => {
      const {getAllByRole, getByText, getByDisplayValue} = renderComponent({
        tabs: {
          background: {
            color: '#fff',
            default: '#fff',
          },
          foreground: {
            color: '#aabbcc',
            default: DEFAULT_FONT_COLOR,
          },
          effectiveBgColor: '#ffffff',
        },
      })

      const button = getByText('Color').closest('button') as HTMLButtonElement
      button.click()

      await waitFor(() => {
        const tabs = getAllByRole('tab')

        expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
        expect(getByText('Input field for red')).toBeInTheDocument()
        expect(getByDisplayValue(170)).toBeInTheDocument() // aa
        expect(getByDisplayValue(187)).toBeInTheDocument() // bb
        expect(getByDisplayValue(204)).toBeInTheDocument() // cc

        expect(getByText('Color Contrast')).toBeInTheDocument()
        expect(getByText('FAIL')).toBeInTheDocument()
      })
    })

    it('shows tha contrast ratio', async () => {
      const tabs = cloneBaseTabs()
      delete tabs.background
      delete tabs.border
      const {getByText, getByTestId} = renderComponent({tabs})

      const button = getByText('Color').closest('button') as HTMLButtonElement
      button.click()

      await waitFor(() => {
        expect(getByTestId('color-contrast-summary')).toBeInTheDocument()
      })
    })
  })

  describe('background tab', () => {
    beforeEach(() => {
      window.getComputedStyle = vi.fn().mockReturnValue({
        getPropertyValue: vi.fn().mockReturnValue(DEFAULT_FONT_COLOR),
      })
    })

    it('switches to the background tab', async () => {
      const tabs = cloneBaseTabs()
      delete tabs.border
      const {getAllByRole, getByText} = renderComponent({tabs})
      const button = getByText('Color').closest('button') as HTMLButtonElement
      button.click()

      await waitFor(() => {
        expect(getAllByRole('tab')).toHaveLength(2)
      })

      const tabelems = getAllByRole('tab')
      tabelems[1].click()

      await waitFor(() => expect(tabelems[1]).toHaveAttribute('aria-selected', 'true'))
      expect(document.getElementById('background')).toBeInTheDocument()
    })

    it('renders the background tab panel', async () => {
      const tabs = cloneBaseTabs()
      delete tabs.border
      tabs.background.default = tabs.background.color
      const {getByText, getByDisplayValue, getByTestId} = renderComponent({tabs})
      const button = getByText('Color').closest('button') as HTMLButtonElement
      button.click()

      await waitFor(() => {
        expect(screen.getAllByRole('tab')).toHaveLength(2)
      })

      const tabelems = screen.getAllByRole('tab')
      tabelems[1].click()

      await waitFor(() => {
        expect(getByDisplayValue('none')).toBeInTheDocument()
        expect(getByDisplayValue('custom')).toBeInTheDocument()
        expect(getByDisplayValue('none')).toBeChecked()

        const mixer = getByTestId('color-mixer')
        // mixer, color slider, r, g, and b inputs
        expect(mixer.querySelectorAll('[disabled]')).toHaveLength(5)
      })
    })

    it('enables the mixer when custom color is selected', async () => {
      const tabs = cloneBaseTabs()
      delete tabs.border
      const {getByText, getByTestId} = renderComponent({tabs})
      const button = getByText('Color').closest('button') as HTMLButtonElement
      button.click()

      await waitFor(() => {
        expect(screen.getAllByRole('tab')).toHaveLength(2)
      })

      const tabelems = screen.getAllByRole('tab')
      tabelems[1].click()

      await waitFor(() => {
        const mixer = getByTestId('color-mixer')
        expect(mixer.querySelectorAll('[disabled]')).toHaveLength(0)
      })
    })
  })

  describe('border tab', () => {
    it('switches to the border tab', async () => {
      const tabs = cloneBaseTabs()
      delete tabs.foreground
      const {getAllByRole, getByText} = renderComponent({tabs})
      const button = getByText('Color').closest('button') as HTMLButtonElement
      button.click()

      await waitFor(() => {
        expect(getAllByRole('tab')).toHaveLength(2)
      })

      const tabelems = getAllByRole('tab')
      tabelems[1].click()

      await waitFor(() => expect(tabelems[1]).toHaveAttribute('aria-selected', 'true'))
      expect(document.getElementById('border')).toBeInTheDocument()
    })

    it('renders the border tab panel', async () => {
      const tabs = cloneBaseTabs()
      delete tabs.foreground
      const {getByText, getByDisplayValue, queryByTestId} = renderComponent({tabs})
      const button = getByText('Color').closest('button') as HTMLButtonElement
      button.click()

      await waitFor(() => {
        expect(screen.getAllByRole('tab')).toHaveLength(2)
      })

      const tabelems = screen.getAllByRole('tab')
      tabelems[1].click()

      await waitFor(() => {
        expect(getByDisplayValue('none')).toBeInTheDocument()
        expect(getByDisplayValue('custom')).toBeInTheDocument()
        expect(getByDisplayValue('none')).toBeChecked()

        expect(queryByTestId('color-mixer')).toBeInTheDocument()
        expect(queryByTestId('color-preset')).toBeInTheDocument()
        expect(queryByTestId('color-contrast')).not.toBeInTheDocument()
      })
    })

    it('shows tha contrast ratio', async () => {
      const tabs = cloneBaseTabs()
      delete tabs.background
      delete tabs.foreground
      const {getByText, getByTestId} = renderComponent({tabs})

      const button = getByText('Color').closest('button') as HTMLButtonElement
      button.click()

      await waitFor(() => {
        expect(getByTestId('color-contrast-summary')).toBeInTheDocument()
      })
    })
  })

  describe('color contrast', () => {
    it('renders the color contrast', async () => {
      const tabs = cloneBaseTabs()
      const {getByText, getByTestId, queryByTestId} = renderComponent({tabs})
      const button = getByText('Color').closest('button') as HTMLButtonElement
      button.click()

      await waitFor(() => {
        expect(getByTestId('color-contrast-summary')).toBeInTheDocument()
      })

      const toggle = getByTestId('color-contrast-summary')
      expect(queryByTestId('color-contrast')).not.toBeInTheDocument()

      toggle.click()

      await waitFor(() => {
        expect(queryByTestId('color-contrast')).toBeInTheDocument()
      })
    })
  })
})
