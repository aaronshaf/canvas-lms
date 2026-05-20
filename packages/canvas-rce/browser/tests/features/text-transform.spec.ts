import {test, expect} from '../../fixtures/test'

// text-transform CSS property controls letter casing: uppercase, lowercase,
// capitalize. Instructors use this for headings and callouts. canvas-rce
// must preserve the CSS property — stripping it silently changes visual output.
test.describe('text-transform CSS property', () => {
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

  test('text-transform: uppercase text content is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="text-transform: uppercase;">important notice</p>',
    )
    // The underlying text must survive — CSS controls display, not actual chars
    expect(content).toContain('important notice')
  })

  test('text-transform: capitalize on heading content is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<h2 style="text-transform: capitalize;">chapter one introduction</h2>',
    )
    expect(content).toContain('chapter one introduction')
    expect(content).toMatch(/<h2/)
  })

  test('text-transform: lowercase on span is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span style="text-transform: lowercase;">ALL CAPS INPUT</span></p>',
    )
    expect(content).toContain('ALL CAPS INPUT')
  })

  test('text-transform: none (explicit reset) is handled', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="text-transform: none;">Normal casing preserved.</p>',
    )
    expect(content).toContain('Normal casing preserved')
  })

  test('text-transform combined with font-weight preserves content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><strong style="text-transform: uppercase;">bold uppercase label</strong></p>',
    )
    expect(content).toContain('bold uppercase label')
    expect(content).toMatch(/<strong/)
  })

  test('text-transform on multiple adjacent elements', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span style="text-transform: uppercase;">first</span> <span style="text-transform: capitalize;">second phrase</span></p>',
    )
    expect(content).toContain('first')
    expect(content).toContain('second phrase')
  })
})
