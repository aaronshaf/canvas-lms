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

import {fireEvent, screen, within} from '@testing-library/react'
import {renderComponent} from './testUtils'
import {file} from './fixtures'
import {type File} from '../../../../interfaces/File'

// Two files whose name order is well-defined so we can assert the order in
// which the component renders the rows it is given. The parent owns the actual
// sorting/pagination; this component renders `rows` verbatim in array order.
// The shared fixture's context_asset_string ('context-1') has no underscore,
// so NameLink -> generatePreviewUrlPath would throw and crash the row render.
// Give it a valid `model_id` form so the rows actually render.
const baseFile = {...(file as File), context_asset_string: 'course_1'}
const pdfFile: File = {...baseFile, id: '1', display_name: 'example.pdf'}
const txtFile: File = {
  ...baseFile,
  id: '2',
  display_name: 'b_file.txt',
  filename: 'b_file.txt',
  'content-type': 'text/plain',
  mime_class: 'text',
}

// NameLink renders the file-type icon next to the name, and that icon carries
// an SVG <title> (e.g. "PDF File") whose text bleeds into the cell's
// textContent. The link itself carries the item's name as its data-testid, so
// read that to assert the rendered row order by name without the icon-title
// noise.
const renderedNameOrder = () =>
  screen
    .getAllByTestId('table-row')
    .map(row => within(row).getByTestId('table-cell-name').querySelector('a')?.getAttribute('data-testid'))

