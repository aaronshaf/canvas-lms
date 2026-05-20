import {test, expect} from '../../fixtures/test'

// Non-JavaScript script types are sometimes used to embed data:
// - type="application/json" or type="application/ld+json" (structured data)
// - type="text/template" (client-side templating)
// These don't execute as JavaScript but can contain payloads that activate
// if parsed. TinyMCE should strip all <script> tags regardless of type.
test.describe('<script> elements with non-JavaScript type attributes', () => {
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

  test('script type="application/json" is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<script type="application/json">{"key": "value"}</script><p>Content after</p>',
    )
    expect(content).not.toContain('<script')
    expect(content).toContain('Content after')
  })

  test('script type="application/ld+json" is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<script type="application/ld+json">{"@type":"Course","name":"Canvas 101"}</script><p>Course description.</p>',
    )
    expect(content).not.toContain('<script')
    expect(content).toContain('Course description')
  })

  test('script type="text/template" is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<script type="text/template" id="tmpl"><div>{{name}}</div></script><p>Template content below.</p>',
    )
    expect(content).not.toContain('<script')
    expect(content).toContain('Template content below')
  })

  test('script type="text/x-handlebars-template" is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<script type="text/x-handlebars-template">{{#each items}}<li>{{name}}</li>{{/each}}</script><p>List above.</p>',
    )
    expect(content).not.toContain('<script')
    expect(content).toContain('List above')
  })
})
