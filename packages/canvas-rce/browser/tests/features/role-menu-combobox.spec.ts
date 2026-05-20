import {test, expect} from '../../fixtures/test'

// ARIA menu and combobox roles appear in custom interactive course widgets:
// dropdown menus for quiz answers, autocomplete search fields, select-style
// exercises. Nested role structures (menu > menuitem, listbox > option)
// convey widget semantics to screen readers.
test.describe('ARIA menu, menuitem, combobox, listbox, and option roles', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  async function setAndGet(page: any, html: string): Promise<string> {
    return page.evaluate((content: string) => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(content)
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent()
    }, html)
  }

  test('role="menu" with menuitems — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div role="menu"><div role="menuitem">File</div><div role="menuitem">Edit</div><div role="menuitem">View</div></div>',
    )
    expect(content).toContain('File')
    expect(content).toContain('Edit')
    expect(content).toContain('View')
  })

  test('role="menubar" with menus — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div role="menubar"><div role="menuitem" aria-haspopup="true">Actions</div><div role="menuitem" aria-haspopup="true">Settings</div></div>',
    )
    expect(content).toContain('Actions')
    expect(content).toContain('Settings')
  })

  test('role="listbox" with options — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div role="listbox" aria-label="Quiz answers"><div role="option" aria-selected="false">Option A: Linear time</div><div role="option" aria-selected="true">Option B: Logarithmic time</div><div role="option" aria-selected="false">Option C: Quadratic time</div></div>',
    )
    expect(content).toContain('Option A: Linear time')
    expect(content).toContain('Option B: Logarithmic time')
    expect(content).toContain('Option C: Quadratic time')
  })

  test('role="combobox" pattern — label and input text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<label id="combo-label">Select a topic:</label><div role="combobox" aria-labelledby="combo-label" aria-expanded="false" aria-haspopup="listbox">Choose topic</div>',
    )
    expect(content).toContain('Select a topic')
    expect(content).toContain('Choose topic')
  })

  test('role="menuitemcheckbox" — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div role="menu"><div role="menuitemcheckbox" aria-checked="true">Show line numbers</div><div role="menuitemcheckbox" aria-checked="false">Word wrap</div></div>',
    )
    expect(content).toContain('Show line numbers')
    expect(content).toContain('Word wrap')
  })

  test('role="menuitemradio" group — all items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div role="menu"><div role="menuitemradio" aria-checked="true">Small text</div><div role="menuitemradio" aria-checked="false">Medium text</div><div role="menuitemradio" aria-checked="false">Large text</div></div>',
    )
    expect(content).toContain('Small text')
    expect(content).toContain('Large text')
  })
})
