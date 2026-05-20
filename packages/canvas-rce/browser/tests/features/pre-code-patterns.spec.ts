import {test, expect} from '../../fixtures/test'

// <pre><code> is the standard HTML pattern for code blocks. The outer <pre>
// preserves whitespace; the inner <code> marks it as code.
// language-* classes (from Prism, highlight.js) indicate the syntax language.
// Canvas CS courses and tutorials use this pattern extensively.
test.describe('<pre><code> code block patterns', () => {
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

  test('<pre><code> block preserves code text', async ({page}) => {
    const content = await setAndGet(
      page,
      '<pre><code>function hello() {\n  return "world";\n}</code></pre>',
    )
    expect(content).toContain('function hello')
    expect(content).toContain('return')
    expect(content).toContain('world')
  })

  test('language class on <code> is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<pre><code class="language-python">def greet(name):\n    return f"Hello {name}"</code></pre>',
    )
    expect(content).toContain('def greet')
    expect(content).toContain('Hello')
  })

  test('language class on <pre> is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<pre class="language-javascript"><code>const x = 42;</code></pre>',
    )
    expect(content).toContain('const x = 42')
  })

  test('<pre><code> with special characters preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<pre><code>if (a &lt; b &amp;&amp; c &gt; 0) { doSomething(); }</code></pre>',
    )
    expect(content).toContain('doSomething')
  })

  test('paragraph before and after code block all preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Example code:</p><pre><code>print("Hello World")</code></pre><p>End of example.</p>',
    )
    expect(content).toContain('Example code')
    expect(content).toContain('Hello World')
    expect(content).toContain('End of example')
  })

  test('<pre><code> with inline comments preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<pre><code>// Calculate sum\nlet sum = a + b; // result</code></pre>',
    )
    expect(content).toContain('Calculate sum')
    expect(content).toContain('let sum')
  })

  test('multiple code blocks in sequence all preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<pre><code>Block one code</code></pre><pre><code>Block two code</code></pre>',
    )
    expect(content).toContain('Block one code')
    expect(content).toContain('Block two code')
  })
})
