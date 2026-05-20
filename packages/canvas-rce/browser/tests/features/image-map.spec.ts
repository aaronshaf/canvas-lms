import {test, expect} from '../../fixtures/test'

// <map> and <area> create client-side image maps where different regions of
// an image link to different URLs. They appear in legacy course content with
// interactive diagrams (anatomy maps, geography maps, flowcharts).
// The image alt text and any surrounding content must always survive.
test.describe('<map> and <area> image map elements', () => {
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

  test('paragraph around image map is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Click regions:</p><img src="diagram.png" alt="Interactive diagram" usemap="#diagrammap" /><map name="diagrammap"><area shape="rect" coords="0,0,100,100" href="#region1" alt="Region 1" /></map><p>See details below.</p>',
    )
    expect(content).toContain('Click regions')
    expect(content).toContain('See details below')
  })

  test('image with usemap — alt text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<img src="world.png" alt="World map with clickable regions" usemap="#worldmap" /><map name="worldmap"><area shape="poly" coords="10,20,30,40" href="#europe" alt="Europe" /></map>',
    )
    expect(content).toContain('alt')
  })

  test('<map> with multiple <area> elements — no crash', async ({page}) => {
    const content = await setAndGet(
      page,
      '<img src="body.png" alt="Human body diagram" usemap="#bodymap" /><map name="bodymap"><area shape="circle" coords="50,50,30" href="#head" alt="Head" /><area shape="rect" coords="30,80,70,150" href="#torso" alt="Torso" /><area shape="rect" coords="30,150,70,250" href="#legs" alt="Legs" /></map><p>Click to learn more.</p>',
    )
    expect(content).toContain('Click to learn more')
    expect(typeof content).toBe('string')
  })

  test('text before and after <map> block is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<h2>Anatomy Reference</h2><img src="anatomy.png" alt="Anatomy" usemap="#amap" /><map name="amap"></map><p>Study guide continues here.</p>',
    )
    expect(content).toContain('Anatomy Reference')
    expect(content).toContain('Study guide continues here')
  })
})
