import {test, expect} from '../../fixtures/test'

// Visual CSS effects — box-shadow, text-shadow, border-radius, outline —
// appear in imported course content and instructor-crafted callout boxes.
// Text content must survive regardless of how TinyMCE handles these properties.
test.describe('CSS visual effect properties', () => {
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

  test('box-shadow inline style — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="box-shadow: 2px 2px 4px rgba(0,0,0,0.3);">Shadow box content</div>',
    )
    expect(content).toContain('Shadow box content')
  })

  test('text-shadow inline style — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="text-shadow: 1px 1px 2px #333;">Shadow text heading</p>',
    )
    expect(content).toContain('Shadow text heading')
  })

  test('border-radius inline style — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="border-radius: 8px; border: 1px solid #ccc; padding: 10px;">Rounded box</div>',
    )
    expect(content).toContain('Rounded box')
  })

  test('outline inline style — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="outline: 2px solid blue; outline-offset: 4px;">Outlined paragraph</p>',
    )
    expect(content).toContain('Outlined paragraph')
  })

  test('multiple visual effects combined — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); background: #f8f9fa; padding: 16px;">Callout box with effects</div>',
    )
    expect(content).toContain('Callout box with effects')
  })

  test('filter: blur — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p style="filter: blur(0px);">Sharp text content</p>')
    expect(content).toContain('Sharp text content')
  })

  test('clip-path polygon — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);">Clipped content</div>',
    )
    expect(content).toContain('Clipped content')
  })
})
