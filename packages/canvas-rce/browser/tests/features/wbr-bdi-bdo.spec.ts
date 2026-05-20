import {test, expect} from '../../fixtures/test'

// Typographic and bidirectional control elements:
// - <wbr>: word break opportunity — a hint to break a long word at this point
// - <bdi>: bidirectional isolation — isolates text whose direction is unknown
// - <bdo>: bidirectional override — forces a specific text direction
// These appear in multilingual courses and formatted technical content.
test.describe('<wbr>, <bdi>, and <bdo> elements', () => {
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

  test('<wbr> in a long URL — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Visit: https://www.university.edu/<wbr>courses/<wbr>advanced-topics</p>',
    )
    expect(content).toContain('courses')
    expect(content).toContain('advanced-topics')
  })

  test('<bdi> isolates username text — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>Posted by: <bdi>أحمد</bdi> (Ahmed)</p>')
    expect(content).toContain('أحمد')
    expect(content).toContain('Ahmed')
  })

  test('<bdo dir="rtl"> reverses text direction — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>Reversed: <bdo dir="rtl">ABCDE</bdo></p>')
    expect(content).toContain('ABCDE')
    expect(content).toContain('Reversed')
  })

  test('<bdo dir="ltr"> forces ltr in rtl context — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p dir="rtl">النص: <bdo dir="ltr">LTR text forced</bdo></p>',
    )
    expect(content).toContain('النص')
    expect(content).toContain('LTR text forced')
  })

  test('multiple <bdi> spans in a leaderboard — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol><li><bdi>Alice</bdi>: 95</li><li><bdi>محمد</bdi>: 92</li><li><bdi>田中</bdi>: 88</li></ol>',
    )
    expect(content).toContain('Alice')
    expect(content).toContain('محمد')
    expect(content).toContain('田中')
  })
})
