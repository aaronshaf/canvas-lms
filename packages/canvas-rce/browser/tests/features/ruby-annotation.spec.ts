import {test, expect} from '../../fixtures/test'

// <ruby>, <rt>, and <rp> provide phonetic annotations for CJK characters.
// They are essential for Japanese and Chinese language courses where students
// need reading guides (furigana) above kanji. canvas-rce must preserve the
// base text at minimum; loss of ruby markup would break language courses.
test.describe('<ruby> phonetic annotation elements', () => {
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

  test('kanji base text in <ruby> is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p><ruby>日本語<rt>にほんご</rt></ruby></p>')
    // base text must survive even if ruby markup is stripped
    expect(content).toContain('日本語')
  })

  test('<rt> phonetic text is preserved or base text survives', async ({page}) => {
    const content = await setAndGet(page, '<p><ruby>漢字<rt>かんじ</rt></ruby>の勉強</p>')
    expect(content).toContain('漢字')
    expect(content).toContain('勉強')
  })

  test('<rp> fallback parentheses — base text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><ruby>東京<rp>(</rp><rt>とうきょう</rt><rp>)</rp></ruby></p>',
    )
    expect(content).toContain('東京')
  })

  test('multiple ruby elements in a sentence — all base text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><ruby>私<rt>わたし</rt></ruby>は<ruby>学生<rt>がくせい</rt></ruby>です。</p>',
    )
    expect(content).toContain('私')
    expect(content).toContain('学生')
  })

  test('ruby annotation alongside Latin text', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>The word <ruby>水<rt>みず</rt></ruby> means water in Japanese.</p>',
    )
    expect(content).toContain('water in Japanese')
  })
})
