import {test, expect} from '../../fixtures/test'

// autoplay and loop on <video> and <audio> create a poor user experience:
// videos that start playing immediately are disruptive in a course context.
// Canvas should strip or warn about autoplay; TinyMCE may preserve the attribute.
// Tests document actual behavior — surrounding text must always be preserved.
test.describe('<video> and <audio> autoplay and loop attributes', () => {
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

  test('text around video with autoplay is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Lecture video:</p><video src="lecture.mp4" autoplay controls></video><p>Discussion follows.</p>',
    )
    expect(content).toContain('Lecture video')
    expect(content).toContain('Discussion follows')
  })

  test('text around video with loop is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Looping animation:</p><video src="animation.mp4" loop muted></video><p>See notes.</p>',
    )
    expect(content).toContain('Looping animation')
    expect(content).toContain('See notes')
  })

  test('text around audio with autoplay is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Background audio:</p><audio src="ambient.mp3" autoplay loop></audio><p>Content continues.</p>',
    )
    expect(content).toContain('Background audio')
    expect(content).toContain('Content continues')
  })

  test('video with preload attribute — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Preloaded video:</p><video src="video.mp4" preload="auto" controls></video><p>After video.</p>',
    )
    expect(content).toContain('Preloaded video')
    expect(content).toContain('After video')
  })

  test('video with crossorigin attribute — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Cross-origin video:</p><video src="https://cdn.example.com/v.mp4" crossorigin="anonymous" controls></video><p>End.</p>',
    )
    expect(content).toContain('Cross-origin video')
    expect(content).toContain('End')
  })
})
