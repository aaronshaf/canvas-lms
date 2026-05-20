import {test, expect} from '../../fixtures/test'

// Canvas ePortfolio lets students curate and showcase their work across courses.
// Portfolio pages combine project descriptions, embedded media, reflection
// paragraphs, skill lists, and links to artifacts. These realistic portfolio
// patterns verify complex student-authored rich content survives the RCE.
test.describe('Canvas ePortfolio content patterns', () => {
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

  test('project showcase with image and description — all content preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h2>Capstone Project: Urban Heat Island Analysis</h2>
      <figure>
        <img src="/portfolio/projects/uhi-map.png" alt="Heat map of downtown Portland showing temperature variation" width="700">
        <figcaption>Figure 1: Surface temperature variation across Portland, OR (July 2023)</figcaption>
      </figure>
      <p>This project analyzed surface temperature data from LANDSAT-8 imagery to quantify the urban heat island effect in Portland. Using Python and GDAL, I processed 12 scenes spanning summer 2023.</p>
      <p><strong>Key finding:</strong> Downtown temperatures averaged 4.2°C higher than suburban parks during peak afternoon hours.</p>`,
    )
    expect(content).toContain('Urban Heat Island Analysis')
    expect(content).toContain('temperature variation')
    expect(content).toContain('LANDSAT-8 imagery')
    expect(content).toContain('suburban parks')
  })

  test('skills and competencies list — all items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h2>Technical Skills</h2>
      <ul>
        <li><strong>Programming:</strong> Python, R, JavaScript, SQL</li>
        <li><strong>Data Analysis:</strong> pandas, NumPy, scikit-learn, tidyverse</li>
        <li><strong>Visualization:</strong> matplotlib, ggplot2, Tableau, D3.js</li>
        <li><strong>GIS:</strong> ArcGIS, QGIS, PostGIS, GDAL</li>
      </ul>`,
    )
    expect(content).toContain('scikit-learn')
    expect(content).toContain('PostGIS')
    expect(content).toContain('Visualization')
  })

  test('reflection essay with course connections — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h2>Learning Reflection</h2>
      <p>Before taking STAT 301, I treated statistics as a collection of formulas to memorize. This course fundamentally changed how I think about uncertainty and inference.</p>
      <p>The most transformative experience was the semester-long project where we designed our own study, collected data, and defended our methodology to a panel of faculty. This mirrors the peer-review process in academic research.</p>
      <p>Going forward, I intend to apply Bayesian reasoning to my senior thesis on climate modeling.</p>`,
    )
    expect(content).toContain('STAT 301')
    expect(content).toContain('peer-review process')
    expect(content).toContain('Bayesian reasoning')
  })

  test('artifact links with context — link text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h2>Work Samples</h2>
      <ol>
        <li><a href="/portfolio/files/research-paper.pdf">Genomics Literature Review</a> — BIOL 420, Spring 2024</li>
        <li><a href="/portfolio/files/lab-notebook.pdf">Cell Culture Lab Notebook</a> — BIOL 310, Fall 2023</li>
        <li><a href="/portfolio/files/presentation.pdf">Conference Poster: CRISPR Applications</a> — Presented at UROP Symposium</li>
      </ol>`,
    )
    expect(content).toContain('Genomics Literature Review')
    expect(content).toContain('Cell Culture Lab Notebook')
    expect(content).toContain('CRISPR Applications')
    expect(content).toContain('UROP Symposium')
  })
})
