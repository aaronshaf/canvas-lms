import {test, expect} from '../../fixtures/test'

// <hr> (horizontal rule) is a thematic break element used to separate content
// sections. It can appear after headings, between paragraphs, and inside
// containers. Tests verify that text above and below <hr> always survives
// and that <hr> itself doesn't corrupt surrounding content structure.
test.describe('<hr> horizontal rule in various contexts', () => {
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

  test('<hr> between two paragraphs — both preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>First section content.</p><hr /><p>Second section content.</p>',
    )
    expect(content).toContain('First section content')
    expect(content).toContain('Second section content')
  })

  test('<hr> after a heading — heading and following text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<h2>Chapter Title</h2><hr /><p>Chapter introduction text.</p>',
    )
    expect(content).toContain('Chapter Title')
    expect(content).toContain('Chapter introduction text')
  })

  test('multiple <hr> elements divide sections — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Section A</p><hr /><p>Section B</p><hr /><p>Section C</p>',
    )
    expect(content).toContain('Section A')
    expect(content).toContain('Section B')
    expect(content).toContain('Section C')
  })

  test('<hr> inside a blockquote — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<blockquote><p>First quote part.</p><hr /><p>Second quote part.</p></blockquote>',
    )
    expect(content).toContain('First quote part')
    expect(content).toContain('Second quote part')
  })

  test('<hr> with style attribute — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Above</p><hr style="border-top: 2px solid navy;" /><p>Below</p>',
    )
    expect(content).toContain('Above')
    expect(content).toContain('Below')
  })

  test('<hr> at the very start of content — following text preserved', async ({page}) => {
    const content = await setAndGet(page, '<hr /><p>Text after leading rule.</p>')
    expect(content).toContain('Text after leading rule')
  })
})
