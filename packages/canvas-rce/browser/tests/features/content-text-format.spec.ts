import {test, expect} from '../../fixtures/test'

// TinyMCE's getContent({format: 'text'}) strips all HTML tags and returns plain
// text. This is used for character counting and accessibility announcements.
// canvas-rce refactors must not break this format option.
test.describe('getContent — text format', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  async function getTextContent(page: any): Promise<string> {
    return page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent({format: 'text'})
    })
  }

  test('plain text content returns without HTML tags', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>hello world</p>')
    })
    const text = await getTextContent(page)
    expect(text).toContain('hello world')
    expect(text).not.toContain('<p>')
    expect(text).not.toContain('</p>')
  })

  test('bold text content strips <strong> tags', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p><strong>bold text</strong></p>')
    })
    const text = await getTextContent(page)
    expect(text).toContain('bold text')
    expect(text).not.toContain('<strong>')
  })

  test('table content returns cell text in text format', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(
        '<table><tr><td>cell one</td><td>cell two</td></tr></table>',
      )
    })
    const text = await getTextContent(page)
    expect(text).toContain('cell one')
    expect(text).toContain('cell two')
    expect(text).not.toContain('<table>')
    expect(text).not.toContain('<td>')
  })

  test('heading text is returned without heading tags', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<h2>Chapter Title</h2><p>body text</p>')
    })
    const text = await getTextContent(page)
    expect(text).toContain('Chapter Title')
    expect(text).toContain('body text')
    expect(text).not.toContain('<h2>')
  })

  test('list items are returned as text without list markup', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<ul><li>item one</li><li>item two</li></ul>')
    })
    const text = await getTextContent(page)
    expect(text).toContain('item one')
    expect(text).toContain('item two')
    expect(text).not.toContain('<ul>')
    expect(text).not.toContain('<li>')
  })

  test('text format word count matches visual word count', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>one two three</p>')
    })
    await page.waitForTimeout(500)
    const text = await getTextContent(page)
    const words = text.trim().split(/\s+/).filter(Boolean)
    expect(words.length).toBe(3)
  })
})
