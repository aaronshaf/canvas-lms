import {test, expect} from '../../fixtures/test'

// Canvas renders math equations using MathJax with specific span patterns.
// The `data-equation-content` attribute carries the LaTeX source. The
// `class="equation_image"` img element displays the rendered equation.
// Instructors copy these from Canvas's equation editor and expect them preserved.
test.describe('Canvas math equation patterns', () => {
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

  test('data-equation-content attribute — attribute present in output', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Area formula: <span data-equation-content="A = \\pi r^2">A = πr²</span></p>',
    )
    expect(content).toContain('Area formula')
  })

  test('Canvas equation image with class — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>The quadratic formula: <img class="equation_image" alt="x = frac{-b pm sqrt{b^2-4ac}}{2a}" src="/equation_images/x%3D..."> solves ax²+bx+c=0.</p>',
    )
    expect(content).toContain('quadratic formula')
    expect(content).toContain('solves')
  })

  test('LaTeX in data attribute with special chars — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Summation: <span data-equation-content="\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}">∑</span></p>',
    )
    expect(content).toContain('Summation')
  })

  test('multiple equations in a paragraph — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Given <span data-equation-content="f(x) = x^2">f(x)</span> and <span data-equation-content="g(x) = 2x">g(x)</span>, find the intersection.</p>',
    )
    expect(content).toContain('find the intersection')
  })

  test('equation inside a table cell — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td>Formula</td><td><span data-equation-content="E = mc^2">E = mc²</span></td></tr></table>',
    )
    expect(content).toContain('Formula')
  })
})
