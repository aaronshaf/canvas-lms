import {test, expect} from '../../fixtures/test'

// Links in course content use many protocol schemes beyond http/https:
// mailto: for email links, tel: for phone numbers, ftp: for file transfers,
// and custom schemes like canvas-student:// for deep links to the mobile app.
// All benign protocols must preserve their link text.
test.describe('href with various protocol schemes', () => {
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

  test('mailto: link text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Email <a href="mailto:instructor@university.edu">your instructor</a> for help.</p>',
    )
    expect(content).toContain('your instructor')
    expect(content).toContain('for help')
  })

  test('tel: phone link text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Call us at <a href="tel:+15551234567">555-123-4567</a>.</p>',
    )
    expect(content).toContain('555-123-4567')
  })

  test('mailto: with subject and body — link text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="mailto:support@edu.com?subject=Help&amp;body=I+need+help">Contact Support</a></p>',
    )
    expect(content).toContain('Contact Support')
  })

  test('ftp: link text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Download from <a href="ftp://files.example.edu/dataset.zip">FTP archive</a>.</p>',
    )
    expect(content).toContain('FTP archive')
    expect(content).toContain('Download from')
  })

  test('#anchor-only href — link text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Jump to <a href="#section-3">Section 3</a> below.</p>',
    )
    expect(content).toContain('Section 3')
    expect(content).toContain('below')
  })

  test('empty href — link text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p><a href="">Placeholder link</a> text.</p>')
    expect(content).toContain('Placeholder link')
    expect(content).toContain('text')
  })
})
