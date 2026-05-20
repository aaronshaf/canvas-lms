import {test, expect} from '../../fixtures/test'

// Canvas embeds third-party content via <iframe> with security attributes.
// sandbox restricts capabilities, allow controls feature policies, loading=lazy
// defers off-screen iframes. These attributes protect students from malicious
// embedded content and must survive the RCE round-trip.
test.describe('<iframe> security and loading attributes', () => {
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

  test('iframe with sandbox attribute — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Embedded tool: <iframe src="/lti/launch" sandbox="allow-scripts allow-same-origin" width="800" height="600"></iframe></p>',
    )
    expect(content).toContain('Embedded tool')
  })

  test('iframe with allow attribute — text context preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Video player:</p><iframe src="https://www.youtube.com/embed/abc123" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope" allowfullscreen width="560" height="315"></iframe><p>Watch the above video.</p>',
    )
    expect(content).toContain('Video player')
    expect(content).toContain('Watch the above video')
  })

  test('iframe with loading=lazy — content structure preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Below the fold:</p><iframe src="/external-tool" loading="lazy" width="100%" height="400"></iframe>',
    )
    expect(content).toContain('Below the fold')
  })

  test('iframe with referrerpolicy — label text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>External resource (no referrer sent):</p><iframe src="https://partner.edu/embed" referrerpolicy="no-referrer" width="640" height="480"></iframe>',
    )
    expect(content).toContain('External resource')
    expect(content).toContain('no referrer sent')
  })

  test('multiple iframes in sequence — all labels preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p>Primary video:</p>
      <iframe src="/media/1" width="560" height="315"></iframe>
      <p>Secondary reading:</p>
      <iframe src="/embed/2" width="800" height="600"></iframe>
      <p>Interactive lab:</p>
      <iframe src="/lab/3" sandbox="allow-scripts" width="100%" height="500"></iframe>`,
    )
    expect(content).toContain('Primary video')
    expect(content).toContain('Secondary reading')
    expect(content).toContain('Interactive lab')
  })
})
