import {test, expect} from '../../fixtures/test'

// <wbr> (Word Break Opportunity) hints where long strings may wrap — used for
// long URLs displayed as text, CamelCase identifiers, and compound words in
// narrow table cells. Unlike &shy; (soft hyphen), <wbr> inserts no hyphen.
// The element is void and its presence affects layout without altering text.
test.describe('<wbr> word break opportunity elements', () => {
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

  test('<wbr> in long URL — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Documentation: https://docs.example.com<wbr>/courses<wbr>/api<wbr>/v3<wbr>/endpoints</p>',
    )
    expect(content).toContain('Documentation')
    expect(content).toContain('docs.example.com')
  })

  test('<wbr> in camelCase identifier — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Use the <code>getData<wbr>From<wbr>Remote<wbr>Server()</code> method.</p>',
    )
    expect(content).toContain('getData')
    expect(content).toContain('method')
  })

  test('multiple <wbr> in narrow table cell — cell text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td>Method Name</td><td><code>process<wbr>Input<wbr>Data<wbr>Stream()</code></td></tr></table>',
    )
    expect(content).toContain('Method Name')
    expect(content).toContain('process')
    expect(content).toContain('Stream')
  })

  test('<wbr> adjacent to punctuation — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Compound<wbr>-word<wbr>-example with breaks at hyphens.</p>',
    )
    expect(content).toContain('with breaks at hyphens')
  })
})
