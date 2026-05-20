import {test, expect} from '../../fixtures/test'

// <dialog> is a native HTML modal element. Modern course content may include it
// for interactive exercises, or it may arrive via copy-paste from modern web
// pages. TinyMCE must not crash on it, and surrounding text must be preserved.
test.describe('<dialog> HTML element', () => {
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

  test('<dialog> with text content — no crash, content is string', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before dialog</p><dialog open><p>Dialog content text.</p></dialog><p>After dialog</p>',
    )
    expect(typeof content).toBe('string')
    // Surrounding paragraphs should survive
    expect(content).toContain('Before dialog')
    expect(content).toContain('After dialog')
  })

  test('<dialog> without open — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<dialog><p>Hidden dialog content.</p></dialog><p>Visible paragraph.</p>',
    )
    expect(content).toContain('Visible paragraph')
  })

  test('<dialog> with open attribute — dialog text preserved or content is string', async ({
    page,
  }) => {
    const content = await setAndGet(
      page,
      '<dialog open><h2>Confirmation</h2><p>Are you sure you want to submit?</p></dialog>',
    )
    expect(typeof content).toBe('string')
  })
})
