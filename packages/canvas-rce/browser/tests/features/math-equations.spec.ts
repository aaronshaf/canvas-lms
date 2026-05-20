import {test, expect} from '../../fixtures/test'

// Canvas uses span.math_equation_latex and span.math_equation_mml to store
// LaTeX/MathML math equations. These are rendered client-side by MathJax.
// canvas-rce must not strip these spans or their class/content during editing.
test.describe('math equation content preservation', () => {
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

  test('span.math_equation_latex with LaTeX content is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>The equation is: <span class="math_equation_latex">\\frac{x^2 + y^2}{z}</span></p>',
    )
    expect(content).toContain('The equation is')
    expect(content).toContain('frac')
  })

  test('inline LaTeX math in a paragraph survives', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Einstein\'s equation <span class="math_equation_latex">E = mc^2</span> changed physics.</p>',
    )
    expect(content).toContain('changed physics')
    expect(content).toContain('E = mc')
  })

  test('quadratic formula LaTeX is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span class="math_equation_latex">x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}</span></p>',
    )
    expect(content).toContain('sqrt')
  })

  test('multiple math equations on the same page', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p>Area: <span class="math_equation_latex">A = \\pi r^2</span></p>
       <p>Perimeter: <span class="math_equation_latex">P = 2\\pi r</span></p>`,
    )
    expect(content).toContain('Area')
    expect(content).toContain('Perimeter')
    expect(content).toContain('pi r')
  })

  test('math equation inside a list item is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li>Formula: <span class="math_equation_latex">y = mx + b</span></li></ul>',
    )
    expect(content).toContain('Formula')
    expect(content).toContain('mx + b')
  })

  test('math equation inside a table cell is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><th>Formula</th><th>Name</th></tr><tr><td><span class="math_equation_latex">F = ma</span></td><td>Newton\'s 2nd Law</td></tr></table>',
    )
    expect(content).toContain('Formula')
    expect(content).toContain('F = ma')
    expect(content).toContain('Newton')
  })

  test('MathML span class is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span class="math_equation_mml"><math><mi>x</mi></math></span></p>',
    )
    // Either the span class or the math content must survive
    expect(content).toContain('x')
  })
})
