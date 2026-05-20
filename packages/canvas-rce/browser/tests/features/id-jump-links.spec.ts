import {test, expect} from '../../fixtures/test'

// id attributes on headings and sections enable in-page anchor navigation.
// Canvas course pages often have a table of contents that links to #section-id
// anchors deeper in the page. If canvas-rce strips id attributes, TOC links
// break silently — a refactor must not introduce this regression.
test.describe('id attributes for in-page jump links', () => {
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

  test('id on a heading is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<h2 id="introduction">Introduction</h2><p>Opening paragraph.</p>',
    )
    expect(content).toContain('Introduction')
    expect(content).toContain('id')
  })

  test('anchor link to an id in the same page text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="#section-2">Jump to Section 2</a></p><h2 id="section-2">Section 2</h2>',
    )
    expect(content).toContain('Jump to Section 2')
    expect(content).toContain('Section 2')
  })

  test('id on a paragraph is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p id="key-concept">The key concept explained here.</p>')
    expect(content).toContain('The key concept explained here')
    expect(content).toContain('id')
  })

  test('multiple sections with ids all preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<h2 id="ch1">Chapter 1</h2><p>Content one.</p><h2 id="ch2">Chapter 2</h2><p>Content two.</p>',
    )
    expect(content).toContain('Chapter 1')
    expect(content).toContain('Content one')
    expect(content).toContain('Chapter 2')
    expect(content).toContain('Content two')
  })

  test('id with hyphen and numbers is preserved', async ({page}) => {
    const content = await setAndGet(page, '<h3 id="section-3-2-advanced">Advanced Topics</h3>')
    expect(content).toContain('Advanced Topics')
    expect(content).toContain('section-3-2-advanced')
  })

  test('id on a list element — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol><li id="step-1">First step</li><li id="step-2">Second step</li></ol>',
    )
    expect(content).toContain('First step')
    expect(content).toContain('Second step')
  })
})
