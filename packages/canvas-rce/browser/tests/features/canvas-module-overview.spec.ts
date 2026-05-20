import {test, expect} from '../../fixtures/test'

// Canvas module overview pages set context for a week's worth of learning.
// They contain learning objectives, activity lists with estimated times,
// required materials, and navigation links to module items. These realistic
// module overview patterns verify structured instructional content is preserved.
test.describe('Canvas module overview page content patterns', () => {
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

  test('module intro with learning objectives — all objectives preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h2>Module 4: Market Structures and Competition</h2>
      <p>This module examines how market structure affects firm behavior and economic outcomes.</p>
      <h3>Learning Objectives</h3>
      <p>By the end of this module, you will be able to:</p>
      <ul>
        <li>Distinguish between perfect competition, monopolistic competition, oligopoly, and monopoly</li>
        <li>Calculate profit-maximizing output using marginal analysis</li>
        <li>Evaluate the welfare effects of market power on consumers and society</li>
        <li>Apply game theory concepts to oligopoly decision-making</li>
      </ul>`,
    )
    expect(content).toContain('Market Structures and Competition')
    expect(content).toContain('monopolistic competition')
    expect(content).toContain('marginal analysis')
    expect(content).toContain('game theory concepts')
  })

  test('activity checklist with time estimates — all items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h3>Module Activities</h3>
      <ol>
        <li><strong>Read:</strong> Textbook Chapter 12 (pp. 287-318) — <em>approx. 45 minutes</em></li>
        <li><strong>Watch:</strong> Lecture video "Perfect Competition" (Module 4a) — <em>23 minutes</em></li>
        <li><strong>Watch:</strong> Lecture video "Monopoly and Market Power" (Module 4b) — <em>31 minutes</em></li>
        <li><strong>Complete:</strong> Practice problems 4.1-4.5 (ungraded self-check)</li>
        <li><strong>Submit:</strong> Problem Set 4 by Sunday 11:59 PM — <em>est. 90 minutes</em></li>
        <li><strong>Participate:</strong> Discussion: Oligopoly in the Real World (due Thursday)</li>
      </ol>`,
    )
    expect(content).toContain('Textbook Chapter 12')
    expect(content).toContain('Perfect Competition')
    expect(content).toContain('Problem Set 4')
    expect(content).toContain('Oligopoly in the Real World')
  })

  test('required materials list with links — all entries preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h3>Required Materials for This Module</h3>
      <ul>
        <li>Krugman, P. &amp; Wells, R. <em>Microeconomics</em>, 5th ed. — Chapters 12-14</li>
        <li><a href="/courses/1/files/221/preview">Supplemental reading: Stigler (1964)</a> — "A Theory of Oligopoly"</li>
        <li><a href="/courses/1/pages/game-theory-primer">Game theory primer</a> (Canvas page, 10 min read)</li>
      </ul>`,
    )
    expect(content).toContain('Microeconomics')
    expect(content).toContain('Theory of Oligopoly')
    expect(content).toContain('Game theory primer')
  })

  test('module with embedded video intro and text — all preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p>Welcome to Module 7. Before diving in, watch this short orientation video:</p>
      <p><iframe src="https://instructure-uploads.s3.amazonaws.com/intro-mod7.mp4" width="640" height="360" allowfullscreen></iframe></p>
      <p>This module covers the final three statistical tests you will need for your capstone project: ANOVA, chi-square, and correlation analysis. Each has a dedicated lecture, worked examples, and practice data sets.</p>`,
    )
    expect(content).toContain('Welcome to Module 7')
    expect(content).toContain('ANOVA, chi-square')
    expect(content).toContain('capstone project')
  })
})
