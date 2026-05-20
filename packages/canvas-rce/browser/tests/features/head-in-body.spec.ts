import {test, expect} from '../../fixtures/test'

// Full HTML documents pasted into the RCE may include <html>, <head>, and
// <body> wrapper elements. TinyMCE must extract only the body content and
// strip document-level elements. Tests verify that body text survives while
// head content (title, meta, link, style, script) is stripped.
test.describe('<head> and <html> wrapper elements in pasted content', () => {
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

  test('<title> in head is stripped, body text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<html><head><title>Page Title</title></head><body><p>Body content here</p></body></html>',
    )
    expect(content).toContain('Body content here')
    // title should be stripped from the editor content
    expect(content).not.toContain('<title>')
  })

  test('<script> in head is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<head><script>alert("xss")</script><style>body{color:red}</style></head><p>Safe body</p>',
    )
    expect(content).not.toContain('<script>')
    expect(content).not.toContain('alert')
    expect(content).toContain('Safe body')
  })

  test('body content from full HTML document is extracted', async ({page}) => {
    const content = await setAndGet(
      page,
      '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Course</title></head><body><h1>Chapter 1</h1><p>Introduction.</p></body></html>',
    )
    expect(content).toContain('Chapter 1')
    expect(content).toContain('Introduction')
  })

  test('<head> with link tag — body content preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<head><link rel="stylesheet" href="styles.css" /></head><p>Paragraph one.</p><p>Paragraph two.</p>',
    )
    expect(content).toContain('Paragraph one')
    expect(content).toContain('Paragraph two')
    expect(content).not.toContain('<link')
  })
})
