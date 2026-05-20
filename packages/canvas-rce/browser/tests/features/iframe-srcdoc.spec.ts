import {test, expect} from '../../fixtures/test'

// The srcdoc attribute embeds a full HTML document directly inside an iframe.
// It is an XSS vector: <iframe srcdoc="<script>alert(1)</script>"> executes
// immediately. TinyMCE must strip srcdoc or the entire iframe when present.
// Surrounding content must always survive.
test.describe('<iframe srcdoc> security — must be stripped or sanitized', () => {
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

  test('srcdoc with script — script not present in output', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before.</p><iframe srcdoc="<script>alert(1)</script>"></iframe><p>After.</p>',
    )
    expect(content).toContain('Before')
    expect(content).toContain('After')
    expect(content).not.toContain('<script>')
    expect(content).not.toContain('alert(1)')
  })

  test('srcdoc with onclick handler — handler stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Safe text.</p><iframe srcdoc="<div onclick=\'evil()\'>click</div>"></iframe><p>More text.</p>',
    )
    expect(content).not.toContain('evil()')
    expect(content).toContain('Safe text')
    expect(content).toContain('More text')
  })

  test('iframe with srcdoc and src — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Start.</p><iframe src="https://example.com" srcdoc="<p>inline</p>"></iframe><p>End.</p>',
    )
    expect(content).toContain('Start')
    expect(content).toContain('End')
    expect(content).not.toContain('srcdoc')
  })

  test('multiple iframes with srcdoc — no script leaks', async ({page}) => {
    const content = await setAndGet(
      page,
      '<iframe srcdoc="<script>a()</script>"></iframe><p>Content</p><iframe srcdoc="<script>b()</script>"></iframe>',
    )
    expect(content).not.toContain('<script>')
    expect(content).toContain('Content')
  })
})
