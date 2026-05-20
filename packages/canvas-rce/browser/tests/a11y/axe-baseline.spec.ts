import AxeBuilder from '@axe-core/playwright'
import {test, expect} from '../../fixtures/test'

test.describe('accessibility — axe baseline', () => {
  test('basic editor has no critical a11y violations', async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()

    const results = await new AxeBuilder({page})
      .exclude('iframe') // TinyMCE iframe content is tested separately
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    const critical = results.violations.filter(v => v.impact === 'critical')
    expect(
      critical,
      `Critical a11y violations: ${JSON.stringify(critical.map(v => v.id))}`,
    ).toHaveLength(0)
  })

  test('readonly editor has no critical a11y violations', async ({page, rcePage}) => {
    await page.goto('/scenarios/readonly')
    await rcePage.waitForEditor()

    const results = await new AxeBuilder({page})
      .exclude('iframe')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    const critical = results.violations.filter(v => v.impact === 'critical')
    expect(
      critical,
      `Critical a11y violations: ${JSON.stringify(critical.map(v => v.id))}`,
    ).toHaveLength(0)
  })

  test('toolbar buttons have accessible labels', async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()

    // Every toolbar button must have aria-label or title
    const unlabeled = await page.evaluate(() => {
      const buttons = [
        ...document.querySelectorAll(
          '.tox-toolbar__primary [role="button"], .tox-toolbar__primary button',
        ),
      ]
      return buttons
        .filter(
          b => !b.getAttribute('aria-label') && !b.getAttribute('title') && !b.textContent?.trim(),
        )
        .map(b => b.outerHTML.slice(0, 80))
    })
    expect(unlabeled).toHaveLength(0)
  })

  test('status bar buttons have accessible labels', async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()

    const statusBar = page.locator('[data-testid="RCEStatusBar"]')
    const results = await new AxeBuilder({page})
      .include('[data-testid="RCEStatusBar"]')
      .withTags(['wcag2a'])
      .analyze()

    const violations = results.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious',
    )
    expect(
      violations,
      `Status bar a11y: ${JSON.stringify(violations.map(v => v.id))}`,
    ).toHaveLength(0)
  })

  test('flash screenreader holder has correct aria attributes', async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    const holder = page.locator('#flash_screenreader_holder')
    await expect(holder).toHaveAttribute('role', 'alert')
    await expect(holder).toHaveAttribute('aria-live', 'assertive')
  })
})
