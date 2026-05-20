import {test, expect} from '../../fixtures/test'

// tabindex and accesskey control keyboard focus order and shortcuts.
// Custom tabindex values appear in course content when instructors build
// interactive exercises or structured navigation flows. These attributes
// must survive round-trips so keyboard navigation works after saving.
test.describe('tabindex and accesskey attributes', () => {
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

  test('tabindex="0" on a div — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<div tabindex="0">Focusable container content</div>')
    expect(content).toContain('Focusable container content')
  })

  test('tabindex="-1" removes element from tab order — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<div tabindex="-1">Skip in tab order</div>')
    expect(content).toContain('Skip in tab order')
  })

  test('tabindex on a link — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="/courses/1" tabindex="2">Prioritized link</a></p>',
    )
    expect(content).toContain('Prioritized link')
  })

  test('multiple elements with tabindex — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div tabindex="1">First focus</div><div tabindex="2">Second focus</div><div tabindex="3">Third focus</div>',
    )
    expect(content).toContain('First focus')
    expect(content).toContain('Second focus')
    expect(content).toContain('Third focus')
  })

  test('accesskey on a link — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="/courses/1/pages/home" accesskey="h">Home page (Alt+H)</a></p>',
    )
    expect(content).toContain('Home page')
  })

  test('tabindex on table cell — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td tabindex="0">Interactive cell</td><td>Normal cell</td></tr></table>',
    )
    expect(content).toContain('Interactive cell')
    expect(content).toContain('Normal cell')
  })
})
