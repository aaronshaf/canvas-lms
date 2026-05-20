import {test, expect} from '../../fixtures/test'

// XML processing instructions (<?xml ... ?>) and CDATA sections can appear
// in content from XML-based editors, LMS exports, and SCORM packages.
// They are not valid in HTML and should not crash the editor; surrounding
// content must survive.
test.describe('XML processing instructions and CDATA in content', () => {
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

  test('XML declaration before content — body text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<?xml version="1.0" encoding="UTF-8"?><p>Content after XML declaration</p>',
    )
    expect(content).toContain('Content after XML declaration')
  })

  test('XML processing instruction between paragraphs — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before PI.</p><?custom-instruction data="value"?><p>After PI.</p>',
    )
    expect(content).toContain('Before PI')
    expect(content).toContain('After PI')
  })

  test('CDATA section — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before CDATA.</p><![CDATA[raw data here & <not-escaped>]]><p>After CDATA.</p>',
    )
    expect(content).toContain('Before CDATA')
    expect(content).toContain('After CDATA')
  })

  test('doctype declaration in body — content text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN"><p>Post-doctype content</p>',
    )
    expect(content).toContain('Post-doctype content')
    expect(typeof content).toBe('string')
  })
})
