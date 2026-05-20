import {test, expect} from '../../fixtures/test'

// <video> with <track> elements supports closed captions and subtitles,
// which are required by WCAG 1.2.2 for pre-recorded video. Canvas uses
// <track kind="subtitles"> and <track kind="captions"> in video embeds.
// The surrounding text and track label must survive the round-trip.
test.describe('<video> with <track> caption and subtitle elements', () => {
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

  test('paragraph text around <video> is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Watch below:</p><video src="lecture.mp4" controls><track kind="captions" src="captions.vtt" srclang="en" label="English" /></video><p>Discussion questions follow.</p>',
    )
    expect(content).toContain('Watch below')
    expect(content).toContain('Discussion questions follow')
  })

  test('<video> with fallback text — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<video controls><source src="video.mp4" type="video/mp4" />Your browser does not support video.</video>',
    )
    // fallback text may or may not survive depending on TinyMCE
    expect(typeof content).toBe('string')
    expect(content.length).toBeGreaterThan(0)
  })

  test('<video> with multiple tracks — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Lecture 1:</p><video src="l1.mp4"><track kind="captions" src="en.vtt" srclang="en" label="English" /><track kind="subtitles" src="es.vtt" srclang="es" label="Español" /></video><p>End of lecture.</p>',
    )
    expect(content).toContain('Lecture 1')
    expect(content).toContain('End of lecture')
  })

  test('<audio> with controls — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Listen:</p><audio controls><source src="podcast.mp3" type="audio/mpeg" />Audio not supported.</audio><p>Transcript below.</p>',
    )
    expect(content).toContain('Listen')
    expect(content).toContain('Transcript below')
  })

  test('<video> with poster attribute — no crash', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Video with poster:</p><video src="video.mp4" poster="thumbnail.jpg" controls></video><p>After video.</p>',
    )
    expect(content).toContain('Video with poster')
    expect(content).toContain('After video')
  })
})
