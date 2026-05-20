import {test, expect} from '../../fixtures/test'

// object-fit and object-position control how replaced content (img, video)
// fills its container box. Used by instructors for consistent image thumbnails,
// hero images, and profile photos in course content. Text context must survive.
test.describe('CSS object-fit and object-position properties', () => {
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

  test('object-fit: cover on img — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Thumbnail image:</p><img src="photo.jpg" alt="Course photo" style="width: 200px; height: 150px; object-fit: cover;"><p>Caption here.</p>',
    )
    expect(content).toContain('Thumbnail image')
    expect(content).toContain('Caption here')
  })

  test('object-fit: contain — alt text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<img src="diagram.png" alt="Circuit diagram" style="width: 300px; height: 200px; object-fit: contain; background: #eee;">',
    )
    expect(content).toContain('Circuit diagram')
  })

  test('object-fit: fill — text around preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before image</p><img src="banner.jpg" alt="Banner" style="width: 100%; height: 80px; object-fit: fill;"><p>After image</p>',
    )
    expect(content).toContain('Before image')
    expect(content).toContain('After image')
  })

  test('object-position — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<img src="portrait.jpg" alt="Instructor portrait" style="width: 100px; height: 100px; object-fit: cover; object-position: top center;">',
    )
    expect(content).toContain('Instructor portrait')
  })

  test('object-fit on video — text around preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Video preview:</p><video style="width: 320px; height: 180px; object-fit: cover;" src="preview.mp4"></video>',
    )
    expect(content).toContain('Video preview')
  })
})
