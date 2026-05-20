import {test, expect} from '../../fixtures/test'

// color-scheme declares which color modes an element supports (light/dark/both).
// Canvas themes support dark mode through this property; embedded content that
// declares color-scheme can opt in or out of the system palette. The text
// content must survive regardless of how TinyMCE handles the declaration.
test.describe('CSS color-scheme and prefers-color-scheme patterns', () => {
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

  test('color-scheme: light on article — content preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<article style="color-scheme: light;"><h2>Light Mode Content</h2><p>This content is optimized for light backgrounds and will not invert in dark mode.</p></article>',
    )
    expect(content).toContain('Light Mode Content')
    expect(content).toContain('light backgrounds')
  })

  test('color-scheme: dark on code block — code text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<pre style="color-scheme: dark; background: #1e1e1e; color: #d4d4d4;"><code>const greeting = "Hello, World!";\nconsole.log(greeting);</code></pre>',
    )
    expect(content).toContain('greeting')
    expect(content).toContain('Hello, World')
  })

  test('color-scheme: light dark on container — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="color-scheme: light dark;"><p>This container adapts to the user\'s system color preference automatically.</p></div>',
    )
    expect(content).toContain('system color preference')
  })

  test('forced-colors: active fallback styles — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="forced-color-adjust: none; color: #0770a3;">This text maintains its brand color even in Windows High Contrast mode.</p>',
    )
    expect(content).toContain('Windows High Contrast mode')
  })

  test('color-scheme on table — table data preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table style="color-scheme: light;"><caption>Dark-mode resistant grade table</caption><tr><th>Student</th><th>Grade</th></tr><tr><td>Alice Johnson</td><td>A</td></tr></table>',
    )
    expect(content).toContain('Dark-mode resistant')
    expect(content).toContain('Alice Johnson')
  })
})
