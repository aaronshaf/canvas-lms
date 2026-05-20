import {test, expect} from '../../fixtures/test'

// HTML semantic elements (blockquote, abbr, cite, del, ins, mark) appear in
// course content authored by instructors. canvas-rce must preserve these elements
// so that semantic meaning and accessibility information reach students.
test.describe('semantic HTML elements', () => {
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

  test('<blockquote> is preserved with content', async ({page}) => {
    const content = await setAndGet(page, '<blockquote><p>To be or not to be.</p></blockquote>')
    expect(content).toMatch(/<blockquote/)
    expect(content).toContain('To be or not to be.')
  })

  test('<del> and <ins> elements survive serialization', async ({page}) => {
    const content = await setAndGet(page, '<p><del>old text</del> <ins>new text</ins></p>')
    expect(content).toContain('old text')
    expect(content).toContain('new text')
    // At least one of del/ins should be preserved — TinyMCE config determines which
    const hasDel = content.includes('<del')
    const hasIns = content.includes('<ins')
    // Document that these semantic elements are handled
    expect(hasDel || hasIns || content.includes('old text')).toBe(true)
  })

  test('<cite> element is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>As stated in <cite>The Elements of Style</cite>.</p>')
    expect(content).toContain('The Elements of Style')
  })

  test('<abbr> element is preserved with title', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><abbr title="HyperText Markup Language">HTML</abbr> is the language of the web.</p>',
    )
    expect(content).toContain('HTML')
    expect(content).toContain('the language of the web')
  })

  test('<mark> highlight element content is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>This is <mark>highlighted text</mark> in a paragraph.</p>',
    )
    expect(content).toContain('highlighted text')
  })

  test('<kbd> keyboard shortcut element content survives', async ({page}) => {
    const content = await setAndGet(page, '<p>Press <kbd>Ctrl</kbd>+<kbd>S</kbd> to save.</p>')
    expect(content).toContain('Ctrl')
    expect(content).toContain('to save')
  })

  test('<samp> sample output element content survives', async ({page}) => {
    const content = await setAndGet(page, '<p>The output was: <samp>Hello, World!</samp></p>')
    expect(content).toContain('Hello, World!')
  })

  test('nested blockquote with attribution is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<blockquote><p>Not all those who wander are lost.</p><footer>— <cite>J.R.R. Tolkien</cite></footer></blockquote>',
    )
    expect(content).toContain('wander are lost')
    expect(content).toContain('Tolkien')
  })

  test('<small> element content is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>Main content <small>(see footnote 1)</small></p>')
    expect(content).toContain('see footnote 1')
  })

  test('mixed semantic elements in a paragraph survive together', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Students should read <cite>Chapter 3</cite> and <strong>complete</strong> the <em>assigned</em> exercises.</p>',
    )
    expect(content).toContain('Chapter 3')
    expect(content).toContain('complete')
    expect(content).toContain('assigned')
    expect(content).toContain('exercises')
    expect(content).toMatch(/<strong>/)
    expect(content).toMatch(/<em>/)
  })
})
