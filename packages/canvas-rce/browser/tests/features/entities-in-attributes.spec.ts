import {test, expect} from '../../fixtures/test'

// HTML entities in attribute values are a common source of encoding bugs.
// title="A &amp; B", alt="&lt;diagram&gt;", href="?q=a&amp;b=c" all use
// entity encoding to embed special characters. TinyMCE must not double-encode
// or corrupt these values — tests check that text content relying on these
// attributes survives round-trips correctly.
test.describe('HTML entities in attribute values', () => {
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

  test('alt attribute with &lt; and &gt; — image survives', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><img src="diagram.png" alt="Value &lt;10&gt;" />After image</p>',
    )
    expect(content).toContain('After image')
    expect(content).toContain('alt')
  })

  test('title attribute with &amp; — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p><span title="Rock &amp; Roll">Music genre</span></p>')
    expect(content).toContain('Music genre')
  })

  test('href with &amp; query string — link text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="https://example.com/search?q=a&amp;lang=en">Search link</a></p>',
    )
    expect(content).toContain('Search link')
  })

  test('data attribute with entity-encoded JSON — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span data-info="{&quot;key&quot;:&quot;value&quot;}">Tagged span</span></p>',
    )
    expect(content).toContain('Tagged span')
  })

  test('aria-label with &amp; — accessible text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><button aria-label="Save &amp; Continue">Save</button></p>',
    )
    expect(content).toContain('Save')
  })

  test('class attribute is not entity-encoded — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span class="highlight primary">Highlighted text</span></p>',
    )
    expect(content).toContain('Highlighted text')
  })
})
