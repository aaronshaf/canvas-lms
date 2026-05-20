import {test, expect} from '../../fixtures/test'

// Canvas course pages embed media via iframes: YouTube videos, Canvas Studio,
// Google Docs, and LTI tools. The embed pattern is a <div class="..."> wrapper
// containing an <iframe> with specific src/allow/allowfullscreen attributes.
// Text around and inside these embeds must survive round-trips.
test.describe('Canvas media embed iframe patterns', () => {
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

  test('YouTube embed iframe — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Watch this lecture:</p><div class="media-embed"><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" allow="accelerometer; autoplay" allowfullscreen width="560" height="315"></iframe></div><p>Discussion follows.</p>',
    )
    expect(content).toContain('Watch this lecture')
    expect(content).toContain('Discussion follows')
  })

  test('Canvas Studio embed — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Instructor video:</p><iframe src="https://canvas.instructure.com/media_objects_iframe/m-abc123" allowfullscreen width="640" height="400" data-media-id="m-abc123"></iframe>',
    )
    expect(content).toContain('Instructor video')
  })

  test('Google Docs embed iframe — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Shared document:</p><iframe src="https://docs.google.com/document/d/abc123/preview" width="800" height="600"></iframe><p>See doc above.</p>',
    )
    expect(content).toContain('Shared document')
    expect(content).toContain('See doc above')
  })

  test('Canvas external tool iframe — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Interactive activity:</p><iframe src="/courses/1/external_tools/retrieve?url=https%3A%2F%2Ftool.example.com" class="tool_launch" width="100%" height="500"></iframe>',
    )
    expect(content).toContain('Interactive activity')
  })

  test('multiple iframes in sequence — all surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Video 1:</p><iframe src="https://www.youtube.com/embed/video1" width="560" height="315"></iframe><p>Video 2:</p><iframe src="https://www.youtube.com/embed/video2" width="560" height="315"></iframe>',
    )
    expect(content).toContain('Video 1')
    expect(content).toContain('Video 2')
  })

  test('responsive iframe wrapper — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Embedded resource:</p><div style="position:relative; padding-bottom:56.25%;"><iframe style="position:absolute; width:100%; height:100%;" src="https://player.vimeo.com/video/123456"></iframe></div>',
    )
    expect(content).toContain('Embedded resource')
  })
})
