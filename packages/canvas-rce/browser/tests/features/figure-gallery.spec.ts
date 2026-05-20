import {test, expect} from '../../fixtures/test'

// Instructors build image galleries using <figure> wrappers with multiple
// images and a shared <figcaption>. Course pages also use figure for
// side-by-side comparison images, before/after diagrams, and annotated
// screenshots. All image alt text and caption text must survive round-trips.
test.describe('<figure> with multiple images and captions', () => {
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

  test('<figure> with two images and caption — caption and alts preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<figure><img src="before.jpg" alt="Before treatment"><img src="after.jpg" alt="After treatment"><figcaption>Figure 1: Before and after comparison.</figcaption></figure>',
    )
    expect(content).toContain('Before treatment')
    expect(content).toContain('After treatment')
    expect(content).toContain('Before and after comparison')
  })

  test('<figure> gallery with three images — all alt texts preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<figure class="gallery"><img src="img1.jpg" alt="Specimen A"><img src="img2.jpg" alt="Specimen B"><img src="img3.jpg" alt="Specimen C"><figcaption>Cell specimens under microscope.</figcaption></figure>',
    )
    expect(content).toContain('Specimen A')
    expect(content).toContain('Specimen B')
    expect(content).toContain('Specimen C')
    expect(content).toContain('Cell specimens')
  })

  test('<figcaption> before images — caption text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<figure><figcaption>Caption first pattern</figcaption><img src="diagram.png" alt="Technical diagram"></figure>',
    )
    expect(content).toContain('Caption first pattern')
    expect(content).toContain('Technical diagram')
  })

  test('multiple <figure> elements — all captions preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<figure><img src="a.jpg" alt="Graph A"><figcaption>Figure 1: Revenue</figcaption></figure><figure><img src="b.jpg" alt="Graph B"><figcaption>Figure 2: Expenses</figcaption></figure>',
    )
    expect(content).toContain('Figure 1: Revenue')
    expect(content).toContain('Figure 2: Expenses')
  })

  test('<figure> with <a> wrapping image — link and alt preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<figure><a href="/courses/1/pages/full-diagram"><img src="thumb.jpg" alt="Diagram thumbnail"></a><figcaption>Click to view full diagram.</figcaption></figure>',
    )
    expect(content).toContain('Diagram thumbnail')
    expect(content).toContain('Click to view full diagram')
  })
})
