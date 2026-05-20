import {test, expect} from '../../fixtures/test'

// Nursing and allied health programs use Canvas to distribute clinical content:
// patient case studies, medication administration tables, care plan templates,
// and clinical procedure checklists. This content often contains structured
// tables and formatted lists that must survive the RCE round-trip precisely.
test.describe('Canvas nursing and clinical content patterns', () => {
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

  test('patient case study header — demographics and chief complaint preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h2>Case Study: Mrs. R.</h2>
      <table>
        <tr><th>Age</th><td>67</td><th>Sex</th><td>Female</td></tr>
        <tr><th>Chief complaint</th><td colspan="3">Shortness of breath and chest tightness for 2 days</td></tr>
        <tr><th>PMH</th><td colspan="3">Type 2 diabetes, hypertension, hyperlipidemia (20 years)</td></tr>
        <tr><th>Allergies</th><td colspan="3">Penicillin (hives), sulfa drugs (anaphylaxis)</td></tr>
      </table>`,
    )
    expect(content).toContain('Shortness of breath')
    expect(content).toContain('Type 2 diabetes')
    expect(content).toContain('anaphylaxis')
  })

  test('medication administration table — drug data preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<table>
        <caption>Current Medications</caption>
        <thead><tr><th>Medication</th><th>Dose</th><th>Route</th><th>Frequency</th><th>Indication</th></tr></thead>
        <tbody>
          <tr><td>Metformin</td><td>1000 mg</td><td>PO</td><td>BID with meals</td><td>Type 2 DM</td></tr>
          <tr><td>Lisinopril</td><td>10 mg</td><td>PO</td><td>Daily</td><td>HTN</td></tr>
          <tr><td>Furosemide</td><td>40 mg</td><td>PO</td><td>Daily morning</td><td>Fluid retention</td></tr>
        </tbody>
      </table>`,
    )
    expect(content).toContain('Metformin')
    expect(content).toContain('BID with meals')
    expect(content).toContain('Furosemide')
    expect(content).toContain('Fluid retention')
  })

  test('clinical procedure checklist — all steps preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h3>Foley Catheter Insertion — Sterile Technique</h3>
      <ol>
        <li>Verify order and confirm patient identity using two identifiers</li>
        <li>Explain procedure; ensure privacy and patient consent</li>
        <li>Gather supplies: catheter kit, Foley catheter (appropriate size), sterile gloves</li>
        <li>Position patient supine; dorsal recumbent for female patients</li>
        <li>Open kit using sterile technique; don sterile gloves</li>
        <li>Cleanse urethral meatus with provided antiseptic solution</li>
        <li>Insert catheter using sterile technique; advance until urine flows</li>
        <li>Inflate balloon with sterile water per manufacturer specification</li>
        <li>Secure catheter to patient's thigh; connect to closed drainage system</li>
      </ol>`,
    )
    expect(content).toContain('two identifiers')
    expect(content).toContain('sterile technique')
    expect(content).toContain('urethral meatus')
    expect(content).toContain('closed drainage system')
  })

  test('nursing care plan NANDA diagnosis — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h3>Nursing Diagnosis</h3>
      <p><strong>Problem:</strong> Impaired gas exchange related to alveolar-capillary membrane changes secondary to pneumonia, as evidenced by SpO2 88% on room air and use of accessory muscles.</p>
      <p><strong>Goal:</strong> Patient will maintain SpO2 > 94% on supplemental oxygen within 4 hours of nursing interventions.</p>
      <p><strong>Interventions:</strong></p>
      <ul>
        <li>Administer oxygen via nasal cannula at 2L/min as ordered</li>
        <li>Position patient in high Fowler position to maximize lung expansion</li>
        <li>Encourage incentive spirometry every 1-2 hours while awake</li>
      </ul>`,
    )
    expect(content).toContain('alveolar-capillary membrane')
    expect(content).toContain('accessory muscles')
    expect(content).toContain('incentive spirometry')
  })
})
