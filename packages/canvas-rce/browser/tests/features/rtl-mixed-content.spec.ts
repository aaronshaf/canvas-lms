import {test, expect} from '../../fixtures/test'

// Multilingual Canvas deployments mix RTL (Arabic, Hebrew) and LTR text in
// the same page. The BiDi algorithm handles display, but HTML attributes
// (dir, lang) and <bdi>/<bdo> elements must survive round-trips so that
// screen readers and browsers can apply correct directionality.
test.describe('RTL and LTR mixed-direction content', () => {
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

  test('RTL paragraph with LTR span — Latin text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p dir="rtl">Arabic context with <span dir="ltr">English term</span> embedded.</p>',
    )
    expect(content).toContain('English term')
  })

  test('<bdi> for user-generated mixed direction — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>Student name: <bdi>John Smith</bdi> — grade: A</p>')
    expect(content).toContain('John Smith')
    expect(content).toContain('grade: A')
  })

  test('LTR paragraph containing RTL span — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>English intro text <span lang="ar" dir="rtl">hello in Arabic</span> continues in English.</p>',
    )
    expect(content).toContain('English intro text')
    expect(content).toContain('continues in English')
  })

  test('alternating dir paragraphs — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p dir="ltr">First LTR paragraph.</p><p dir="rtl">Second RTL paragraph.</p><p dir="ltr">Third LTR paragraph.</p>',
    )
    expect(content).toContain('First LTR paragraph')
    expect(content).toContain('Third LTR paragraph')
  })

  test('<bdo dir="rtl"> forcing direction — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Normal text followed by <bdo dir="rtl">sdrawkcab</bdo> then normal again.</p>',
    )
    expect(content).toContain('sdrawkcab')
    expect(content).toContain('then normal again')
  })

  test('table with RTL and LTR cells — all cell text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td dir="ltr">English cell</td><td dir="rtl">RTL cell content</td></tr></table>',
    )
    expect(content).toContain('English cell')
    expect(content).toContain('RTL cell content')
  })
})
