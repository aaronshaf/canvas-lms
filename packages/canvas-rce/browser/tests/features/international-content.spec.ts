import {test, expect} from '../../fixtures/test'

// Canvas LMS serves students globally. Course content contains Chinese, Arabic,
// Hebrew, Japanese, Korean, and other non-Latin scripts. canvas-rce must
// preserve multi-byte UTF-8 characters without mangling them to entities or ?.
test.describe('international and multi-byte content', () => {
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

  test('Chinese characters are preserved verbatim', async ({page}) => {
    const content = await setAndGet(page, '<p>你好世界</p>')
    // Characters must appear as actual Unicode, not escaped entities
    expect(content).toContain('你好世界')
  })

  test('Arabic text content is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>مرحبا بالعالم</p>')
    expect(content).toContain('مرحبا')
  })

  test('Hebrew text is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>שלום עולם</p>')
    expect(content).toContain('שלום')
  })

  test('Japanese text (hiragana + kanji) is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>日本語のテキスト</p>')
    expect(content).toContain('日本語')
  })

  test('Korean Hangul text is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>안녕하세요 세계</p>')
    expect(content).toContain('안녕하세요')
  })

  test('mixed Latin and non-Latin in same paragraph is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>English text followed by Chinese: 你好 and Arabic: مرحبا</p>',
    )
    expect(content).toContain('English text')
    expect(content).toContain('你好')
    expect(content).toContain('مرحبا')
  })

  test('accented Latin characters survive serialization', async ({page}) => {
    const content = await setAndGet(page, '<p>café, naïve, résumé, über, señor, façade</p>')
    // Accept either the literal char or its HTML entity form
    expect(content).toMatch(/caf(é|&eacute;)/)
    expect(content).toMatch(/r(é|&eacute;)sum(é|&eacute;)/)
  })

  test('Cyrillic (Russian) text is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>Привет мир</p>')
    expect(content).toContain('Привет')
  })

  test('Greek text is preserved (may be entity-encoded)', async ({page}) => {
    const content = await setAndGet(page, '<p>Ελληνικά γράμματα</p>')
    // TinyMCE may entity-encode Greek chars (&Epsilon;&lambda;...) or keep as Unicode
    const hasLiteral = content.includes('Ελληνικά')
    const hasEncoded = content.includes('&Epsilon;') || content.includes('&lambda;')
    expect(hasLiteral || hasEncoded).toBe(true)
  })

  test('RTL text with dir attribute is handled', async ({page}) => {
    const content = await setAndGet(page, '<p dir="rtl">هذا نص عربي من اليمين إلى اليسار</p>')
    expect(content).toContain('هذا نص عربي')
  })

  test('Thai script content is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>สวัสดีชาวโลก</p>')
    expect(content).toContain('สวัสดี')
  })

  test('mixed CJK and formatting tags are preserved together', async ({page}) => {
    const content = await setAndGet(page, '<p><strong>重要：</strong>请阅读以下说明。</p>')
    expect(content).toContain('重要')
    expect(content).toContain('请阅读')
    expect(content).toMatch(/<strong>/)
  })
})
