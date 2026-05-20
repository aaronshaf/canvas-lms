import {test, expect} from '../../fixtures/test'

// CSS transform, transition, and animation appear in imported course content
// and advanced instructor HTML. Tests verify the text content is preserved
// regardless of how TinyMCE handles these style properties.
test.describe('CSS transform, transition, and animation in inline styles', () => {
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

  test('transform: rotate — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p style="transform: rotate(45deg);">Rotated text</p>')
    expect(content).toContain('Rotated text')
  })

  test('transform: scale — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p style="transform: scale(1.5);">Scaled up text</p>')
    expect(content).toContain('Scaled up text')
  })

  test('transform: translate — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<span style="transform: translateX(10px);">Shifted span</span>',
    )
    expect(content).toContain('Shifted span')
  })

  test('transition property — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="transition: color 0.3s ease;">Transition text</p>',
    )
    expect(content).toContain('Transition text')
  })

  test('opacity in inline style — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p style="opacity: 0.7;">Semi-transparent paragraph</p>')
    expect(content).toContain('Semi-transparent paragraph')
  })

  test('multiple transform functions — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="transform: translateY(-5px) rotate(2deg);">Composite transform</div>',
    )
    expect(content).toContain('Composite transform')
  })

  test('will-change property — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="will-change: transform;">Performance hint text</p>',
    )
    expect(content).toContain('Performance hint text')
  })
})
