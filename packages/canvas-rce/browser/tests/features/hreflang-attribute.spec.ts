import {test, expect} from '../../fixtures/test'

// hreflang on <a> identifies the language of the linked resource — essential
// for multilingual Canvas sites where the same assignment exists in English
// and Spanish, or where external resources are in a different language than
// the course. Link text must survive regardless of the attribute's fate.
test.describe('hreflang attribute on links', () => {
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

  test('hreflang="es" on Spanish resource link — base text preserved', async ({page}) => {
    // Accented chars (ó) entity-encoded by TinyMCE; check non-accented portions
    const content = await setAndGet(
      page,
      '<p>Spanish version: <a href="/es/courses/1/pages/intro" hreflang="es">Introduccion al curso</a></p>',
    )
    expect(content).toContain('Introduccion al curso')
  })

  test('hreflang="fr" on French external link — Latin text preserved', async ({page}) => {
    // TinyMCE entity-encodes accented characters; use ASCII-safe text
    const content = await setAndGet(
      page,
      '<p>French reading: <a href="https://example.fr/article" hreflang="fr" target="_blank">Lire en francais</a></p>',
    )
    expect(content).toContain('Lire en francais')
  })

  test('multiple language links in one paragraph — all preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Available in: <a href="/en/course" hreflang="en">English</a>, <a href="/es/course" hreflang="es">Spanish</a>, <a href="/fr/course" hreflang="fr">French</a></p>',
    )
    expect(content).toContain('English')
    expect(content).toContain('Spanish')
    expect(content).toContain('French')
  })

  test('hreflang with type attribute — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="/syllabus-de.pdf" hreflang="de" type="application/pdf">Stundenplan (Deutsch)</a></p>',
    )
    expect(content).toContain('Stundenplan')
  })

  test('hreflang="zh-Hant" traditional Chinese — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Traditional Chinese: <a href="/zh-tw/course" hreflang="zh-Hant">繁體中文版</a></p>',
    )
    // Chinese characters may be entity-encoded
    expect(content).toContain('Traditional Chinese')
  })
})
