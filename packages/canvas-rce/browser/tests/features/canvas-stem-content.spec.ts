import {test, expect} from '../../fixtures/test'

// STEM courses in Canvas contain specialized content: chemical formulas with
// subscripts, physics equations with superscripts, code blocks with algorithms,
// data tables with measurement units, and diagram captions. These patterns test
// whether dense scientific content survives the RCE pipeline intact.
test.describe('Canvas STEM course content patterns', () => {
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

  test('chemistry: molecular formula with subscripts — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p>The combustion of glucose (C<sub>6</sub>H<sub>12</sub>O<sub>6</sub>) produces carbon dioxide (CO<sub>2</sub>) and water (H<sub>2</sub>O) according to the balanced equation:</p>
      <p>C<sub>6</sub>H<sub>12</sub>O<sub>6</sub> + 6O<sub>2</sub> → 6CO<sub>2</sub> + 6H<sub>2</sub>O</p>`,
    )
    expect(content).toContain('combustion of glucose')
    expect(content).toContain('carbon dioxide')
    expect(content).toContain('balanced equation')
  })

  test('physics: measurement table with units — data preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<table>
        <caption>Pendulum experiment: period vs. length</caption>
        <thead><tr><th>Length (cm)</th><th>Trial 1 (s)</th><th>Trial 2 (s)</th><th>Average (s)</th></tr></thead>
        <tbody>
          <tr><td>25</td><td>1.01</td><td>0.99</td><td>1.00</td></tr>
          <tr><td>50</td><td>1.43</td><td>1.41</td><td>1.42</td></tr>
          <tr><td>100</td><td>2.01</td><td>2.03</td><td>2.02</td></tr>
        </tbody>
      </table>`,
    )
    expect(content).toContain('Pendulum experiment')
    expect(content).toContain('period vs. length')
    expect(content).toContain('1.42')
  })

  test('biology: cell cycle description with terms — all preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h3>Phases of Mitosis</h3>
      <dl>
        <dt>Prophase</dt><dd>Chromosomes condense; spindle apparatus begins to form</dd>
        <dt>Metaphase</dt><dd>Chromosomes align along the metaphase plate</dd>
        <dt>Anaphase</dt><dd>Sister chromatids separate and move to opposite poles</dd>
        <dt>Telophase</dt><dd>Nuclear envelope reforms; chromosomes decondense</dd>
      </dl>`,
    )
    expect(content).toContain('Prophase')
    expect(content).toContain('metaphase plate')
    expect(content).toContain('Sister chromatids separate')
    expect(content).toContain('Nuclear envelope reforms')
  })

  test('computer science: algorithm pseudocode in pre block — preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p>Binary search algorithm pseudocode:</p>
      <pre>function binarySearch(arr, target):
    low = 0
    high = length(arr) - 1
    while low &lt;= high:
        mid = (low + high) / 2
        if arr[mid] == target: return mid
        if arr[mid] &lt; target: low = mid + 1
        else: high = mid - 1
    return -1</pre>
      <p>Time complexity: O(log n) — much faster than linear search for sorted arrays.</p>`,
    )
    expect(content).toContain('binarySearch')
    expect(content).toContain('linear search')
  })

  test('engineering: requirements table — specifications preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h3>Project Requirements</h3>
      <table>
        <tr><th>Parameter</th><th>Minimum</th><th>Maximum</th><th>Unit</th></tr>
        <tr><td>Input voltage</td><td>3.0</td><td>5.5</td><td>V</td></tr>
        <tr><td>Operating temperature</td><td>-40</td><td>85</td><td>°C</td></tr>
        <tr><td>Current draw (idle)</td><td>0</td><td>50</td><td>mA</td></tr>
      </table>`,
    )
    expect(content).toContain('Input voltage')
    expect(content).toContain('Operating temperature')
    expect(content).toContain('Current draw')
  })
})
