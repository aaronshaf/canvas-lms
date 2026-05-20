import {test, expect} from '../../fixtures/test'

// CSS Grid and Flexbox appear in modern course content layouts —
// side-by-side content, image galleries, and responsive card grids.
// Text content must be preserved even if TinyMCE strips or modifies
// the layout-specific CSS properties.
test.describe('CSS grid and flexbox layout properties', () => {
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

  test('flex container with children — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="display: flex; gap: 16px;"><div>Left column</div><div>Right column</div></div>',
    )
    expect(content).toContain('Left column')
    expect(content).toContain('Right column')
  })

  test('flex with align-items and justify-content — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="display: flex; align-items: center; justify-content: space-between;"><span>Item A</span><span>Item B</span><span>Item C</span></div>',
    )
    expect(content).toContain('Item A')
    expect(content).toContain('Item B')
    expect(content).toContain('Item C')
  })

  test('flex-wrap row layout — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="display: flex; flex-wrap: wrap;"><div style="flex: 1 1 200px;">Card One</div><div style="flex: 1 1 200px;">Card Two</div></div>',
    )
    expect(content).toContain('Card One')
    expect(content).toContain('Card Two')
  })

  test('grid template columns — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr;"><div>Grid cell 1</div><div>Grid cell 2</div><div>Grid cell 3</div></div>',
    )
    expect(content).toContain('Grid cell 1')
    expect(content).toContain('Grid cell 3')
  })

  test('grid with gap property — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;"><p>First</p><p>Second</p></div>',
    )
    expect(content).toContain('First')
    expect(content).toContain('Second')
  })

  test('grid-area / grid-column-span — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="display: grid; grid-template-columns: 1fr 1fr;"><div style="grid-column: span 2;">Full width header</div><div>Left</div><div>Right</div></div>',
    )
    expect(content).toContain('Full width header')
    expect(content).toContain('Left')
    expect(content).toContain('Right')
  })

  test('aspect-ratio property — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="aspect-ratio: 16/9; background: #eee;">Video placeholder text</div>',
    )
    expect(content).toContain('Video placeholder text')
  })
})
