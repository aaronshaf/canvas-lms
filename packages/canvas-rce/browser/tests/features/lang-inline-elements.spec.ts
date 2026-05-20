import {test, expect} from '../../fixtures/test'

// The `lang` attribute on inline elements identifies language switches within
// a sentence — essential for multilingual course content (bilingual glossaries,
// foreign language examples, code with comments in different languages).
// Screen readers use `lang` to switch pronunciation engines mid-sentence.
test.describe('lang attribute on inline elements', () => {
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

  test('lang on <span> for foreign phrase — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>The French say <span lang="fr">bonjour</span> for hello.</p>',
    )
    expect(content).toContain('bonjour')
    expect(content).toContain('for hello')
  })

  test('lang on <strong> — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>In Spanish: <strong lang="es">hola</strong>, in German: <strong lang="de">hallo</strong>.</p>',
    )
    expect(content).toContain('hola')
    expect(content).toContain('hallo')
  })

  test('lang on <em> — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>The Italian term <em lang="it">dolce vita</em> means sweet life.</p>',
    )
    expect(content).toContain('dolce vita')
    expect(content).toContain('sweet life')
  })

  test('lang on <code> for different language sample — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Japanese comment: <code lang="ja">// コメント</code></p>',
    )
    // Japanese may be entity-encoded but surrounding text preserved
    expect(content).toContain('Japanese comment')
  })

  test('nested lang attributes — outer text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p lang="en">English with <span lang="ar">Arabic phrase</span> embedded.</p>',
    )
    expect(content).toContain('English with')
    expect(content).toContain('embedded')
  })

  test('lang on paragraph — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p lang="zh-CN">这是中文段落。</p><p>This is English.</p>',
    )
    // Chinese may be entity-encoded but English paragraph must be preserved
    expect(content).toContain('This is English')
  })
})
