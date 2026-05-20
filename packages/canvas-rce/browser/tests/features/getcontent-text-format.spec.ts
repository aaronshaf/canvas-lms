import {test, expect} from '../../fixtures/test'

// getContent({format: 'text'}) strips all HTML tags and returns plain text.
// Canvas uses this for word count, character limits, and content previews.
// It must return actual readable text — not tag noise, not empty string.
test.describe('getContent with text format', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('getContent text strips HTML tags from bold text', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p><strong>bold text</strong></p>')
      return ed.getContent({format: 'text'})
    })
    expect(result).toContain('bold text')
    expect(result).not.toContain('<strong>')
    expect(result).not.toContain('<p>')
  })

  test('getContent text preserves words from a list', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<ul><li>Apple</li><li>Banana</li><li>Cherry</li></ul>')
      return ed.getContent({format: 'text'})
    })
    expect(result).toContain('Apple')
    expect(result).toContain('Banana')
    expect(result).toContain('Cherry')
    expect(result).not.toContain('<li>')
  })

  test('getContent text returns empty-ish string for empty editor', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('')
      return ed.getContent({format: 'text'})
    })
    // Empty editor may return empty string or whitespace
    expect(typeof result).toBe('string')
    expect(result.replace(/\s/g, '')).toBe('')
  })

  test('getContent text from table returns all cell text', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<table><tr><td>Cell A</td><td>Cell B</td></tr></table>')
      return ed.getContent({format: 'text'})
    })
    expect(result).toContain('Cell A')
    expect(result).toContain('Cell B')
    expect(result).not.toContain('<td>')
  })

  test('getContent text from heading returns heading words', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<h2>Course Introduction</h2><p>Welcome to the course.</p>')
      return ed.getContent({format: 'text'})
    })
    expect(result).toContain('Course Introduction')
    expect(result).toContain('Welcome to the course')
    expect(result).not.toContain('<h2>')
  })

  test('getContent text from link returns link text not href', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Visit <a href="https://example.com">our website</a> for more.</p>')
      return ed.getContent({format: 'text'})
    })
    expect(result).toContain('our website')
    expect(result).toContain('for more')
    // href should not appear in plain text output
    expect(result).not.toContain('https://example.com')
    expect(result).not.toContain('<a')
  })

  test('getContent html and text return different results for same content', async ({page}) => {
    const results = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p><em>italic</em> word</p>')
      return {
        html: ed.getContent({format: 'html'}),
        text: ed.getContent({format: 'text'}),
      }
    })
    expect(results.html).toMatch(/<em>italic<\/em>/)
    expect(results.text).toContain('italic')
    expect(results.text).not.toContain('<em>')
    expect(results.html).not.toBe(results.text)
  })

  test('getContent text word count matches visible words', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>one two three four five</p>')
      return ed.getContent({format: 'text'})
    })
    const words = result.trim().split(/\s+/).filter(Boolean)
    expect(words.length).toBe(5)
  })
})
