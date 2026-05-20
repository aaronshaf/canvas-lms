import {test, expect} from '../../fixtures/test'

// <figure> wrapping <video> is the semantic pattern for video content with
// accessible captions. The figcaption serves as the visible description,
// while the video's track elements provide time-coded captions. All text
// must survive so the accessible description is preserved on save.
test.describe('<figure> containing <video> elements', () => {
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

  test('<figure> with <video> and <figcaption> — caption preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<figure><video controls src="lecture.mp4" width="640" height="360"></video><figcaption>Video 1: Introduction to sorting algorithms.</figcaption></figure>',
    )
    expect(content).toContain('Introduction to sorting algorithms')
  })

  test('<figure> with <video> and <track> — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<figure><video controls><source src="demo.mp4" type="video/mp4"><track kind="captions" src="demo.vtt" srclang="en" label="English"></video><figcaption>Demonstration video with captions.</figcaption></figure>',
    )
    expect(content).toContain('Demonstration video with captions')
  })

  test('multiple video figures on a page — all captions preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<figure><video src="v1.mp4" controls></video><figcaption>Week 1: Foundations overview</figcaption></figure><figure><video src="v2.mp4" controls></video><figcaption>Week 2: Applied techniques</figcaption></figure>',
    )
    expect(content).toContain('Week 1: Foundations overview')
    expect(content).toContain('Week 2: Applied techniques')
  })

  test('<figure> with poster image video — caption preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<figure><video controls poster="thumb.jpg" src="lesson.mp4" width="800"></video><figcaption>Figure 3: Step-by-step assembly guide.</figcaption></figure>',
    )
    expect(content).toContain('Step-by-step assembly guide')
  })

  test('<figure> video with paragraph context — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Watch the video below before proceeding:</p><figure><video controls src="intro.mp4"></video><figcaption>Introductory lecture — 12 minutes</figcaption></figure><p>Continue to the quiz when ready.</p>',
    )
    expect(content).toContain('Watch the video below')
    expect(content).toContain('Introductory lecture')
    expect(content).toContain('Continue to the quiz')
  })
})
