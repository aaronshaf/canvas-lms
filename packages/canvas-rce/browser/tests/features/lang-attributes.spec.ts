import {test, expect} from '../../fixtures/test'

// The lang attribute on HTML elements is required for proper screen reader
// pronunciation — a screen reader uses lang to switch language voice.
// WCAG 3.1.2 (Language of Parts) requires lang on inline content in a different
// language. canvas-rce must preserve lang attributes through serialization.
test.describe('lang attribute on content elements', () => {
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

  test('lang attribute on span for inline foreign language', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>The French word <span lang="fr">bonjour</span> means hello.</p>',
    )
    expect(content).toContain('bonjour')
    expect(content).toContain('means hello')
  })

  test('lang attribute on paragraph is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p lang="es">Esta es una oración en español.</p>')
    expect(content).toContain('Esta es una')
  })

  test('lang attribute on blockquote for foreign quotation', async ({page}) => {
    const content = await setAndGet(
      page,
      '<blockquote lang="de"><p>Das ist ein deutsches Zitat.</p></blockquote>',
    )
    expect(content).toContain('deutsches Zitat')
  })

  test('lang="zh" on span with Chinese text', async ({page}) => {
    const content = await setAndGet(page, '<p>Translation: <span lang="zh">你好世界</span></p>')
    expect(content).toContain('你好世界')
    expect(content).toContain('Translation')
  })

  test('lang="ar" on span with Arabic text', async ({page}) => {
    const content = await setAndGet(page, '<p>Arabic: <span lang="ar" dir="rtl">مرحبا</span></p>')
    expect(content).toContain('مرحبا')
    expect(content).toContain('Arabic')
  })

  test('multiple lang spans in same paragraph all preserve text', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>English, <span lang="fr">français</span>, <span lang="de">Deutsch</span>, <span lang="ja">日本語</span>.</p>',
    )
    // TinyMCE may entity-encode accented chars: ç → &ccedil;
    expect(content).toMatch(/fran(ç|&ccedil;)ais/)
    expect(content).toContain('Deutsch')
    expect(content).toContain('日本語')
  })

  test('lang on heading is preserved', async ({page}) => {
    const content = await setAndGet(page, '<h2 lang="fr">Titre du cours</h2>')
    expect(content).toContain('Titre du cours')
    expect(content).toMatch(/<h2/)
  })
})
