/*
 * Copyright (C) 2026 - present Instructure, Inc.
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

import {fireEvent, render} from '@testing-library/react'
import {RubricsInfiniteFooter} from '../RubricsInfiniteFooter'

describe('RubricsInfiniteFooter', () => {
  const defaultProps = {
    loadedCount: 50,
    totalCount: 200,
    hasNextPage: true,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  }

  const renderComponent = (overrides: Partial<typeof defaultProps> = {}) =>
    render(<RubricsInfiniteFooter {...defaultProps} {...overrides} />)

  describe('displayed-count label', () => {
    it('renders "loaded of total displayed" when totalCount > 0', () => {
      const {getByText} = renderComponent({loadedCount: 50, totalCount: 200})
      expect(getByText('50 of 200 displayed')).toBeInTheDocument()
    })

    it('shows the final state once all pages are loaded', () => {
      const {getByText} = renderComponent({
        loadedCount: 73,
        totalCount: 73,
        hasNextPage: false,
      })
      expect(getByText('73 of 73 displayed')).toBeInTheDocument()
    })

    it('omits the label when totalCount is 0', () => {
      const {queryByText} = renderComponent({loadedCount: 0, totalCount: 0, hasNextPage: false})
      expect(queryByText(/displayed/)).not.toBeInTheDocument()
    })
  })

  describe('Load More button', () => {
    it('renders the Load More button when hasNextPage is true', () => {
      const {getByTestId} = renderComponent({hasNextPage: true, isFetchingNextPage: false})
      expect(getByTestId('rubrics-load-more-button')).toBeInTheDocument()
    })

    it('does not render the Load More button when hasNextPage is false', () => {
      const {queryByTestId} = renderComponent({hasNextPage: false})
      expect(queryByTestId('rubrics-load-more-button')).not.toBeInTheDocument()
    })

    it('calls fetchNextPage when the button is clicked', () => {
      const fetchNextPage = vi.fn()
      const {getByTestId} = renderComponent({fetchNextPage})
      fireEvent.click(getByTestId('rubrics-load-more-button'))
      expect(fetchNextPage).toHaveBeenCalledTimes(1)
    })
  })

  describe('next-page loading indicator', () => {
    it('replaces the button with a loading indicator while a fetch is in flight', () => {
      const {container, queryByTestId} = renderComponent({isFetchingNextPage: true})
      expect(queryByTestId('rubrics-load-more-button')).not.toBeInTheDocument()
      expect(container.querySelector('[class*="LoadingIndicator"], [role="img"]')).not.toBeNull()
    })

    it('does not render the loading indicator when idle', () => {
      const {container} = renderComponent({isFetchingNextPage: false})
      expect(container.querySelector('[class*="LoadingIndicator"]')).toBeNull()
    })

    it('hides both the button and the indicator once all pages are loaded', () => {
      const {container, queryByTestId} = renderComponent({
        hasNextPage: false,
        isFetchingNextPage: false,
      })
      expect(queryByTestId('rubrics-load-more-button')).not.toBeInTheDocument()
      expect(container.querySelector('[class*="LoadingIndicator"]')).toBeNull()
    })
  })
})