describe('FileFolderTable', () => {
  let flashElements: any
  const onSortChange = vi.fn()
  beforeEach(() => {
    flashElements = document.createElement('div')
    flashElements.setAttribute('id', 'flash_screenreader_holder')
    flashElements.setAttribute('role', 'alert')
    document.body.appendChild(flashElements)
  })

  afterEach(() => {
    onSortChange.mockClear()
    document.body.removeChild(flashElements)
    flashElements = undefined
  })

  describe('sort functionality', () => {
    const title = 'name'

    describe('when sort is set to ascending', () => {
      it('displays as ascending', async () => {
        const {findByTestId} = renderComponent({sort: {by: title, direction: 'asc'}})
        const header = await findByTestId(title)
        expect(header).toHaveAttribute('aria-sort', 'ascending')
      })

      it('clicking on same header calls onSortChange with descending', async () => {
        const {findByTestId} = renderComponent({sort: {by: title, direction: 'asc'}, onSortChange})
        const header = await findByTestId(title)
        fireEvent.click(header.querySelector('button') as HTMLButtonElement)
        expect(onSortChange).toHaveBeenCalledWith({by: title, direction: 'desc'})
      })

      it('has correct screen reader label', async () => {
        const {findByText} = renderComponent({sort: {by: title, direction: 'asc'}})
        const header = await findByText('Sorted by name')
        expect(header).toBeInTheDocument()
      })
    })

    describe('when sort is set to descending', () => {
      it('displays as descending', async () => {
        const {findByTestId} = renderComponent({sort: {by: title, direction: 'desc'}})
        const header = await findByTestId(title)
        expect(header).toHaveAttribute('aria-sort', 'descending')
      })

      it('clicking on same header calls onSortChange with ascending', async () => {
        const {findByTestId} = renderComponent({sort: {by: title, direction: 'desc'}, onSortChange})
        const header = await findByTestId(title)
        fireEvent.click(header.querySelector('button') as HTMLButtonElement)
        expect(onSortChange).toHaveBeenCalledWith({by: title, direction: 'asc'})
      })

      it('has correct screen reader label', async () => {
        const {findByText} = renderComponent({sort: {by: title, direction: 'desc'}})
        const header = await findByText('Sorted by name')
        expect(header).toBeInTheDocument()
      })
    })

    describe('unsorted header', () => {
      const unsortedTitle = 'created_at'
      let findByTestId: ReturnType<typeof renderComponent>['findByTestId']
      beforeEach(() => {
        findByTestId = renderComponent({
          sort: {by: title, direction: 'desc'},
          onSortChange,
        }).findByTestId
      })

      it('displays as none', async () => {
        const header = await findByTestId(unsortedTitle)
        expect(header).toHaveAttribute('aria-sort', 'none')
      })

      it('clicking on header calls onSortChange with ascending', async () => {
        const header = await findByTestId(unsortedTitle)
        fireEvent.click(header.querySelector('button') as HTMLButtonElement)
        expect(onSortChange).toHaveBeenCalledWith({by: unsortedTitle, direction: 'asc'})
      })
    })

    it('updates sorting screenreader alert', async () => {
      renderComponent({sort: {by: title, direction: 'asc'}})
      // this includes sr alert and the table caption
      const alert = await screen.findAllByText(
        new RegExp(`sorted by ${title} in ascending order`, 'i'),
      )
      expect(alert).toHaveLength(2)
    })
  })

  describe('sorted row rendering', () => {
    // Covers spec/selenium/files_v2/files_spec.rb:621 ("sorts the files
    // properly") at the component layer: the existing tests only assert that
    // clicking a header *calls* onSortChange; they never assert the resulting
    // rendered row order. The component renders `rows` verbatim, so we assert
    // the actual order of the rendered name cells for each sort state the
    // parent would feed it (asc -> desc -> asc toggle).

    it('renders rows in the exact order of the rows prop (ascending state)', async () => {
      const {findAllByTestId} = renderComponent({
        rows: [pdfFile, txtFile],
        sort: {by: 'name', direction: 'asc'},
      })
      await findAllByTestId('table-row')
      expect(renderedNameOrder()).toEqual(['example.pdf', 'b_file.txt'])
    })

    it('renders the reversed order when the parent provides descending rows', async () => {
      const {findAllByTestId} = renderComponent({
        rows: [txtFile, pdfFile],
        sort: {by: 'name', direction: 'desc'},
      })
      await findAllByTestId('table-row')
      expect(renderedNameOrder()).toEqual(['b_file.txt', 'example.pdf'])
    })

    it('reflects each ascending/descending/ascending toggle in the rendered row order', async () => {
      // 1st click result: ascending
      const ascending = renderComponent({
        rows: [pdfFile, txtFile],
        sort: {by: 'name', direction: 'asc'},
      })
      await ascending.findAllByTestId('table-row')
      expect(renderedNameOrder()).toEqual(['example.pdf', 'b_file.txt'])
      ascending.unmount()

      // 2nd click result: descending -> rows reversed by the parent
      const descending = renderComponent({
        rows: [txtFile, pdfFile],
        sort: {by: 'name', direction: 'desc'},
      })
      await descending.findAllByTestId('table-row')
      expect(renderedNameOrder()).toEqual(['b_file.txt', 'example.pdf'])
      descending.unmount()

      // 3rd click result: ascending again -> original order restored
      const ascendingAgain = renderComponent({
        rows: [pdfFile, txtFile],
        sort: {by: 'name', direction: 'asc'},
      })
      await ascendingAgain.findAllByTestId('table-row')
      expect(renderedNameOrder()).toEqual(['example.pdf', 'b_file.txt'])
    })
  })

  describe('sort change trigger (pagination reset / re-sort handoff)', () => {
    // Covers the component's portion of:
    //   spec/selenium/files_v2/files_spec.rb:129 ("Can paginate sorted files")
    //   spec/selenium/files_v2/files_spec.rb:140 ("resets to the first page
    //     when sorting changes")
    // The page-1 reset and cross-page bookmark navigation live in
    // useGetPaginatedFiles (its useEffect resets currentPage to 1 whenever
    // `sort` changes). The component's only responsibility is to request the
    // new sort via onSortChange, which is what triggers that reset. Here we
    // assert that contract for a currently-unsorted, sortable column (size).

    it('requests ascending sort by size when its header is clicked', async () => {
      const {findByTestId} = renderComponent({
        rows: [pdfFile, txtFile],
        sort: {by: 'name', direction: 'asc'},
        onSortChange,
      })
      const header = await findByTestId('size')
      expect(header).toHaveAttribute('aria-sort', 'none')
      fireEvent.click(header.querySelector('button') as HTMLButtonElement)
      expect(onSortChange).toHaveBeenCalledWith({by: 'size', direction: 'asc'})
    })

    it('marks the size column as ascending when sorted by size', async () => {
      const {findByTestId} = renderComponent({
        rows: [pdfFile, txtFile],
        sort: {by: 'size', direction: 'asc'},
      })
      const header = await findByTestId('size')
      expect(header).toHaveAttribute('aria-sort', 'ascending')
    })

    it('requests a re-sort by a different column (name) while sorted by size', async () => {
      // Mirrors files_spec.rb:140 where the user is sorted by size and then
      // clicks the name header; switching columns asks the parent to sort by
      // the new column ascending, which resets pagination to page 1.
      const {findByTestId} = renderComponent({
        rows: [pdfFile, txtFile],
        sort: {by: 'size', direction: 'asc'},
        onSortChange,
      })
      const header = await findByTestId('name')
      fireEvent.click(header.querySelector('button') as HTMLButtonElement)
      expect(onSortChange).toHaveBeenCalledWith({by: 'name', direction: 'asc'})
    })
  })
})
