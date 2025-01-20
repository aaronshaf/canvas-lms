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
import React from 'react'
import {fireEvent, render, screen} from '@testing-library/react'
import {AddressBook, USER_TYPE, CONTEXT_TYPE, BACK_BUTTON_TYPE} from '../AddressBook'
import {AlertManagerContext} from '@canvas/alerts/react/AlertManager'
import {ApolloProvider} from '@apollo/client'
import {handlers} from '../../../../graphql/mswHandlers'
import {mswClient} from '../../../../../../shared/msw/mswClient'
import {mswServer} from '../../../../../../shared/msw/mswServer'
import fakeENV from '@canvas/test-utils/fakeENV'

const server = mswServer(handlers)
beforeAll(() => {
  server.listen()
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})

beforeEach(() => {
  fakeENV.setup({
    current_user_id: 1,
  })
})

afterEach(() => {
  fakeENV.teardown()
})

const demoData = {
  contextData: [
    {id: 'course_11', name: 'Test 101', itemType: CONTEXT_TYPE},
    {id: 'course_12', name: 'History 101', itemType: CONTEXT_TYPE},
    {id: 'course_13', name: 'English 101', itemType: CONTEXT_TYPE, isLast: true},
  ],
  userData: [
    {id: '1', name: 'Rob Orton', full_name: 'Rob Orton', pronouns: 'he/him', itemType: USER_TYPE},
    {
      id: '2',
      name: 'Matthew Lemon',
      full_name: 'Matthew Lemon',
      pronouns: null,
      itemType: USER_TYPE,
    },
    {
      id: '3',
      name: 'Drake Harper',
      full_name: 'Drake Harpert',
      pronouns: null,
      itemType: USER_TYPE,
    },
    {
      id: '4',
      name: 'Davis Hyer',
      full_name: 'Davis Hyer',
      pronouns: null,
      isLast: true,
      itemType: USER_TYPE,
    },
  ],
}

const defaultProps = {
  menuData: demoData,
  onUserFilterSelect: jest.fn(),
  setIsMenuOpen: jest.fn(),
}

const setup = props => {
  return render(
    <ApolloProvider client={mswClient}>
      <AlertManagerContext.Provider value={{setOnFailure: jest.fn(), setOnSuccess: jest.fn()}}>
        <AddressBook {...props} />
      </AlertManagerContext.Provider>
    </ApolloProvider>,
  )
}

