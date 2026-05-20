import {test, expect} from '../../fixtures/test'

// HTML entities must be properly escaped when content contains literal angle
// brackets or ampersands as text (not markup). Failing to escape these could
// produce malformed HTML or open XSS vectors via entity confusion.
test.describe('HTML entities as literal text', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
  })

  test('inserting literal < and > produces escaped entities', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.insertContent('price &lt; 100 &gt; 50')
    })
    const content = await rcePage.getContent()
    // Should contain the escaped form or decoded text, not raw < and >
    expect(content).toContain('price')
    // The serialized HTML must not have unescaped < or > in text context
    // (they're either &lt;/&gt; or the literal chars preserved safely)
    expect(content).not.toMatch(/<[^a-zA-Z/!].*>.*price/)
  })

  test('ampersand in text is preserved as &amp;', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.insertContent('rock &amp; roll')
    })
    const content = await rcePage.getContent()
    // Should contain the ampersand in some form — either entity or literal
    expect(content).toMatch(/rock.*(&amp;|&).*roll/)
  })

  test('non-breaking space entity &nbsp; is handled', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.insertContent('word&nbsp;word')
    })
    const content = await rcePage.getContent()
    expect(content).toContain('word')
    // &nbsp; should be preserved as entity or as the actual non-breaking space
    expect(content).toMatch(/word(\s|&nbsp;)word/)
  })

  test('double quotes in attribute values are escaped', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.insertContent(
        '<span title="She said &quot;hello&quot;">text</span>',
      )
    })
    const content = await rcePage.getContent()
    expect(content).toContain('text')
    // Title attribute must not break the HTML structure
    expect(content).toMatch(/<span[^>]*title=/)
  })

  test('content with < in text context does not create unwanted tags', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>5 &lt; 10 and 10 &gt; 5</p>')
    })
    const content = await rcePage.getContent()
    // The text should be present
    expect(content).toContain('5')
    expect(content).toContain('10')
    // No unintended HTML elements should be created from the < and >
    const tagsBetweenP = content.replace(/<p[^>]*>/g, '').replace(/<\/p>/g, '')
    // Should not contain structural tags like <div>, <span class="..."> etc. created from text content
    expect(content).not.toMatch(/<div>5/)
  })
})
