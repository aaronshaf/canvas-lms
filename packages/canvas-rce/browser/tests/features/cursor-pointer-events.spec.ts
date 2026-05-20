import {test, expect} from '../../fixtures/test'

// cursor and pointer-events CSS properties appear in interactive course widgets
// (drag-and-drop exercises, clickable diagrams, disabled states). These CSS
// properties affect UX behavior but not content — text must survive regardless.
test.describe('cursor and pointer-events CSS properties', () => {
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

  test('cursor: pointer — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p style="cursor: pointer;">Clickable paragraph</p>')
    expect(content).toContain('Clickable paragraph')
  })

  test('cursor: not-allowed — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p style="cursor: not-allowed;">Disabled element</p>')
    expect(content).toContain('Disabled element')
  })

  test('cursor: crosshair on div — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="cursor: crosshair;">Crosshair target area</div>',
    )
    expect(content).toContain('Crosshair target area')
  })

  test('pointer-events: none — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<span style="pointer-events: none;">Non-interactive overlay text</span>',
    )
    expect(content).toContain('Non-interactive overlay text')
  })

  test('pointer-events: auto — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="pointer-events: auto;">Interactive content</div>',
    )
    expect(content).toContain('Interactive content')
  })

  test('user-select: none — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="user-select: none;">Non-selectable watermark text</p>',
    )
    expect(content).toContain('Non-selectable watermark text')
  })
})
