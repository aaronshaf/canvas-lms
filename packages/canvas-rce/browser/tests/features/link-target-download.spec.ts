import {test, expect} from '../../fixtures/test'

// Link target and download attributes control navigation behavior.
// target="_blank" opens in new tab; download triggers file download.
// Canvas course links often use target="_blank" so students don't lose
// their place. download is used for handout files. Both must be preserved.
test.describe('link target and download attributes', () => {
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

  test('target="_blank" link text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="https://example.com" target="_blank">Open in new tab</a></p>',
    )
    expect(content).toContain('Open in new tab')
  })

  test('target="_self" link text is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p><a href="/page" target="_self">Same tab link</a></p>')
    expect(content).toContain('Same tab link')
  })

  test('download attribute link text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="/files/handout.pdf" download="handout.pdf">Download handout</a></p>',
    )
    expect(content).toContain('Download handout')
  })

  test('download attribute without filename — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="/files/resource.pdf" download>Get resource</a></p>',
    )
    expect(content).toContain('Get resource')
  })

  test('link with both target and rel preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">External link</a></p>',
    )
    expect(content).toContain('External link')
  })

  test('multiple links with different targets all preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="/internal" target="_self">Internal</a> and <a href="https://ext.com" target="_blank">External</a></p>',
    )
    expect(content).toContain('Internal')
    expect(content).toContain('External')
  })

  test('link inside a list with target="_blank" — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li><a href="https://resource.edu" target="_blank">Resource 1</a></li><li><a href="https://resource2.edu" target="_blank">Resource 2</a></li></ul>',
    )
    expect(content).toContain('Resource 1')
    expect(content).toContain('Resource 2')
  })
})
