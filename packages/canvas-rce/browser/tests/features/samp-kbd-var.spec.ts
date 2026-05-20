import {test, expect} from '../../fixtures/test'

// <samp>, <kbd>, and <var> are semantic inline elements for technical content:
// - <kbd> marks keyboard input (e.g. "Press <kbd>Ctrl+S</kbd>")
// - <samp> marks sample output from a program
// - <var> marks variable names in math or code
// These appear in CS and STEM course content. canvas-rce must preserve them.
test.describe('<samp>, <kbd>, <var> semantic computer elements', () => {
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

  test('<kbd> text is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>Press <kbd>Ctrl</kbd> + <kbd>C</kbd> to copy.</p>')
    expect(content).toContain('Ctrl')
    expect(content).toContain('to copy')
  })

  test('<samp> output text is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>The program outputs: <samp>Hello, World!</samp></p>')
    expect(content).toContain('Hello, World!')
    expect(content).toContain('program outputs')
  })

  test('<var> variable name is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Let <var>x</var> be a positive integer where <var>x</var> &gt; 0.</p>',
    )
    expect(content).toContain('positive integer')
  })

  test('<kbd> inside a list instruction is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol><li>Press <kbd>Enter</kbd> to confirm</li><li>Press <kbd>Esc</kbd> to cancel</li></ol>',
    )
    expect(content).toContain('Enter')
    expect(content).toContain('Esc')
    expect(content).toContain('to cancel')
  })

  test('<samp> inside a <pre> block is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<pre><samp>$ npm install\nadded 42 packages</samp></pre>',
    )
    expect(content).toContain('npm install')
    expect(content).toContain('added 42 packages')
  })

  test('<var> in a math expression with sub/sup is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><var>E</var> = <var>m</var><var>c</var><sup>2</sup></p>',
    )
    expect(content).toContain('sup')
  })

  test('all three elements combined in one paragraph', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Enter <kbd>ls -la</kbd> and check <var>permissions</var>; output is <samp>drwxr-xr-x</samp>.</p>',
    )
    expect(content).toContain('ls -la')
    expect(content).toContain('permissions')
    expect(content).toContain('drwxr-xr-x')
  })
})