describe('Address Book Component', () => {
  describe('Rendering', () => {
    it('Should render', () => {
      const component = setup(defaultProps)
      expect(component).toBeTruthy()
    })

    it('Should render popup menu when prop is true', async () => {
      setup({...defaultProps, isMenuOpen: true})
      const popover = await screen.findByTestId('address-book-popover')
      expect(popover).toBeTruthy()
    })

    it('Should render a text input', async () => {
      const {findByTestId} = setup(defaultProps)
      const input = await findByTestId('-address-book-input')
      expect(input).toBeTruthy()
    })

    it('Should render back button when isSubMenu is present', async () => {
      setup({...defaultProps, isSubMenu: true, isMenuOpen: true})
      const backItem = await screen.findByText('Back')
      expect(backItem).toBeTruthy()
    })

    it('Should render header text when HeaderText is present', async () => {
      const headerText = 'Test Header Text'
      setup({...defaultProps, isMenuOpen: true, isSubMenu: true, headerText})
      const headerItem = await screen.findByText(headerText)
      expect(headerItem).toBeTruthy()
    })

    describe('Pronouns', () => {
      describe('can_add_pronouns disabled', () => {
        it('do not show up pronouns', async () => {
          const mockSetIsMenuOpen = jest.fn()
          const {queryByText} = setup({
            ...defaultProps,
            isMenuOpen: true,
            isSubMenu: true,
            setIsMenuOpen: mockSetIsMenuOpen,
          })
          await screen.findByTestId('address-book-popover')
          expect(queryByText('he/him')).not.toBeInTheDocument()
        })
      })
      describe('can_add_pronouns enabled', () => {
        beforeEach(() => {
          fakeENV.setup({
            SETTINGS: {
              can_add_pronouns: true,
            },
            current_user_id: 1,
          })
        })

        // fickle with --randomize
        it.skip('Show up pronouns if pronouns is not null', async () => {
          const mockSetIsMenuOpen = jest.fn()
          const {findByText, findByTestId} = setup({
            ...defaultProps,
            isMenuOpen: true,
            isSubMenu: true,
            setIsMenuOpen: mockSetIsMenuOpen,
          })
          await findByTestId('address-book-popover')
          // First wait for Rob Orton to appear
          const robOrton = await findByText('Rob Orton')
          // Then find the address book item containing Rob Orton
          const addressBookItem = robOrton.closest('[data-testid="address-book-item"]')
          // Finally verify the pronouns exist within this specific address book item
          expect(addressBookItem).toHaveTextContent('he/him')
        })

        it('Do not show up pronouns if pronouns is null', async () => {
          const mockSetIsMenuOpen = jest.fn()
          const props = {...defaultProps}
          props.menuData.userData[0].pronouns = null
          const {queryByText} = setup({
            ...props,
            isMenuOpen: true,
            isSubMenu: true,
            setIsMenuOpen: mockSetIsMenuOpen,
          })
          await screen.findByTestId('address-book-popover')
          expect(queryByText('he/him')).not.toBeInTheDocument()
        })
      })
    })
  })

  describe('Behaviors', () => {
    it('Should set popup menu to open when button is pressed', async () => {
      const mockSetIsMenuOpen = jest.fn()
      const {container} = setup({...defaultProps, setIsMenuOpen: mockSetIsMenuOpen})
      const button = container.querySelector('button')
      fireEvent.click(button)
      expect(mockSetIsMenuOpen).toHaveBeenCalled()
    })

    it('Should set popup menu to false when address button is pressed and popup is open', async () => {
      const mockSetIsMenuOpen = jest.fn()
      const {container} = setup({
        ...defaultProps,
        isMenuOpen: true,
        setIsMenuOpen: mockSetIsMenuOpen,
      })
      const button = container.querySelector('button')
      fireEvent.click(button)
      expect(mockSetIsMenuOpen).toHaveBeenCalledWith(false)
    })

    it('Should set popup menu to true when down arrow is pressed', async () => {
      const mockSetIsMenuOpen = jest.fn()
      const {container} = setup({
        ...defaultProps,
        isMenuOpen: true,
        setIsMenuOpen: mockSetIsMenuOpen,
      })
      const button = container.querySelector('button')
      fireEvent.click(button)
      const input = container.querySelector('input')
      fireEvent.keyDown(input, {key: 'ArrowDown', code: 'ArrowDown'})
      expect(mockSetIsMenuOpen).toHaveBeenCalledWith(false)
    })

    it('Should set popup menu to false when focus is changed', async () => {
      const mockSetIsMenuOpen = jest.fn()
      const {container} = setup({
        ...defaultProps,
        setIsMenuOpen: mockSetIsMenuOpen,
        isMenuOpen: true,
      })
      const input = container.querySelector('input')
      fireEvent.focus(input)
      const popover = await screen.findByTestId('address-book-popover')
      expect(popover).toBeTruthy()
      fireEvent.blur(input)
      expect(mockSetIsMenuOpen).toHaveBeenCalledWith(false)
    })

    it('Should not set popup menu to true when textInput is focused', async () => {
      const mockSetIsMenuOpen = jest.fn()
      const {container} = setup({...defaultProps, setIsMenuOpen: mockSetIsMenuOpen})
      const input = container.querySelector('input')
      fireEvent.focus(input)
      expect(mockSetIsMenuOpen).not.toHaveBeenCalled()
    })

    it('Should set popup menu to true when textInput is clicked', async () => {
      const mockSetIsMenuOpen = jest.fn()
      const {container} = setup({...defaultProps, setIsMenuOpen: mockSetIsMenuOpen})
      const input = container.querySelector('input')
      fireEvent.click(input)
      expect(mockSetIsMenuOpen).toHaveBeenCalledWith(true)
    })

    it('Should pass back ID of item when selected', async () => {
      const onSelectSpy = jest.fn()
      setup({...defaultProps, isMenuOpen: true, onSelect: onSelectSpy})
      const popover = await screen.findByTestId('address-book-popover')
      const items = popover.querySelectorAll('li')
      fireEvent.mouseDown(items[0])
      expect(onSelectSpy.mock.calls[0][0].id).toBe('subMenuCourse')
    })

    it('Should select item when navigating down and enter key is pressed', async () => {
      const onSelectSpy = jest.fn()
      const {container} = setup({...defaultProps, isMenuOpen: true, onSelect: onSelectSpy})
      const input = container.querySelector('input')
      fireEvent.focus(input)
      fireEvent.keyDown(input, {key: 'ArrowDown', keyCode: 40})
      fireEvent.keyDown(input, {key: 'Enter', keyCode: 13})
      expect(onSelectSpy.mock.calls).toHaveLength(1)
      expect(onSelectSpy.mock.calls[0][0].id).toBe('subMenuUsers')
    })

    it('Should select item when navigating up and enter key is pressed', () => {
      const onSelectSpy = jest.fn()
      const {container} = setup({...defaultProps, isMenuOpen: true, onSelect: onSelectSpy})
      const input = container.querySelector('input')
      fireEvent.focus(input)
      fireEvent.keyDown(input, {key: 'ArrowUp', keyCode: 38})
      fireEvent.keyDown(input, {key: 'ArrowUp', keyCode: 38})
      fireEvent.keyDown(input, {key: 'Enter', keyCode: 13})
      expect(onSelectSpy.mock.calls).toHaveLength(1)
      expect(onSelectSpy.mock.calls[0][0].id).toBe('subMenuCourse')
    })

    it('Should render loading bar below rendered menu items when loading more menu data', async () => {
      const {queryByTestId} = setup({
        ...defaultProps,
        isMenuOpen: true,
        isLoading: true,
        isLoadingMoreMenuData: true,
      })
      const items = await screen.findAllByTestId('address-book-item')
      expect(items.length > 0).toBe(true)
      expect(queryByTestId('menu-loading-spinner')).toBeInTheDocument()
    })

    it('Should not render old data when clicking into a new sub-menu', () => {
      const {queryByTestId, queryAllByTestId} = setup({
        ...defaultProps,
        isMenuOpen: true,
        isLoading: true,
        isLoadingMoreMenuData: false,
      })

      expect(queryAllByTestId('address-book-item')).toHaveLength(0)
      expect(queryByTestId('address-book-popover')).not.toBeInTheDocument()
      expect(queryByTestId('menu-loading-spinner')).toBeInTheDocument()
    })
  })
})
