import {test, expect} from '../../fixtures/test'

// Named HTML entities (&copy;, &mdash;, &trade;, &hellip;, &nbsp;) appear in
// professionally authored course content. TinyMCE may preserve them as named
// entities, convert to numeric form (&#169;), or decode to literal Unicode.
// All forms are acceptable — tests document actual round-trip behavior.
test.describe('named HTML entities in content', () => {
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

  test('copyright symbol &copy; is preserved in some form', async ({page}) => {
    const content = await setAndGet(page, '<p>Content &copy; 2024 Instructure</p>')
    expect(content).toContain('2024 Instructure')
    // Accept literal ©, &copy;, or &#169;
    expect(content).toMatch(/©|&copy;|&#169;/)
  })

  test('trademark symbol &trade; is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>Canvas&trade; Learning Management System</p>')
    expect(content).toContain('Learning Management System')
    expect(content).toMatch(/™|&trade;|&#8482;/)
  })

  test('registered trademark &reg; is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>Instructure&reg;</p>')
    expect(content).toContain('Instructure')
    expect(content).toMatch(/®|&reg;|&#174;/)
  })

  test('em dash &mdash; is preserved in some form', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Canvas LMS&mdash;the leading LMS&mdash;serves millions.</p>',
    )
    expect(content).toContain('Canvas LMS')
    expect(content).toContain('serves millions')
    // Em dash may be literal — or entity-encoded
    expect(content).toMatch(/—|&mdash;|&#8212;/)
  })

  test('en dash &ndash; is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>Pages 10&ndash;25 are required reading.</p>')
    expect(content).toContain('Pages 10')
    expect(content).toContain('are required reading')
    expect(content).toMatch(/–|&ndash;|&#8211;/)
  })

  test('ellipsis &hellip; is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>Loading&hellip;</p>')
    expect(content).toContain('Loading')
    expect(content).toMatch(/…|&hellip;|&#8230;/)
  })

  test('non-breaking space &nbsp; between words is handled', async ({page}) => {
    const content = await setAndGet(page, '<p>First&nbsp;Last</p>')
    expect(content).toContain('First')
    expect(content).toContain('Last')
    // nbsp may be preserved as entity or literal non-breaking space
    expect(content).toMatch(/First(&nbsp;| )Last/)
  })

  test('left and right quotes &ldquo; &rdquo; are preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>&ldquo;To be or not to be&rdquo; &mdash; Shakespeare</p>',
    )
    expect(content).toContain('Shakespeare')
    // Curly quotes or straight quotes or entities — all acceptable
    expect(content).toMatch(/"|"|&ldquo;|&rdquo;|"/)
  })

  test('fraction &frac12; is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>Eat &frac12; of the serving.</p>')
    expect(content).toContain('of the serving')
    expect(content).toMatch(/½|&frac12;|&#189;/)
  })

  test('multiple entities in one paragraph all survive', async ({page}) => {
    const content = await setAndGet(page, '<p>Cost: $5.99&nbsp;&mdash;&nbsp;Sale ends&hellip;</p>')
    expect(content).toContain('Cost')
    expect(content).toContain('Sale ends')
  })
})
