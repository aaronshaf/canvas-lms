import {test, expect} from '../../fixtures/test'

// Horizontal rules (<hr>) are a valid structural element in course content.
// TinyMCE exposes InsertHorizontalRule via execCommand; canvas-rce must not
// strip or transform <hr> elements during serialization.
test.describe('horizontal rule', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
  })

  test('InsertHorizontalRule command inserts an <hr> element', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.execCommand('InsertHorizontalRule')
    })
    const content = await rcePage.getContent()
    expect(content).toMatch(/<hr/)
  })

  test('<hr> is preserved when set via setContent', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>above</p><hr /><p>below</p>')
    })
    const content = await rcePage.getContent()
    expect(content).toMatch(/<hr/)
    expect(content).toContain('above')
    expect(content).toContain('below')
  })

  test('<hr> appears between content in correct position', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>above</p><hr /><p>below</p>')
    })
    const content = await rcePage.getContent()
    const hrIdx = content.indexOf('<hr')
    const aboveIdx = content.indexOf('above')
    const belowIdx = content.indexOf('below')
    expect(aboveIdx).toBeLessThan(hrIdx)
    expect(hrIdx).toBeLessThan(belowIdx)
  })

  test('content with multiple <hr> elements is preserved', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(
        '<p>section 1</p><hr /><p>section 2</p><hr /><p>section 3</p>',
      )
    })
    const content = await rcePage.getContent()
    const hrCount = (content.match(/<hr/g) ?? []).length
    expect(hrCount).toBe(2)
    expect(content).toContain('section 1')
    expect(content).toContain('section 3')
  })

  test('<hr> is not stripped by XSS sanitization', async ({page, rcePage}) => {
    // <hr> is a safe element and must survive the sanitization pipeline
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.insertContent('<hr />')
    })
    const content = await rcePage.getContent()
    expect(content).toMatch(/<hr/)
  })
})
