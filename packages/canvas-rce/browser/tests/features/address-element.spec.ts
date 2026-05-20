import {test, expect} from '../../fixtures/test'

// <address> is a semantic element for contact information related to the
// nearest article or the whole document. In course content it marks
// instructor contact info, institution addresses, or course correspondence.
// canvas-rce must preserve its text through round-trips.
test.describe('<address> element for contact information', () => {
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

  test('<address> text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<address>Professor Jane Smith<br />Department of Computer Science<br />office@university.edu</address>',
    )
    expect(content).toContain('Professor Jane Smith')
    expect(content).toContain('office@university.edu')
  })

  test('<address> with a mailto link is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<address>Contact: <a href="mailto:instructor@example.edu">instructor@example.edu</a></address>',
    )
    expect(content).toContain('Contact')
    expect(content).toContain('instructor@example.edu')
  })

  test('<address> inside an article element — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<article><p>Course description here.</p><address>Written by Dr. Adams</address></article>',
    )
    expect(content).toContain('Course description here')
    expect(content).toContain('Written by Dr. Adams')
  })

  test('<address> with formatted content — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<address><strong>Office Hours:</strong> Mon/Wed 2-4pm<br /><em>Room 204</em></address>',
    )
    expect(content).toContain('Office Hours')
    expect(content).toContain('Mon/Wed 2-4pm')
    expect(content).toContain('Room 204')
  })

  test('multiple <address> blocks all preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<address>Main campus: 100 University Ave</address><address>Satellite: 200 College Rd</address>',
    )
    expect(content).toContain('100 University Ave')
    expect(content).toContain('200 College Rd')
  })
})
