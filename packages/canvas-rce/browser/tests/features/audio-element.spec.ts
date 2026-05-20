import {test, expect} from '../../fixtures/test'

// <audio> elements appear in Canvas course pages for podcasts, pronunciation
// guides, and audio feedback. TinyMCE preserves the element structure so
// instructors can embed audio without custom HTML being stripped.
test.describe('<audio> element handling', () => {
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

  test('<audio> with controls — text around it preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Listen to this lecture:</p><audio controls src="lecture.mp3"></audio><p>End of audio.</p>',
    )
    expect(content).toContain('Listen to this lecture')
    expect(content).toContain('End of audio')
  })

  test('<audio> with <source> children — fallback text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<audio controls><source src="audio.mp3" type="audio/mpeg"><source src="audio.ogg" type="audio/ogg">Your browser does not support audio.</audio>',
    )
    expect(content).toContain('audio')
  })

  test('<audio> autoplay attribute — element present', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Background audio:</p><audio autoplay loop src="bg.mp3"></audio>',
    )
    expect(content).toContain('Background audio')
  })

  test('<audio> preload="none" — element present in output', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Click to load:</p><audio controls preload="none" src="clip.mp3"></audio>',
    )
    expect(content).toContain('Click to load')
  })

  test('multiple <audio> elements — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Track 1:</p><audio controls src="t1.mp3"></audio><p>Track 2:</p><audio controls src="t2.mp3"></audio>',
    )
    expect(content).toContain('Track 1')
    expect(content).toContain('Track 2')
  })
})
