import {test, expect} from '../../fixtures/test'

// writing-mode controls vertical text direction — used in East Asian course
// content (Chinese, Japanese, Korean) and decorative vertical labels.
// text-orientation and direction affect how characters are rotated in vertical
// mode. Text must be preserved regardless of how TinyMCE handles these.
test.describe('CSS writing-mode and text direction properties', () => {
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

  test('writing-mode: vertical-rl — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="writing-mode: vertical-rl;">Vertical right-to-left text</div>',
    )
    expect(content).toContain('Vertical right-to-left text')
  })

  test('writing-mode: vertical-lr — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="writing-mode: vertical-lr;">Vertical left-to-right text</div>',
    )
    expect(content).toContain('Vertical left-to-right text')
  })

  test('writing-mode: horizontal-tb (default explicit) — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="writing-mode: horizontal-tb;">Normal horizontal text.</p>',
    )
    expect(content).toContain('Normal horizontal text')
  })

  test('text-orientation: mixed — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<span style="writing-mode: vertical-rl; text-orientation: mixed;">Mixed orientation content</span>',
    )
    expect(content).toContain('Mixed orientation content')
  })

  test('vertical text in table cell — cell text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><th style="writing-mode: vertical-rl;">Category</th><td>Value text</td></tr></table>',
    )
    expect(content).toContain('Category')
    expect(content).toContain('Value text')
  })
})
