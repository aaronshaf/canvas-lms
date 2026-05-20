import {test, expect} from '../../fixtures/test'

// Footnotes use a pattern of <sup> with an anchor link in the body and a
// matching <li id="fn-1"> at the bottom. Canvas course pages use this for
// citations, endnotes, and legal disclaimers. The link/id/sup chain must
// survive round-trips for in-page navigation to work.
test.describe('footnote pattern with superscript anchor links', () => {
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

  test('footnote marker in body text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Darwin proposed natural selection<sup><a href="#fn-1" id="fnref-1">[1]</a></sup> in 1859.</p>',
    )
    expect(content).toContain('Darwin proposed natural selection')
    expect(content).toContain('1859')
    expect(content).toContain('[1]')
  })

  test('footnote list at bottom is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol class="footnotes"><li id="fn-1"><p>Darwin, C. (1859). <em>On the Origin of Species</em>. <a href="#fnref-1">↩</a></p></li></ol>',
    )
    expect(content).toContain('Darwin')
    expect(content).toContain('On the Origin of Species')
  })

  test('body with footnote marker plus footnote list — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>The study found significant results<sup><a href="#fn-1">[1]</a></sup>.</p><hr /><ol><li id="fn-1">Smith et al., 2023, p. 42.</li></ol>',
    )
    expect(content).toContain('significant results')
    expect(content).toContain('[1]')
    expect(content).toContain('Smith et al., 2023')
  })

  test('multiple footnote markers in one paragraph', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Concept A<sup><a href="#fn-1">[1]</a></sup> builds on concept B<sup><a href="#fn-2">[2]</a></sup>.</p>',
    )
    expect(content).toContain('Concept A')
    expect(content).toContain('builds on concept B')
    expect(content).toContain('[1]')
    expect(content).toContain('[2]')
  })
})
