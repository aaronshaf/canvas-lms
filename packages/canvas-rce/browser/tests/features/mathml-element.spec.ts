import {test, expect} from '../../fixtures/test'

// MathML (<math>) is the XML-based markup language for mathematical notation.
// Canvas uses MathJax which renders MathML and LaTeX; the raw MathML may
// appear in content from equation editors or imported STEM course materials.
// Tests verify that MathML text content and surrounding text survive.
test.describe('MathML <math> element content', () => {
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

  test('paragraph text around <math> is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>The formula is: <math><mrow><mi>x</mi><mo>=</mo><mn>2</mn></mrow></math> and holds.</p>',
    )
    expect(content).toContain('The formula is')
    expect(content).toContain('and holds')
  })

  test('<math> with display block — surrounding paragraphs preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Euler\'s identity:</p><math display="block"><mrow><msup><mi>e</mi><mrow><mi>i</mi><mi>π</mi></mrow></msup><mo>+</mo><mn>1</mn><mo>=</mo><mn>0</mn></mrow></math><p>This is remarkable.</p>',
    )
    expect(content).toContain("Euler's identity")
    expect(content).toContain('This is remarkable')
  })

  test('multiple inline <math> elements — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>When <math><mi>a</mi></math> and <math><mi>b</mi></math> are positive, <math><mrow><mi>a</mi><mo>+</mo><mi>b</mi><mo>&gt;</mo><mn>0</mn></mrow></math>.</p>',
    )
    expect(content).toContain('When')
    expect(content).toContain('are positive')
  })

  test('<math> inside a table cell — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><th>Formula</th><th>Value</th></tr><tr><td><math><msup><mi>x</mi><mn>2</mn></msup></math></td><td>Squared</td></tr></table>',
    )
    expect(content).toContain('Formula')
    expect(content).toContain('Squared')
  })

  test('<math> does not crash editor', async ({page}) => {
    const content = await setAndGet(
      page,
      '<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mi>a</mi><mi>b</mi></mfrac></math><p>End.</p>',
    )
    expect(content).toContain('End')
    expect(typeof content).toBe('string')
  })
})
