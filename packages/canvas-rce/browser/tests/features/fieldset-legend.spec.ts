import {test, expect} from '../../fixtures/test'

// <fieldset> and <legend> appear in Canvas quiz content and course pages
// that embed form-like UI. TinyMCE may strip form elements, but the
// legend text (which labels the group) is meaningful content that should
// not be silently lost. Tests document actual behavior.
test.describe('<fieldset> and <legend> elements', () => {
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

  test('<legend> text survives round-trip', async ({page}) => {
    const content = await setAndGet(
      page,
      '<fieldset><legend>Personal Information</legend><p>Enter your details below.</p></fieldset>',
    )
    expect(content).toContain('Personal Information')
    expect(content).toContain('Enter your details below')
  })

  test('paragraph inside <fieldset> is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<fieldset><legend>Settings</legend><p>Configure your preferences.</p><p>Second paragraph.</p></fieldset>',
    )
    expect(content).toContain('Configure your preferences')
    expect(content).toContain('Second paragraph')
  })

  test('text around <fieldset> is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before fieldset.</p><fieldset><legend>Group</legend><p>Group content.</p></fieldset><p>After fieldset.</p>',
    )
    expect(content).toContain('Before fieldset')
    expect(content).toContain('After fieldset')
  })

  test('multiple nested <fieldset> elements — all legends preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<fieldset><legend>Outer group</legend><fieldset><legend>Inner group</legend><p>Nested content.</p></fieldset></fieldset>',
    )
    expect(content).toContain('Outer group')
    expect(content).toContain('Inner group')
    expect(content).toContain('Nested content')
  })

  test('<fieldset> with formatted legend — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<fieldset><legend><strong>Required</strong> fields</legend><p>Content here.</p></fieldset>',
    )
    expect(content).toContain('fields')
    expect(content).toContain('Content here')
  })
})
