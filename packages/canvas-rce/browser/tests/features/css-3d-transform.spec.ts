import {test, expect} from '../../fixtures/test'

// 3D CSS transforms (perspective, rotateX/Y/Z, translateZ, backface-visibility)
// appear in course content with flip-card exercises, 3D chart labels, and
// animated interactive elements. Text must survive regardless of how TinyMCE
// handles these advanced transform properties.
test.describe('CSS 3D transform properties', () => {
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

  test('perspective property on container — child text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="perspective: 1000px;"><div style="transform: rotateY(45deg);">3D rotated card front</div></div>',
    )
    expect(content).toContain('3D rotated card front')
  })

  test('backface-visibility: hidden — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="backface-visibility: hidden; transform: rotateY(180deg);">Hidden backface content</div>',
    )
    expect(content).toContain('Hidden backface content')
  })

  test('transform-style: preserve-3d — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="transform-style: preserve-3d; perspective: 800px;"><div style="transform: translateZ(50px);">Elevated layer text</div></div>',
    )
    expect(content).toContain('Elevated layer text')
  })

  test('rotateX on element — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="transform: rotateX(15deg);">X-axis rotated content</div>',
    )
    expect(content).toContain('X-axis rotated content')
  })

  test('matrix3d transform — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="transform: matrix3d(1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1);">Identity matrix content</div>',
    )
    expect(content).toContain('Identity matrix content')
  })

  test('flip card pattern — both sides text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="transform-style: preserve-3d;"><div style="backface-visibility: hidden;">Front: Question text</div><div style="backface-visibility: hidden; transform: rotateY(180deg);">Back: Answer text</div></div>',
    )
    expect(content).toContain('Front: Question text')
    expect(content).toContain('Back: Answer text')
  })
})
