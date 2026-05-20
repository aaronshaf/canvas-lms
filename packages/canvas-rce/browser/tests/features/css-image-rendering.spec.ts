import {test, expect} from '../../fixtures/test'

// image-rendering controls how browsers scale images — used for pixel art
// diagrams, maps, and screenshots where smooth scaling would blur important
// detail. crisp-edges/pixelated preserves sharp pixels. alt text must survive.
test.describe('CSS image-rendering property', () => {
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

  test('image-rendering: pixelated — alt text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<img src="pixel-art.png" alt="Pixel art diagram" style="image-rendering: pixelated; width: 256px; height: 256px;">',
    )
    expect(content).toContain('Pixel art diagram')
  })

  test('image-rendering: crisp-edges — alt and surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Circuit schematic:</p><img src="schematic.png" alt="Circuit schematic" style="image-rendering: crisp-edges; width: 400px;"><p>See above.</p>',
    )
    expect(content).toContain('Circuit schematic')
    expect(content).toContain('See above')
  })

  test('image-rendering: auto — alt text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<img src="photo.jpg" alt="Course photo" style="image-rendering: auto;">',
    )
    expect(content).toContain('Course photo')
  })

  test('image-rendering on canvas element — no crash', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Chart output:</p><canvas width="300" height="200" style="image-rendering: pixelated;"></canvas>',
    )
    expect(content).toContain('Chart output')
  })
})
