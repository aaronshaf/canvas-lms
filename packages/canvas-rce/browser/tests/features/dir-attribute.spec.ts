import {test, expect} from '../../fixtures/test'

// The dir attribute specifies text directionality: ltr (left-to-right) or
// rtl (right-to-left). Mixed-direction content (e.g. Arabic quotes inside
// an English paragraph) requires dir on inline spans to render correctly.
// canvas-rce must preserve dir attributes — especially for multilingual courses.
test.describe('dir attribute for text directionality', () => {
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

  test('dir="rtl" on a paragraph — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p dir="rtl">هذه جملة باللغة العربية</p>')
    expect(content).toContain('هذه جملة')
  })

  test('dir="ltr" on an inline span inside rtl context — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p dir="rtl">نص عربي <span dir="ltr">English text</span> عربي</p>',
    )
    expect(content).toContain('English text')
  })

  test('dir="rtl" on a blockquote — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<blockquote dir="rtl"><p>اقتباس باللغة العربية</p></blockquote>',
    )
    expect(content).toContain('اقتباس')
  })

  test('dir="auto" on a paragraph — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p dir="auto">Content with automatic direction</p>')
    expect(content).toContain('Content with automatic direction')
  })

  test('dir="rtl" on a list — all items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul dir="rtl"><li>العنصر الأول</li><li>العنصر الثاني</li></ul>',
    )
    expect(content).toContain('العنصر الأول')
    expect(content).toContain('العنصر الثاني')
  })

  test('mixed ltr and rtl spans in same paragraph', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>The Arabic for hello is <span dir="rtl" lang="ar">مرحبا</span> and goodbye is <span dir="rtl" lang="ar">وداعا</span>.</p>',
    )
    expect(content).toContain('مرحبا')
    expect(content).toContain('وداعا')
    expect(content).toContain('The Arabic for hello')
  })
})
