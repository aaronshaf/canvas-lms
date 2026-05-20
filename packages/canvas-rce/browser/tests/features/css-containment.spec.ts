import {test, expect} from '../../fixtures/test'

// CSS containment (contain property) isolates subtrees for rendering performance.
// isolation: isolate creates a new stacking context for z-index scoping.
// overflow: clip differs from hidden by blocking all overflow including programmatic.
// These properties appear in Canvas theme customizations and embedded widgets.
test.describe('CSS containment, isolation, and overflow:clip', () => {
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

  test('contain: layout on widget container — content preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="contain: layout; padding: 16px;"><h3>Assignment Widget</h3><p>Due in 3 days — complete the reading before class.</p></div>',
    )
    expect(content).toContain('Assignment Widget')
    expect(content).toContain('complete the reading')
  })

  test('contain: content on card — card text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="contain: content; border: 1px solid #ccc;"><p><strong>Module 4:</strong> Advanced Topics in Machine Learning</p></div>',
    )
    expect(content).toContain('Advanced Topics in Machine Learning')
  })

  test('contain: paint clips overflow — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before widget</p><div style="contain: paint; width: 200px; height: 100px;"><p>Clipped content inside contained box.</p></div><p>After widget</p>',
    )
    expect(content).toContain('Before widget')
    expect(content).toContain('Clipped content')
    expect(content).toContain('After widget')
  })

  test('isolation: isolate on stacking context — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="isolation: isolate; position: relative;"><p>Isolated stacking context for modal overlay.</p><span style="position: absolute; z-index: 1;">Overlay text</span></div>',
    )
    expect(content).toContain('Isolated stacking context')
    expect(content).toContain('Overlay text')
  })

  test('overflow: clip on image container — caption preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<figure style="overflow: clip; width: 400px;"><img src="/course/image.jpg" alt="Lab microscope slide"><figcaption>Figure 1: Mitosis stage under 400x magnification</figcaption></figure>',
    )
    expect(content).toContain('Lab microscope slide')
    expect(content).toContain('Mitosis stage')
  })
})
