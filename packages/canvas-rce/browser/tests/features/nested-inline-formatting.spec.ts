import {test, expect} from '../../fixtures/test'

// Deeply nested inline elements appear when instructors layer formatting:
// bold italic underlined text, colored bold text, etc. TinyMCE must preserve
// all the formatting layers and the inner text through serialization.
test.describe('deeply nested inline formatting combinations', () => {
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

  test('<strong><em> nesting — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p><strong><em>Bold italic text</em></strong></p>')
    expect(content).toContain('Bold italic text')
  })

  test('<strong><em><u> three levels — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><strong><em><u>Triple formatted</u></em></strong></p>',
    )
    expect(content).toContain('Triple formatted')
  })

  test('<span> color wrapping <strong> — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span style="color: red;"><strong>Red bold text</strong></span></p>',
    )
    expect(content).toContain('Red bold text')
  })

  test('<sup> inside <strong> — superscript bold preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>E = mc<strong><sup>2</sup></strong> (energy equation)</p>',
    )
    expect(content).toContain('energy equation')
  })

  test('<code> inside <strong> — code bold preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Use <strong><code>console.log()</code></strong> for debugging.</p>',
    )
    expect(content).toContain('console.log()')
    expect(content).toContain('debugging')
  })

  test('mixed inline siblings — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><strong>Bold</strong>, <em>italic</em>, <u>underline</u>, and <code>code</code> in one paragraph.</p>',
    )
    expect(content).toContain('Bold')
    expect(content).toContain('italic')
    expect(content).toContain('underline')
    expect(content).toContain('code')
  })

  test('4-level nesting: em > strong > span > code', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><em><strong><span style="color:blue;"><code>deep</code></span></strong></em></p>',
    )
    expect(content).toContain('deep')
  })

  test('<mark> inside <a> — marked link text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="/courses/1/pages/intro"><mark>Introduction</mark></a></p>',
    )
    expect(content).toContain('Introduction')
  })
})
