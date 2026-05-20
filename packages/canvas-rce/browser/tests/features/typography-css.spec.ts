import {test, expect} from '../../fixtures/test'

// Typography CSS properties beyond font-size and font-family:
// font-weight values (100-900), font-variant (small-caps),
// font-style, text-decoration (underline, line-through, overline),
// and white-space. These appear in course materials and imported content.
test.describe('typography CSS properties', () => {
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

  test('font-weight: 700 — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p style="font-weight: 700;">Bold by number</p>')
    expect(content).toContain('Bold by number')
  })

  test('font-weight: 300 (light) — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p style="font-weight: 300;">Light weight text</p>')
    expect(content).toContain('Light weight text')
  })

  test('font-variant: small-caps — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="font-variant: small-caps;">Small Caps Heading</p>',
    )
    expect(content).toContain('Small Caps Heading')
  })

  test('text-decoration: underline — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="text-decoration: underline;">Underlined text</p>',
    )
    expect(content).toContain('Underlined text')
  })

  test('text-decoration: line-through — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="text-decoration: line-through;">Struck through</p>',
    )
    expect(content).toContain('Struck through')
  })

  test('white-space: nowrap — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="white-space: nowrap;">No wrap text content</p>',
    )
    expect(content).toContain('No wrap text content')
  })

  test('white-space: pre-wrap — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="white-space: pre-wrap;">Pre-wrap  text  here</p>',
    )
    expect(content).toContain('Pre-wrap')
    expect(content).toContain('text')
  })
})
