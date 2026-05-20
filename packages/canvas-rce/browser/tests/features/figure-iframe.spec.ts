import {test, expect} from '../../fixtures/test'

// <figure> wrapping an <iframe> is a pattern for embedded videos with captions
// (YouTube embeds, Canvas media comments, Vimeo). The figcaption text provides
// a description for accessibility. Both the caption text and surrounding
// content must survive the editor round-trip.
test.describe('<figure> wrapping <iframe> embeds', () => {
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

  test('<figcaption> inside figure with iframe — caption preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<figure><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Lecture video" width="560" height="315"></iframe><figcaption>Video: Introduction to Algorithms</figcaption></figure>',
    )
    expect(content).toContain('Introduction to Algorithms')
  })

  test('text before and after figure/iframe — all preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Watch this lecture:</p><figure><iframe src="https://canvas.example.com/media/123" title="Canvas media" width="400" height="300"></iframe><figcaption>Lecture 1</figcaption></figure><p>Discussion follows.</p>',
    )
    expect(content).toContain('Watch this lecture')
    expect(content).toContain('Lecture 1')
    expect(content).toContain('Discussion follows')
  })

  test('multiple figure/iframe blocks — all captions preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<figure><iframe src="https://example.com/v1" title="video 1"></iframe><figcaption>Video 1: Topic A</figcaption></figure><figure><iframe src="https://example.com/v2" title="video 2"></iframe><figcaption>Video 2: Topic B</figcaption></figure>',
    )
    expect(content).toContain('Topic A')
    expect(content).toContain('Topic B')
  })

  test('<figure> with iframe and no caption — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Embed:</p><figure><iframe src="https://example.com/embed" title="embed" width="640" height="360"></iframe></figure><p>Notes here.</p>',
    )
    expect(content).toContain('Embed')
    expect(content).toContain('Notes here')
  })
})
