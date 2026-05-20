import {test, expect} from '../../fixtures/test'

// Modern image loading attributes optimize page performance:
// loading="lazy" defers off-screen images, decoding="async" prevents blocking
// main thread, fetchpriority="high" prioritizes LCP images.
// These appear in course content imported from modern websites and must
// survive round-trips for the browser's loading optimization to work.
test.describe('image loading, decoding, and fetchpriority attributes', () => {
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

  test('loading="lazy" on img — alt text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Below the fold image:</p><img src="chart.png" alt="Performance chart" loading="lazy" width="600" height="400">',
    )
    expect(content).toContain('Performance chart')
    expect(content).toContain('Below the fold image')
  })

  test('loading="eager" on img — alt text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<img src="hero.jpg" alt="Hero banner image" loading="eager" width="1200" height="400">',
    )
    expect(content).toContain('Hero banner image')
  })

  test('decoding="async" on img — alt text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<img src="diagram.svg" alt="Architecture diagram" decoding="async">',
    )
    expect(content).toContain('Architecture diagram')
  })

  test('decoding="sync" on img — alt text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<img src="critical.png" alt="Critical inline image" decoding="sync">',
    )
    expect(content).toContain('Critical inline image')
  })

  test('fetchpriority="high" on LCP img — alt text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<img src="above-fold.jpg" alt="Above fold course banner" fetchpriority="high" width="800">',
    )
    expect(content).toContain('Above fold course banner')
  })

  test('combined lazy + async + data-src — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Gallery images:</p><img data-src="lazy1.jpg" src="placeholder.gif" alt="Gallery image one" loading="lazy" decoding="async"><img data-src="lazy2.jpg" src="placeholder.gif" alt="Gallery image two" loading="lazy">',
    )
    expect(content).toContain('Gallery images')
    expect(content).toContain('Gallery image one')
    expect(content).toContain('Gallery image two')
  })
})
