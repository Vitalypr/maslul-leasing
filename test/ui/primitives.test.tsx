import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Field } from '../../src/ui/Field'
import { Sheet } from '../../src/ui/Sheet'
import { Ledger } from '../../src/ui/Ledger'
import type { MoneyLine } from '../../src/engine/types'

const line = (
  id: string, labelHe: string, annualAmount: number,
): MoneyLine => ({
  id, labelHe, category: 'supplement', annualAmount, treatment: 'net',
  trace: {
    formulaHe: `${id} formula`,
    inputs: {},
    sourceRef: `policy/org.json · ${id}`,
  },
})

const lines = [
  line('upgradeSupplement', 'השתתפות בשדרוג הרכב', 7737.48),
  line('fuel', 'דלק', 9000),
  line('unusedFuelCredit', 'קצובת דלק שלא נוצלה', -5400),
]

describe('<Field>', () => {
  it('labels the control once and binds it by id', () => {
    const html = renderToStaticMarkup(
      <Field label="שכר ברוטו חודשי" htmlFor="salary">
        <input id="salary" />
      </Field>,
    )
    expect(html.match(/<label/g)).toHaveLength(1)
    expect(html).toContain('for="salary"')
    expect(html).toContain('שכר ברוטו חודשי')
  })

  it('marks an unverified value, and only when asked', () => {
    const label = 'מכסת ק"מ שנתית'
    const plain = renderToStaticMarkup(
      <Field label={label} htmlFor="quota"><input id="quota" /></Field>,
    )
    const marked = renderToStaticMarkup(
      <Field label={label} htmlFor="quota" unverified>
        <input id="quota" />
      </Field>,
    )
    expect(plain).not.toContain('לא אומת')
    expect(marked).toContain('לא אומת')
  })
})

describe('<Sheet>', () => {
  it('renders a title only when it is given', () => {
    expect(renderToStaticMarkup(<Sheet><p>x</p></Sheet>)).not.toContain('<h2')
    expect(renderToStaticMarkup(<Sheet title="מה תפסיד"><p>x</p></Sheet>))
      .toContain('מה תפסיד')
  })
})

describe('<Ledger>', () => {
  it('draws one row and one spine bar per line', () => {
    const html = renderToStaticMarkup(
      <Ledger lines={lines} totalAnnual={11337.48} totalLabelHe='סה"כ לשנה' />,
    )
    expect(html.match(/class="line"/g)).toHaveLength(3)
    expect(html.match(/<i /g)).toHaveLength(3)
  })

  it('scales every annual amount by the horizon factor', () => {
    const html = renderToStaticMarkup(
      <Ledger lines={lines} factor={1 / 12} totalAnnual={11337.48}
              totalLabelHe='סה"כ לחודש' />,
    )
    expect(html).toContain('₪645')     // 7,737.48 / 12
    expect(html).toContain('₪945')     // 11,337.48 / 12
  })

  it('wraps every amount in dir="ltr" so the minus stays put', () => {
    const html = renderToStaticMarkup(
      <Ledger lines={lines} totalAnnual={11337.48} totalLabelHe='סה"כ לשנה' />,
    )
    expect(html).toContain('−₪5,400')
    expect(html.match(/dir="ltr"/g)).toHaveLength(4)  // three lines + the total
  })

  it('keeps the trace out of the document until a line is opened', () => {
    const html = renderToStaticMarkup(
      <Ledger lines={lines} totalAnnual={11337.48} totalLabelHe='סה"כ לשנה' />,
    )
    expect(html).not.toContain('upgradeSupplement formula')
    expect(html).toContain('aria-expanded="false"')
  })

  it('shows the closing row with its own label', () => {
    const html = renderToStaticMarkup(
      <Ledger lines={lines} totalAnnual={11337.48} totalLabelHe='סה"כ לשנה' />,
    )
    expect(html).toContain('סה&quot;כ לשנה')
    expect(html).toContain('₪11,337')
  })

  it('renders nothing at all when there are no lines', () => {
    expect(renderToStaticMarkup(
      <Ledger lines={[]} totalAnnual={0} totalLabelHe='סה"כ' />,
    )).toBe('')
  })
})
