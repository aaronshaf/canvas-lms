import {test, expect} from '../../fixtures/test'

// HTML comments (<!-- -->) appear in course content from pasted Word docs,
// LTI tool output, and legacy Canvas exports. TinyMCE has specific comment
// handling — some are stripped, some preserved as inert text. Tests here
// document the actual round-trip behavior so a refactor can verify it didn't change.
test.describe('HTML comments in content', () => {
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

  test('text around comments is preserved regardless of comment handling', async ({page}) => {
    const content = await setAndGet(page, '<p>Before<!-- a comment -->After</p>')
    expect(content).toContain('Before')
    expect(content).toContain('After')
  })

  test('comment between block elements does not corrupt surrounding content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>First paragraph</p><!-- divider comment --><p>Second paragraph</p>',
    )
    expect(content).toContain('First paragraph')
    expect(content).toContain('Second paragraph')
  })

  test('comment-wrapped script does not produce executable script tag', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>text</p><!--<script>alert(document.cookie)</script>--><p>more</p>',
    )
    // TinyMCE preserves the comment verbatim — alert() may appear inside it.
    // What must NOT happen: a bare <script> tag outside of HTML comments.
    const withoutComments = content.replace(/<!--[\s\S]*?-->/g, '')
    expect(withoutComments).not.toContain('<script>')
    expect(withoutComments).not.toContain('alert(')
    expect(content).toContain('text')
    expect(content).toContain('more')
  })

  test('IE conditional comments do not crash the editor', async ({page}) => {
    const content = await setAndGet(page, '<p>main</p><!--[if IE]><p>IE-only</p><![endif]-->')
    expect(content).toContain('main')
    // IE conditional comment content handling is TinyMCE version-specific
    expect(typeof content).toBe('string')
  })

  test('content after a comment block is not truncated', async ({page}) => {
    const content = await setAndGet(
      page,
      '<!-- header comment --><h2>Title</h2><p>Body text that must survive.</p><!-- footer -->',
    )
    expect(content).toContain('Title')
    expect(content).toContain('Body text that must survive')
  })

  test('multiple comments scattered through content all preserve surrounding text', async ({
    page,
  }) => {
    const content = await setAndGet(
      page,
      `<p>One</p><!-- c1 --><p>Two</p><!-- c2 --><p>Three</p><!-- c3 -->`,
    )
    expect(content).toContain('One')
    expect(content).toContain('Two')
    expect(content).toContain('Three')
  })
})
