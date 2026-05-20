import {test, expect} from '../../fixtures/test'

// Humanities courses produce richly formatted content: literary analysis with
// block quotations, MLA/Chicago citations with footnote-style formatting,
// annotated bibliographies, and close readings with embedded passages.
// These patterns verify the RCE handles scholarly humanities content correctly.
test.describe('Canvas humanities course content patterns', () => {
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

  test('literary analysis with block quotation — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p>In <em>Beloved</em>, Morrison uses fragmented syntax to enact the trauma of memory. When Sethe attempts to articulate the past, the prose itself breaks down:</p>
      <blockquote>
        <p>"124 was spiteful. Full of a baby's venom. The women of 124 had lived through it, lost sons, brothers, fathers, uncles."</p>
      </blockquote>
      <p>The repetition of "124" grounds the supernatural in a physical address, making the haunting concrete rather than abstract (Morrison 1).</p>`,
    )
    expect(content).toContain('fragmented syntax')
    expect(content).toContain('124 was spiteful')
    expect(content).toContain('haunting concrete')
  })

  test('annotated bibliography entry — citation and annotation preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p>Foucault, Michel. <em>Discipline and Punish: The Birth of the Prison</em>. Trans. Alan Sheridan. Vintage Books, 1995.</p>
      <blockquote>
        <p>Foucault traces the evolution of punishment from public torture to internalized surveillance. Central to his argument is the Panopticon as a metaphor for modern disciplinary power. Essential reading for understanding how institutions shape subjects.</p>
      </blockquote>`,
    )
    expect(content).toContain('Discipline and Punish')
    expect(content).toContain('Panopticon')
    expect(content).toContain('disciplinary power')
  })

  test('primary source analysis with context — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h3>Document Analysis: The Declaration of Independence (1776)</h3>
      <p><strong>Historical context:</strong> Written amid the American Revolutionary War, the Declaration draws on Enlightenment philosophy—particularly Locke's theory of natural rights.</p>
      <p><strong>Key passage:</strong> "We hold these truths to be self-evident, that all men are created equal, that they are endowed by their Creator with certain unalienable Rights."</p>
      <p><strong>Analysis:</strong> The phrase "self-evident" borrows directly from Newtonian scientific discourse, lending political claims the authority of natural law.</p>`,
    )
    expect(content).toContain('American Revolutionary War')
    expect(content).toContain('unalienable Rights')
    expect(content).toContain('Newtonian scientific discourse')
  })

  test('Chicago-style footnote-formatted content — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p>The concept of the sublime underwent significant transformation in the Romantic period.<sup>1</sup> Burke distinguished between beauty and sublimity, arguing that the latter arises from terror and obscurity.<sup>2</sup></p>
      <hr>
      <p><sup>1</sup> See Thomas Weiskel, <em>The Romantic Sublime</em> (Baltimore: Johns Hopkins, 1976), 3-22.</p>
      <p><sup>2</sup> Edmund Burke, <em>A Philosophical Enquiry</em>, ed. James T. Boulton (London: Routledge, 1958), 57.</p>`,
    )
    expect(content).toContain('Romantic period')
    expect(content).toContain('terror and obscurity')
    expect(content).toContain('Philosophical Enquiry')
  })

  test('compare-contrast essay structure — headings and paragraphs preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h2>Comparing Realism and Naturalism in American Literature</h2>
      <h3>Shared Characteristics</h3>
      <p>Both movements reject Romantic idealization in favor of depicting ordinary life and social conditions with accuracy and detail.</p>
      <h3>Key Distinctions</h3>
      <p>Naturalism, influenced by Darwinian determinism, presents characters as products of heredity and environment with little agency. Realism, by contrast, allows for moral choice within social constraints.</p>`,
    )
    expect(content).toContain('Realism and Naturalism')
    expect(content).toContain('Darwinian determinism')
    expect(content).toContain('moral choice within social constraints')
  })
})
