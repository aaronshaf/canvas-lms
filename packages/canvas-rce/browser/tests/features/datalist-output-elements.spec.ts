import {test, expect} from '../../fixtures/test'

// HTML5 form-related elements <datalist>, <output>, and <keygen> belong in
// forms and should not persist in RCE body content. Tests document whether
// TinyMCE strips them and verify that surrounding text is always preserved.
test.describe('<datalist>, <output>, and other HTML5 form elements', () => {
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

  test('text around <datalist> is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before datalist.</p><datalist id="options"><option value="Canvas" /><option value="Moodle" /></datalist><p>After datalist.</p>',
    )
    expect(content).toContain('Before datalist')
    expect(content).toContain('After datalist')
  })

  test('<output> element — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Result: <output name="result" for="a b">42</output> points earned.</p>',
    )
    expect(content).toContain('Result')
    expect(content).toContain('points earned')
  })

  test('<meter> and <output> together — all surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Progress: <meter value="0.7">70%</meter> | Score: <output>87</output></p>',
    )
    expect(content).toContain('Progress')
    expect(content).toContain('Score')
  })

  test('<input type="range"> is stripped — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Adjust: <input type="range" min="0" max="100" value="50" /> level</p>',
    )
    expect(content).toContain('Adjust')
    expect(content).toContain('level')
    // input should be stripped
    expect(content).not.toContain('<input')
  })

  test('<input type="color"> is stripped — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Pick a color: <input type="color" value="#ff0000" /> for the theme.</p>',
    )
    expect(content).toContain('Pick a color')
    expect(content).toContain('for the theme')
    expect(content).not.toContain('<input')
  })
})
