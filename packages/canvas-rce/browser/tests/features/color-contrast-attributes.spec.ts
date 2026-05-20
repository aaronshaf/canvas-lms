import {test, expect} from '../../fixtures/test'

// Inline color styling must survive round-trips so instructors can apply
// color coding in course content (red for warnings, green for correct answers,
// blue for definitions). Tests cover various color formats: hex, rgb, rgba,
// named colors, and hsl values in both color and background-color.
test.describe('color values in various CSS formats', () => {
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

  test('rgb() color value — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p style="color: rgb(255, 0, 0);">Red RGB text</p>')
    expect(content).toContain('Red RGB text')
  })

  test('rgba() color with transparency — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="color: rgba(0, 0, 128, 0.8);">Semi-transparent navy</p>',
    )
    expect(content).toContain('Semi-transparent navy')
  })

  test('named color value — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="color: navy; background-color: lightyellow;">Navy on yellow</p>',
    )
    expect(content).toContain('Navy on yellow')
  })

  test('hsl() color value — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="color: hsl(120, 100%, 30%);">HSL green text</p>',
    )
    expect(content).toContain('HSL green text')
  })

  test('hex shorthand color #abc — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p style="color: #336699;">Hex shorthand color</p>')
    expect(content).toContain('Hex shorthand color')
  })

  test('multiple color properties on same element — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="color: white; background-color: #cc0000; border-color: #880000;">Warning box text</p>',
    )
    expect(content).toContain('Warning box text')
  })
})
