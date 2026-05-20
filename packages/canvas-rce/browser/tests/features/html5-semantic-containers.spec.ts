import {test, expect} from '../../fixtures/test'

// HTML5 semantic container elements (article, section, aside, nav, time, address)
// appear in content pasted from modern web pages and CMS exports into Canvas.
// TinyMCE may preserve them, convert them to divs, or strip them — all outcomes
// are documented here so a refactor can detect behavior changes.
test.describe('HTML5 semantic container elements', () => {
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

  test('<article> text content is preserved regardless of element handling', async ({page}) => {
    const content = await setAndGet(
      page,
      '<article><h2>Article Title</h2><p>Article body text.</p></article>',
    )
    expect(content).toContain('Article Title')
    expect(content).toContain('Article body text')
  })

  test('<section> text content is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<section><h3>Section Heading</h3><p>Section content here.</p></section>',
    )
    expect(content).toContain('Section Heading')
    expect(content).toContain('Section content here')
  })

  test('<aside> text content is preserved', async ({page}) => {
    const content = await setAndGet(page, '<aside><p>Related information in a sidebar.</p></aside>')
    expect(content).toContain('Related information in a sidebar')
  })

  test('<address> element text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<address>Prof. Smith<br />Computer Science Dept<br />office@university.edu</address>',
    )
    expect(content).toContain('Prof. Smith')
    expect(content).toContain('Computer Science Dept')
    expect(content).toContain('office@university.edu')
  })

  test('<time> element text content is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Assignment due: <time datetime="2024-12-15">December 15, 2024</time></p>',
    )
    expect(content).toContain('December 15, 2024')
    expect(content).toContain('Assignment due')
  })

  test('<time> with datetime attribute content survives', async ({page}) => {
    const content = await setAndGet(
      page,
      '<time datetime="2024-09-01T09:00">September 1, 9:00 AM</time>',
    )
    expect(content).toContain('September 1')
  })

  test('nested semantic elements preserve all text', async ({page}) => {
    const content = await setAndGet(
      page,
      `<article>
        <section><h2>Module 1</h2><p>First module content.</p></section>
        <section><h2>Module 2</h2><p>Second module content.</p></section>
        <aside><p>Additional resources.</p></aside>
      </article>`,
    )
    expect(content).toContain('Module 1')
    expect(content).toContain('Module 2')
    expect(content).toContain('First module content')
    expect(content).toContain('Second module content')
    expect(content).toContain('Additional resources')
  })

  test('<figure> and <figcaption> text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<figure><img src="https://example.com/chart.png" alt="sales chart" /><figcaption>Figure 1: Q1 Sales Data</figcaption></figure>',
    )
    expect(content).toContain('Figure 1: Q1 Sales Data')
  })

  test('<main> element text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<main><h1>Main Content</h1><p>Primary page content.</p></main>',
    )
    expect(content).toContain('Main Content')
    expect(content).toContain('Primary page content')
  })
})
