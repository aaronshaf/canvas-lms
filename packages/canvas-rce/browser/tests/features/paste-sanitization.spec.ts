import {test, expect} from '../../fixtures/test'

// Paste sanitization: content pasted via execCommand is processed through canvas-rce's
// sanitization pipeline before being inserted.
test.describe('paste sanitization', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
  })

  async function pasteHtml(page: any, html: string) {
    // Use TinyMCE's insertContent — exercises the same sanitization path as paste
    await page.evaluate((content: string) => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.insertContent(content)
    }, html)
  }

  test('inserting plain text preserves content', async ({page, rcePage}) => {
    await pasteHtml(page, 'plain text content')
    const content = await rcePage.getContent()
    expect(content).toContain('plain text content')
  })

  test('inserting bold HTML preserves <strong>', async ({page, rcePage}) => {
    await pasteHtml(page, '<strong>bold pasted</strong>')
    const content = await rcePage.getContent()
    expect(content).toMatch(/<strong>bold pasted<\/strong>/)
  })

  test('inserting script tags strips them', async ({page, rcePage}) => {
    await pasteHtml(page, 'safe<script>alert("xss")</script>content')
    const content = await rcePage.getContent()
    expect(content).not.toContain('<script>')
    expect(content).toContain('safe')
  })

  test('inserting onclick attributes strips them', async ({page, rcePage}) => {
    await pasteHtml(page, '<span onclick="alert(1)">click me</span>')
    const content = await rcePage.getContent()
    expect(content).not.toContain('onclick')
    expect(content).toContain('click me')
  })

  test('inserting a table preserves structure', async ({page, rcePage}) => {
    await pasteHtml(page, '<table><tr><td>cell A</td><td>cell B</td></tr></table>')
    const content = await rcePage.getContent()
    expect(content).toMatch(/<table/)
    expect(content).toContain('cell A')
    expect(content).toContain('cell B')
  })
})
