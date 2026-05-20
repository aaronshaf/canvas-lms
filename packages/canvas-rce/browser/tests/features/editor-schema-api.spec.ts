import {test, expect} from '../../fixtures/test'

// editor.schema exposes TinyMCE's HTML schema — the map of allowed elements,
// attributes, and their validation rules. Querying it lets you verify that
// the editor's allowlist is configured as expected before content round-trips.
// Available methods: getBlockElements, getTextBlockElements, getTextInlineElements,
// getBoolAttrs, getElementRule, isValidChild, isValid, getShortEndedElements, etc.
test.describe('editor.schema API', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('editor.schema is defined', async ({page}) => {
    const type = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return typeof window.tinymce.activeEditor.schema
    })
    expect(type).toBe('object')
  })

  test('schema.getBlockElements() includes p and div', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const blocks = window.tinymce.activeEditor.schema.getBlockElements()
      return {hasP: 'p' in blocks, hasDiv: 'div' in blocks}
    })
    expect(result.hasP).toBe(true)
    expect(result.hasDiv).toBe(true)
  })

  test('schema.getTextBlockElements() includes p', async ({page}) => {
    const hasP = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return 'p' in window.tinymce.activeEditor.schema.getTextBlockElements()
    })
    expect(hasP).toBe(true)
  })

  test('schema.getTextInlineElements() includes strong and em', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const inline = window.tinymce.activeEditor.schema.getTextInlineElements()
      return {hasStrong: 'strong' in inline, hasEm: 'em' in inline}
    })
    expect(result.hasStrong).toBe(true)
    expect(result.hasEm).toBe(true)
  })

  test('schema.getShortEndedElements() includes br and img', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const voids = window.tinymce.activeEditor.schema.getShortEndedElements()
      return {hasBr: 'br' in voids, hasImg: 'img' in voids}
    })
    expect(result.hasBr).toBe(true)
    expect(result.hasImg).toBe(true)
  })

  test('schema.isValidChild() returns boolean for element relationships', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const schema = window.tinymce.activeEditor.schema
      return {
        pInBody: typeof schema.isValidChild('body', 'p'),
        strongInP: typeof schema.isValidChild('p', 'strong'),
      }
    })
    expect(result.pInBody).toBe('boolean')
    expect(result.strongInP).toBe('boolean')
  })

  test('schema.getElementRule() returns rule object for known elements', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const rule = window.tinymce.activeEditor.schema.getElementRule('p')
      return rule !== null && typeof rule === 'object'
    })
    expect(result).toBe(true)
  })

  test('schema.getNonEmptyElements() includes img', async ({page}) => {
    const hasImg = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return 'img' in window.tinymce.activeEditor.schema.getNonEmptyElements()
    })
    expect(hasImg).toBe(true)
  })
})
