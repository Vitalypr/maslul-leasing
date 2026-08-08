# מחשבון ליסינג — תוכנית מימוש

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** אפליקציית ווב סטטית בעברית שמציגה לעובד את העלות הנטו האמיתית של כל רכב בצי הארגוני — לחודש, לשנה ולשלוש שנים — עם פירוק מלא, לצד מה שהוא מוותר עליו אם ייקח רכב.

**Architecture:** מנוע חישוב טהור ב־TypeScript, ללא React וללא DOM, שבנוי כרשימת *תורמים* (contributors) — כל אחד פונקציה טהורה שמחזירה שורות כסף. כל שורת כסף נושאת **סיווג מס מפורש** שנקבע בקובץ מדיניות ולא בקוד, ולכן שינוי "האם רכיב יורד מהברוטו או מהנטו" הוא עריכת מילה אחת. המנוע מחשב בשנתי; חודשי ותלת־שנתי נגזרים ממנו.

**Tech Stack:** Vite · React 19 · TypeScript strict · Tailwind v4 · Zod · Vitest · Heebo + IBM Plex Mono · vite-plugin-pwa

---

## Global Constraints

- כל טקסט בממשק בעברית. `dir="rtl"`. CSS לוגי בלבד (`inline-start`/`inline-end`), אף פעם לא `left`/`right`.
- גופן ממשק: **Heebo**. גופן נתונים ונוסחאות: **IBM Plex Mono**.
- **אין AI slop.** תווית מתייגת, דוגמה מדגימה, ואף אלמנט לא עושה שני דברים. אין משפטי הסבר שאפשר להסיק מהמסך עצמו. אין אימוג'י. אין גרדיאנטים. אין צללים.
- אסור ל־`src/engine/**` לייבא מ־React, מ־DOM או מ־`src/features/**`. נאכף ב־ESLint.
- כל סכום כסף מעוגל ל־2 ספרות בשכבת המנוע (`round2`), ומוצג כשקל שלם.
- כל מספר שאינו מאומת מול הארגון יושב בקובץ מדיניות עם `verified: false` ומסומן בממשק.
- אין שרת ואין מסד נתונים. פלט סטטי בלבד. נתוני עובד ב־`localStorage` בלבד.
- כל ערך של `TaxTreatment` נקבע ב־`policy/org.json`, לעולם לא קשיח בקוד.

---

## החלטות שנסגרו מול הלקוח

| נושא | ההחלטה | מקור |
|---|---|---|
| השתתפות בשדרוג | **נטו** — לא מקטינה שכר חייב | חוזר ביקורת ניכויים 16 של ב"ל, 26.9.2023, בעקבות פס"ד אלביט |
| חריגה מקצובת דלק וכבישי אגרה | **נטו** | אותו חוזר |
| שווי שימוש | מחושב על **הרכב שנבחר בפועל**, לא על רכב הזכאות | הפרדה בין מנגנון המס למנגנון ההשתתפות |
| החזר אגרת רישוי והחזר ביטוח | **נטו בפועל** — המדינה מגלמת את המס | תכ"ם / הוראות שירות המדינה |
| תקרת החזר ביטוח | ₪7,000 לשנה, או ההצעה הזולה מבין שתיים — הנמוך מביניהם | משרד האוצר |
| קצובת דלק | **תקציב חודשי בש"ח מהמעסיק** שהעובד מזין. שני ערכים: בנזין, והיברידי/פלאגין | הלקוח |
| דלק שלא נוצל | מחושב שנתית, מקזז את התוספת, עד גובה התוספת בלבד | הלקוח |
| דרגה | קובעת **רמת שירות ג'/ד' בלבד** | הלקוח |
| פלאגין | נסועה יומית של ימי עבודה על חשמל עד גבול הטווח האמיתי; היתרה השנתית כנסיעות ארוכות על דלק | הלקוח |
| BYD ATTO2 | פלאגין | הלקוח |
| תוספת ג' | `max(0, שיעור_הרכב × מחירון − 2.15% × 135,000)` — אומת מול 43/43 שורות | נגזר מ־`vech_list.pptx` |
| תוספת ד' | `max(0, שיעור_הרכב × מחירון − 2.15% × 155,000)` — צד התקציב תמיד 2.15%, גם ב-2.32% | אותו מקור |
| רמב"י | 50% מהתוספת | אותו מקור |

---

## מבנה הקבצים

```
src/
├─ engine/                          ← TS טהור. אין React, אין DOM.
│  ├─ types.ts                        MoneyLine · TaxTreatment · CalcContext · CalcResult
│  ├─ round.ts                        round2
│  ├─ money.ts                        aggregate() — הופך MoneyLine[] לתוצאה נטו
│  ├─ usage.ts                        פילוח נסועה שנתית, כולל המודל היומי לפלאגין
│  ├─ tax/
│  │  ├─ incomeTax.ts                 מדרגות + נקודות זיכוי
│  │  ├─ socialInsurance.ts           ביטוח לאומי + בריאות
│  │  ├─ usageValue.ts                שווי שימוש
│  │  └─ marginal.ts                  deltaTax() — ההפרש, לא אחוז
│  ├─ contributors/
│  │  ├─ index.ts                     המערך. להוסיף רכיב = שורה אחת.
│  │  ├─ leaseSupplement.ts
│  │  ├─ usageValueTax.ts
│  │  ├─ energy.ts
│  │  ├─ fuelBudget.ts                תקציב, חריגה, וזיכוי לא־מנוצל
│  │  ├─ excessKm.ts
│  │  └─ oneTime.ts
│  ├─ forgone/
│  │  ├─ index.ts
│  │  ├─ licenseFee.ts
│  │  ├─ privateInsurance.ts
│  │  └─ carAllowance.ts
│  └─ calculate.ts                    נקודת הכניסה היחידה
├─ data/
│  ├─ schema/                         סכמות Zod
│  ├─ catalog/fleet-2026.json
│  ├─ policy/org.json
│  ├─ tax-rules/2026.json
│  └─ energy/prices-2026.json
├─ ui/                                Money · Stat · Sheet · Field · Ledger
├─ features/
│  ├─ profile/ catalog/ vehicle/ compare/ admin/
├─ state/
└─ main.tsx
test/
├─ engine/                            unit לכל מודול
└─ golden/                            תרחישי־זהב מקצה לקצה
```

---

# שלב 1 · יסודות המנוע

התשתית שכל השאר יושב עליה. הכי מסוכן, הכי חשוב לבדוק.

---

### Task 1: תשתית הפרויקט וגבול המנוע

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `vitest.config.ts`
- Create: `src/engine/round.ts`
- Test: `test/engine/round.test.ts`

**Interfaces:**
- Produces: `round2(n: number): number`

- [ ] **Step 1: אתחול הפרויקט**

```bash
npm create vite@latest . -- --template react-ts
npm install
npm install -D vitest @vitest/ui eslint-plugin-import
npm install zod
npm install -D tailwindcss @tailwindcss/vite vite-plugin-pwa
```

- [ ] **Step 2: הפעלת מצב strict**

ב־`tsconfig.json`, תחת `compilerOptions`:

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitOverride": true
}
```

- [ ] **Step 3: אכיפת גבול המנוע ב־ESLint**

ב־`eslint.config.js` הוסף:

```js
{
  files: ['src/engine/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['react', 'react-*', '**/features/**', '**/ui/**'],
          message: 'engine must stay pure — no React, no DOM, no UI imports' }
      ]
    }]
  }
}
```

- [ ] **Step 4: כתיבת הבדיקה הנכשלת**

`test/engine/round.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { round2 } from '../../src/engine/round'

describe('round2', () => {
  it('rounds to two decimals', () => {
    expect(round2(644.785)).toBe(644.79)
    expect(round2(214.785)).toBe(214.79)
  })
  it('avoids binary floating point drift', () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })
  it('handles negatives symmetrically', () => {
    expect(round2(-644.785)).toBe(-644.79)
  })
  it('leaves whole numbers alone', () => {
    expect(round2(430)).toBe(430)
  })
})
```

- [ ] **Step 5: הרצה כדי לוודא כישלון**

Run: `npx vitest run test/engine/round.test.ts`
Expected: FAIL — `Cannot find module '../../src/engine/round'`

- [ ] **Step 6: המימוש**

`src/engine/round.ts`:

```ts
/**
 * Rounds to 2 decimals without binary floating-point drift.
 * Math.round(1.005 * 100) gives 100 because 1.005 is stored as 1.00499...
 * The epsilon nudge, applied in the direction of the sign, fixes it.
 */
export function round2(n: number): number {
  const sign = n < 0 ? -1 : 1
  return sign * Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100
}
```

- [ ] **Step 7: הרצה כדי לוודא הצלחה**

Run: `npx vitest run test/engine/round.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite+ts+vitest, enforce engine purity, add round2"
```

---

### Task 2: טיפוסי הליבה וסיווג המס

זו ההחלטה הארכיטקטונית המרכזית. כל שורת כסף נושאת סיווג מס, והצבירה יודעת לטפל בכל סיווג.

**Files:**
- Create: `src/engine/types.ts`
- Create: `src/engine/money.ts`
- Test: `test/engine/money.test.ts`

**Interfaces:**
- Consumes: `round2` מ־Task 1
- Produces: `TaxTreatment`, `MoneyLine`, `Aggregated`, `aggregate(lines, ctx)`

- [ ] **Step 1: הגדרת הטיפוסים**

`src/engine/types.ts`:

```ts
/**
 * How a money line interacts with payroll tax.
 *
 * net            – cash moves; taxable income untouched.
 *                  ILS deductions for vehicle upgrade, fuel overage and toll
 *                  roads must be net (NII audit circular 16, 26.9.2023).
 * gross          – cash moves AND taxable income moves by the same amount.
 *                  A deduction taken pre-tax; costs the employee
 *                  amount x (1 - marginal rate).
 * taxableBenefit – no cash moves; taxable income rises. This is usage value.
 * grossedUp      – cash moves at the stated amount; the employer pays the tax
 *                  on it, so the employee nets exactly the stated amount.
 *                  State vehicle reimbursements work this way.
 */
export type TaxTreatment = 'net' | 'gross' | 'taxableBenefit' | 'grossedUp'

export type LineCategory =
  | 'supplement' | 'tax' | 'energy' | 'fuelBudget'
  | 'mileage' | 'oneTime' | 'forgone'

export type MoneyLine = {
  id: string
  labelHe: string
  category: LineCategory
  /** Annual ILS. Positive = leaves the employee. Negative = reaches them. */
  annualAmount: number
  treatment: TaxTreatment
  trace: {
    formulaHe: string
    inputs: Record<string, number>
    sourceRef: string
  }
}

export type Aggregated = {
  lines: MoneyLine[]
  /** Annual cash the employee actually parts with, before the tax effect. */
  annualCash: number
  /** Annual change to taxable income. */
  annualTaxableDelta: number
  /** Annual tax consequence of that change. Filled by calculate(). */
  annualTaxDelta: number
  /** annualCash + annualTaxDelta */
  annualNet: number
}
```

- [ ] **Step 2: כתיבת הבדיקה הנכשלת**

`test/engine/money.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { splitByTreatment } from '../../src/engine/money'
import type { MoneyLine } from '../../src/engine/types'

const line = (
  id: string, annualAmount: number, treatment: MoneyLine['treatment']
): MoneyLine => ({
  id, labelHe: id, category: 'supplement', annualAmount, treatment,
  trace: { formulaHe: '', inputs: {}, sourceRef: '' }
})

describe('splitByTreatment', () => {
  it('net moves cash only', () => {
    const r = splitByTreatment([line('a', 7737.48, 'net')])
    expect(r.cash).toBe(7737.48)
    expect(r.taxableDelta).toBe(0)
  })

  it('taxableBenefit moves taxable income only', () => {
    const r = splitByTreatment([line('uv', 43574.4, 'taxableBenefit')])
    expect(r.cash).toBe(0)
    expect(r.taxableDelta).toBe(43574.4)
  })

  it('gross moves cash out and taxable income down by the same amount', () => {
    const r = splitByTreatment([line('pre', 5000, 'gross')])
    expect(r.cash).toBe(5000)
    expect(r.taxableDelta).toBe(-5000)
  })

  it('grossedUp moves cash without touching taxable income', () => {
    const r = splitByTreatment([line('refund', -7000, 'grossedUp')])
    expect(r.cash).toBe(-7000)
    expect(r.taxableDelta).toBe(0)
  })

  it('combines a realistic ledger', () => {
    const r = splitByTreatment([
      line('supplement', 7737.48, 'net'),
      line('usageValue', 43574.4, 'taxableBenefit'),
      line('fuelCredit', -5400, 'net'),
    ])
    expect(r.cash).toBe(2337.48)
    expect(r.taxableDelta).toBe(43574.4)
  })
})
```

- [ ] **Step 3: הרצה כדי לוודא כישלון**

Run: `npx vitest run test/engine/money.test.ts`
Expected: FAIL — `splitByTreatment is not a function`

- [ ] **Step 4: המימוש**

`src/engine/money.ts`:

```ts
import { round2 } from './round'
import type { MoneyLine } from './types'

export function splitByTreatment(lines: MoneyLine[]): {
  cash: number; taxableDelta: number
} {
  let cash = 0
  let taxableDelta = 0
  for (const l of lines) {
    switch (l.treatment) {
      case 'net':
      case 'grossedUp':
        cash += l.annualAmount
        break
      case 'gross':
        cash += l.annualAmount
        taxableDelta -= l.annualAmount
        break
      case 'taxableBenefit':
        taxableDelta += l.annualAmount
        break
    }
  }
  return { cash: round2(cash), taxableDelta: round2(taxableDelta) }
}
```

- [ ] **Step 5: הרצה כדי לוודא הצלחה**

Run: `npx vitest run test/engine/money.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/engine/money.ts test/engine/money.test.ts
git commit -m "feat(engine): MoneyLine with explicit tax treatment, treatment-aware split"
```

---

### Task 3: מס הכנסה, ביטוח לאומי, והמס השולי האמיתי

**Files:**
- Create: `src/engine/tax/incomeTax.ts`, `src/engine/tax/socialInsurance.ts`, `src/engine/tax/marginal.ts`
- Create: `src/data/tax-rules/2026.json`
- Test: `test/engine/tax.test.ts`

**Interfaces:**
- Produces: `incomeTaxMonthly(monthly, points, rules)`, `socialInsuranceMonthly(monthly, rules)`, `deltaTaxAnnual(annualSalary, annualTaxableDelta, points, rules)`

- [ ] **Step 1: קובץ חוקי המס**

`src/data/tax-rules/2026.json`:

```json
{
  "year": 2026,
  "effectiveFrom": "2026-01-01",
  "sourceUrl": "https://www.gov.il/he/service/itc-mm_usecar10",
  "usageValue": {
    "linearRate": 0.0248,
    "listPriceCeiling": 596860,
    "monthlyDeduction": { "ice": 0, "mhev": 0, "hybrid": 560, "phev": 1130, "bev": 1350 },
    "verified": true
  },
  "incomeTaxMonthlyBrackets": [
    { "upTo": 7010,  "rate": 0.10 },
    { "upTo": 10060, "rate": 0.14 },
    { "upTo": 19000, "rate": 0.20 },
    { "upTo": 25100, "rate": 0.31 },
    { "upTo": 46690, "rate": 0.35 },
    { "upTo": 58190, "rate": 0.47 },
    { "upTo": null,  "rate": 0.50 }
  ],
  "bracketsVerified": false,
  "bracketsNote": "20% ו-31% אומתו מול הרפורמה. גבולות 10% ו-14% הוסקו מ-2025 וטעונים אימות.",
  "creditPointValueMonthly": 242,

  "nationalInsuranceMonthlyBrackets": [
    { "upTo": 7703,  "rate": 0.0104 },
    { "upTo": 51910, "rate": 0.07 },
    { "upTo": null,  "rate": 0 }
  ],
  "healthInsuranceMonthlyBrackets": [
    { "upTo": 7703,  "rate": 0.0323 },
    { "upTo": 51910, "rate": 0.0517 },
    { "upTo": null,  "rate": 0 }
  ],
  "socialInsuranceVerified": true,
  "socialInsuranceNote": "חלק העובד 2026: 4.27% עד 7,703 ו-12.17% עד תקרה של 51,910. מוחזק מפוצל לביטוח לאומי (1.04/7) ובריאות (3.23/5.17) כדי שהפירוט יוכל להציג את שניהם. 1.04+3.23=4.27, 7+5.17=12.17."
}
```

- [ ] **Step 2: כתיבת הבדיקות הנכשלות**

`test/engine/tax.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import rules from '../../src/data/tax-rules/2026.json'
import { incomeTaxMonthly } from '../../src/engine/tax/incomeTax'
import { socialInsuranceMonthly } from '../../src/engine/tax/socialInsurance'
import { deltaTaxAnnual } from '../../src/engine/tax/marginal'

describe('incomeTaxMonthly', () => {
  it('is zero when credit points exceed the tax due', () => {
    // 5,000 -> 500 tax; 2.25 points = 544.50 credit
    expect(incomeTaxMonthly(5000, 2.25, rules)).toBe(0)
  })

  it('walks the brackets cumulatively, not at a flat rate', () => {
    // 7010*.10=701 + 3050*.14=427 + 1940*.20=388  => 1516, minus 544.50
    expect(incomeTaxMonthly(12000, 2.25, rules)).toBe(971.5)
  })

  it('applies the top bracket above the surtax threshold', () => {
    const t = incomeTaxMonthly(60000, 2.25, rules)
    const justBelow = incomeTaxMonthly(58190, 2.25, rules)
    expect(round(t - justBelow)).toBe(round((60000 - 58190) * 0.50))
  })
})

describe('socialInsuranceMonthly', () => {
  it('uses the combined reduced rate of 4.27% below the threshold', () => {
    // 5000 * (0.0104 + 0.0323) = 213.50
    expect(socialInsuranceMonthly(5000, rules)).toBe(213.5)
  })

  it('uses the combined full rate of 12.17% above the threshold', () => {
    // 7703*0.0427 = 328.9181 ; 44207*0.1217 = 5379.9919
    expect(socialInsuranceMonthly(51910, rules)).toBeCloseTo(5708.91, 2)
  })

  it('stops charging above the ceiling of 51,910', () => {
    expect(socialInsuranceMonthly(51910, rules)).toBe(socialInsuranceMonthly(80000, rules))
  })

  it('reports the two components separately and they sum to the total', () => {
    const parts = socialInsuranceParts(30000, rules)
    expect(round(parts.nationalInsurance + parts.healthInsurance))
      .toBe(socialInsuranceMonthly(30000, rules))
  })
})

describe('deltaTaxAnnual', () => {
  it('is the difference of two full computations, never a flat percentage', () => {
    const salary = 28400 * 12
    const uv = 3631.2 * 12
    const d = deltaTaxAnnual(salary, uv, 2.25, rules)
    const flat = uv * 0.35
    expect(d).not.toBe(flat)
    expect(d).toBeGreaterThan(0)
  })

  it('captures a bracket crossing', () => {
    // 18,900/mo sits just under the 19,000 boundary; adding 400 crosses it,
    // so part is taxed at 20% and part at 31%.
    const d = deltaTaxAnnual(18900 * 12, 400 * 12, 2.25, rules)
    const allAt20 = 400 * 12 * 0.20
    const allAt31 = 400 * 12 * 0.31
    expect(d).toBeGreaterThan(allAt20)
    expect(d).toBeLessThan(allAt31 + 400 * 12 * 0.12 + 1)
  })

  it('returns zero for no change', () => {
    expect(deltaTaxAnnual(28400 * 12, 0, 2.25, rules)).toBe(0)
  })

  it('is negative for a pre-tax deduction', () => {
    expect(deltaTaxAnnual(28400 * 12, -5000, 2.25, rules)).toBeLessThan(0)
  })
})

const round = (n: number) => Math.round(n * 100) / 100
```

- [ ] **Step 3: הרצה כדי לוודא כישלון**

Run: `npx vitest run test/engine/tax.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 4: מימוש מס הכנסה**

`src/engine/tax/incomeTax.ts`:

```ts
import { round2 } from '../round'

export type Bracket = { upTo: number | null; rate: number }
export type TaxRules = {
  incomeTaxMonthlyBrackets: Bracket[]
  socialInsuranceMonthlyBrackets: Bracket[]
  creditPointValueMonthly: number
}

export function bracketTax(monthly: number, brackets: Bracket[]): number {
  let tax = 0
  let prev = 0
  for (const b of brackets) {
    const cap = b.upTo ?? Infinity
    if (monthly <= prev) break
    tax += (Math.min(monthly, cap) - prev) * b.rate
    prev = cap
  }
  return tax
}

export function incomeTaxMonthly(
  monthly: number, creditPoints: number, rules: TaxRules
): number {
  const gross = bracketTax(monthly, rules.incomeTaxMonthlyBrackets)
  const credit = creditPoints * rules.creditPointValueMonthly
  return round2(Math.max(0, gross - credit))
}
```

- [ ] **Step 5: מימוש ביטוח לאומי**

`src/engine/tax/socialInsurance.ts`:

```ts
import { round2 } from '../round'
import { bracketTax, type TaxRules } from './incomeTax'

/**
 * Employee-side contributions for 2026: 4.27% up to 7,703 and 12.17% from
 * there to the 51,910 ceiling.
 *
 * The two statutory components are held separately in the rules file rather
 * than pre-summed, so the breakdown can show each one. National insurance is
 * 1.04% / 7%; health is 3.23% / 5.17%. They add to the headline rates.
 *
 * The ceiling is encoded as a final zero-rate bracket, not as a max().
 */
export function socialInsuranceParts(
  monthly: number, rules: TaxRules
): { nationalInsurance: number; healthInsurance: number } {
  return {
    nationalInsurance: round2(bracketTax(monthly, rules.nationalInsuranceMonthlyBrackets)),
    healthInsurance:   round2(bracketTax(monthly, rules.healthInsuranceMonthlyBrackets)),
  }
}

export function socialInsuranceMonthly(monthly: number, rules: TaxRules): number {
  const p = socialInsuranceParts(monthly, rules)
  return round2(p.nationalInsurance + p.healthInsurance)
}
```

וב־`incomeTax.ts`, `TaxRules` מקבל את שני המערכים במקום `socialInsuranceMonthlyBrackets`:

```ts
export type TaxRules = {
  incomeTaxMonthlyBrackets: Bracket[]
  nationalInsuranceMonthlyBrackets: Bracket[]
  healthInsuranceMonthlyBrackets: Bracket[]
  creditPointValueMonthly: number
}
```

- [ ] **Step 6: מימוש המס השולי**

`src/engine/tax/marginal.ts`:

```ts
import { round2 } from '../round'
import { incomeTaxMonthly, type TaxRules } from './incomeTax'
import { socialInsuranceMonthly } from './socialInsurance'

function totalMonthly(monthly: number, points: number, rules: TaxRules): number {
  return incomeTaxMonthly(monthly, points, rules)
       + socialInsuranceMonthly(monthly, rules)
}

/**
 * The tax consequence of adding `annualTaxableDelta` on top of the salary.
 *
 * This is deliberately a difference of two full computations rather than
 * amount x marginal-rate. The addition can cross a bracket boundary or the
 * national-insurance ceiling, and a flat percentage silently gets those wrong.
 */
export function deltaTaxAnnual(
  annualSalary: number,
  annualTaxableDelta: number,
  creditPoints: number,
  rules: TaxRules
): number {
  if (annualTaxableDelta === 0) return 0
  const base = annualSalary / 12
  const after = (annualSalary + annualTaxableDelta) / 12
  const delta = totalMonthly(after, creditPoints, rules)
              - totalMonthly(base, creditPoints, rules)
  return round2(delta * 12)
}
```

- [ ] **Step 7: הרצה כדי לוודא הצלחה**

Run: `npx vitest run test/engine/tax.test.ts`
Expected: PASS — 9 tests

- [ ] **Step 8: Commit**

```bash
git add src/engine/tax src/data/tax-rules test/engine/tax.test.ts
git commit -m "feat(engine): income tax, national insurance, true marginal delta"
```

---

### Task 4: שווי שימוש

**Files:**
- Create: `src/engine/tax/usageValue.ts`
- Test: `test/engine/usageValue.test.ts`

**Interfaces:**
- Produces: `usageValueMonthly(listPrice, powertrain, rules): number`

- [ ] **Step 1: כתיבת הבדיקה הנכשלת**

`test/engine/usageValue.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import rules from '../../src/data/tax-rules/2026.json'
import { usageValueMonthly } from '../../src/engine/tax/usageValue'

describe('usageValueMonthly', () => {
  it('is 2.48% of list price for petrol', () => {
    expect(usageValueMonthly(178000, 'ice', rules)).toBe(4414.4)
  })

  it('subtracts 560 for a hybrid', () => {
    expect(usageValueMonthly(169000, 'hybrid', rules)).toBe(3631.2)
  })

  it('subtracts 1130 for a plug-in', () => {
    expect(usageValueMonthly(195000, 'phev', rules)).toBe(3706)
  })

  it('gives mild hybrid no reduction — it is not a hybrid for tax', () => {
    expect(usageValueMonthly(150990, 'mhev', rules))
      .toBe(usageValueMonthly(150990, 'ice', rules))
  })

  it('caps the list price at the ceiling', () => {
    expect(usageValueMonthly(900000, 'ice', rules))
      .toBe(usageValueMonthly(596860, 'ice', rules))
  })

  it('never goes below zero', () => {
    expect(usageValueMonthly(30000, 'bev', rules)).toBe(0)
  })

  it('uses the chosen vehicle price, not any entitlement cap', () => {
    // A 155,000 car is taxed as a 155,000 car even if entitlement is 135,000.
    expect(usageValueMonthly(155000, 'ice', rules)).toBe(3844)
  })
})
```

- [ ] **Step 2: הרצה כדי לוודא כישלון**

Run: `npx vitest run test/engine/usageValue.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: המימוש**

`src/engine/tax/usageValue.ts`:

```ts
import { round2 } from '../round'

export type Powertrain = 'ice' | 'mhev' | 'hybrid' | 'phev' | 'bev'

export type UsageValueRules = {
  usageValue: {
    linearRate: number
    listPriceCeiling: number
    monthlyDeduction: Record<Powertrain, number>
  }
}

export function usageValueMonthly(
  listPrice: number, powertrain: Powertrain, rules: UsageValueRules
): number {
  const { linearRate, listPriceCeiling, monthlyDeduction } = rules.usageValue
  const base = Math.min(listPrice, listPriceCeiling) * linearRate
  return round2(Math.max(0, base - monthlyDeduction[powertrain]))
}
```

- [ ] **Step 4: הרצה כדי לוודא הצלחה**

Run: `npx vitest run test/engine/usageValue.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/engine/tax/usageValue.ts test/engine/usageValue.test.ts
git commit -m "feat(engine): usage value with powertrain reductions and price ceiling"
```

---

# שלב 2 · פילוח נסועה ותורמי העלות

---

### Task 5: פילוח נסועה, כולל המודל היומי לפלאגין

זה החלק שקובע את דיוק הפלאגין. המודל: הנסיעה היומית של ימי העבודה רצה על חשמל עד גבול הטווח האמיתי; מה שנשאר מהנסועה השנתית הוא נסיעות ארוכות ורץ על דלק.

**Files:**
- Create: `src/engine/usage.ts`
- Test: `test/engine/usage.test.ts`

**Interfaces:**
- Produces: `splitAnnualKm(input): UsageSplit`

```ts
type UsageInput = {
  annualKm: number
  commuteOneWayKm: number
  workDaysPerMonth: number
  powertrain: Powertrain
  chargesDaily: boolean
  manufacturerEvRangeKm: number | null
  realEvRangeKm: number | null       // overrides the factor when present
  realWorldRangeFactor: number       // from policy, e.g. 0.70
}
type UsageSplit = {
  annualKm: number; evKm: number; iceKm: number
  dailyCommuteKm: number; workDaysPerYear: number
  dailyPortionKm: number; longTripKm: number; effectiveEvRangeKm: number
}
```

- [ ] **Step 1: כתיבת הבדיקות הנכשלות**

`test/engine/usage.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { splitAnnualKm } from '../../src/engine/usage'

const base = {
  annualKm: 26000, commuteOneWayKm: 34, workDaysPerMonth: 21,
  chargesDaily: true, manufacturerEvRangeKm: 58,
  realEvRangeKm: null, realWorldRangeFactor: 0.70,
}

describe('splitAnnualKm', () => {
  it('puts every km on petrol for an ICE car', () => {
    const r = splitAnnualKm({ ...base, powertrain: 'ice' })
    expect(r.iceKm).toBe(26000)
    expect(r.evKm).toBe(0)
  })

  it('puts every km on electricity for a BEV', () => {
    const r = splitAnnualKm({ ...base, powertrain: 'bev' })
    expect(r.evKm).toBe(26000)
    expect(r.iceKm).toBe(0)
  })

  it('derives the real EV range from the factor', () => {
    const r = splitAnnualKm({ ...base, powertrain: 'phev' })
    expect(r.effectiveEvRangeKm).toBe(40.6)   // 58 * 0.70
  })

  it('prefers a per-model real range over the factor', () => {
    const r = splitAnnualKm({ ...base, powertrain: 'phev', realEvRangeKm: 45 })
    expect(r.effectiveEvRangeKm).toBe(45)
  })

  it('runs the daily commute on electricity up to the range, rest on petrol', () => {
    const r = splitAnnualKm({ ...base, powertrain: 'phev' })
    // 68 km/day, 252 workdays => 17,136 km of daily driving
    expect(r.dailyCommuteKm).toBe(68)
    expect(r.workDaysPerYear).toBe(252)
    expect(r.dailyPortionKm).toBe(17136)
    // 26,000 - 17,136 = 8,864 km of long trips, all petrol
    expect(r.longTripKm).toBe(8864)
    // 40.6 EV km/day * 252 = 10,231.2
    expect(r.evKm).toBeCloseTo(10231.2, 1)
    expect(r.iceKm).toBeCloseTo(26000 - 10231.2, 1)
  })

  it('never splits more kilometres than were driven', () => {
    const r = splitAnnualKm({ ...base, powertrain: 'phev' })
    expect(r.evKm + r.iceKm).toBeCloseTo(26000, 2)
  })

  it('caps the daily EV share at the daily distance, not the range', () => {
    // 5 km commute, 40.6 km of range — only 10 km/day can be electric
    const r = splitAnnualKm({ ...base, powertrain: 'phev', commuteOneWayKm: 5 })
    expect(r.evKm).toBeCloseTo(10 * 252, 1)
  })

  it('runs a plug-in entirely on petrol when the driver will not charge', () => {
    const r = splitAnnualKm({ ...base, powertrain: 'phev', chargesDaily: false })
    expect(r.evKm).toBe(0)
    expect(r.iceKm).toBe(26000)
  })

  it('clamps long trips at zero when commuting exceeds annual km', () => {
    const r = splitAnnualKm({ ...base, powertrain: 'phev', annualKm: 10000 })
    expect(r.longTripKm).toBe(0)
    expect(r.evKm + r.iceKm).toBeCloseTo(10000, 2)
  })
})
```

- [ ] **Step 2: הרצה כדי לוודא כישלון**

Run: `npx vitest run test/engine/usage.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: המימוש**

`src/engine/usage.ts`:

```ts
import { round2 } from './round'
import type { Powertrain } from './tax/usageValue'

export type UsageInput = {
  annualKm: number
  commuteOneWayKm: number
  workDaysPerMonth: number
  powertrain: Powertrain
  chargesDaily: boolean
  manufacturerEvRangeKm: number | null
  realEvRangeKm: number | null
  realWorldRangeFactor: number
}

export type UsageSplit = {
  annualKm: number
  evKm: number
  iceKm: number
  dailyCommuteKm: number
  workDaysPerYear: number
  dailyPortionKm: number
  longTripKm: number
  effectiveEvRangeKm: number
}

export function splitAnnualKm(i: UsageInput): UsageSplit {
  const dailyCommuteKm = i.commuteOneWayKm * 2
  const workDaysPerYear = i.workDaysPerMonth * 12
  const dailyPortionKm = Math.min(dailyCommuteKm * workDaysPerYear, i.annualKm)
  const longTripKm = round2(i.annualKm - dailyPortionKm)

  const effectiveEvRangeKm =
    i.realEvRangeKm ??
    round2((i.manufacturerEvRangeKm ?? 0) * i.realWorldRangeFactor)

  const shell = {
    annualKm: i.annualKm, dailyCommuteKm, workDaysPerYear,
    dailyPortionKm, longTripKm, effectiveEvRangeKm,
  }

  if (i.powertrain === 'bev') {
    return { ...shell, evKm: i.annualKm, iceKm: 0 }
  }
  if (i.powertrain !== 'phev' || !i.chargesDaily) {
    return { ...shell, evKm: 0, iceKm: i.annualKm }
  }

  // The battery covers at most one full charge per working day, and never
  // more than the distance actually driven that day. Long trips exceed the
  // battery by definition, so they stay on petrol.
  const evPerDay = Math.min(dailyCommuteKm, effectiveEvRangeKm)
  const evKm = round2(Math.min(evPerDay * workDaysPerYear, dailyPortionKm))
  return { ...shell, evKm, iceKm: round2(i.annualKm - evKm) }
}
```

- [ ] **Step 4: הרצה כדי לוודא הצלחה**

Run: `npx vitest run test/engine/usage.test.ts`
Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/engine/usage.ts test/engine/usage.test.ts
git commit -m "feat(engine): annual km split with daily-charge model for plug-in hybrids"
```

---

### Task 6: תורם ההשתתפות בשדרוג

**Files:**
- Create: `src/engine/contributors/leaseSupplement.ts`
- Create: `src/data/policy/org.json`
- Test: `test/engine/leaseSupplement.test.ts`

**Interfaces:**
- Produces: `leaseSupplement(ctx): MoneyLine[]`, `supplementMonthly(listPrice, tier, rate, policy)`

- [ ] **Step 1: קובץ המדיניות**

`src/data/policy/org.json`:

```json
{
  "version": "2026-08-08",
  "adminPasscode": "0000",

  "supplement": {
    "budgetByTier": { "C": 135000, "D": 155000 },
    "defaultRate": 0.0215,
    "highRate": 0.0232,
    "highRateThreshold": null,
    "rambiDiscount": 0.50,
    "verified": true,
    "note": "הנוסחה אומתה מול 43/43 שורות המחירון. סף השיעור הגבוה לא הוכרע — כל עוד highRateThreshold הוא null, נעשה שימוש בשיעור שרשום בקטלוג לכל רכב."
  },

  "gradesToTier": { "verified": false, "map": {} },

  "mileage": {
    "annualQuotaKm": 24000,
    "excessRatePerKm": 0.40,
    "creditForUnusedKm": false,
    "verified": false
  },

  "contract": { "termMonths": 36, "verified": false },

  "fuel": {
    "employeeEntersBudget": true,
    "defaultMonthlyBudgetIce": 0,
    "defaultMonthlyBudgetElectrified": 0,
    "unusedCreditEnabled": true,
    "unusedCreditCappedAtSupplement": true,
    "verified": true
  },

  "phev": { "realWorldRangeFactor": 0.70, "verified": false },

  "forgone": {
    "licenseFeeAnnual":       { "annual": 0,    "enabled": true, "verified": false,
                                "labelHe": "החזר אגרת רישוי" },
    "privateInsuranceAnnual": { "annual": 7000, "enabled": true, "verified": true,
                                "labelHe": "השתתפות בביטוח רכב פרטי",
                                "note": "ההצעה הזולה מבין שתיים או 7,000 ₪, הנמוך מביניהם" },
    "serviceVehicleTierC":    { "monthly": 0,   "enabled": true, "verified": false,
                                "labelHe": "רכב שירות ג'" },
    "fixedNetAllowance":      { "monthly": 0,   "enabled": true, "verified": false,
                                "labelHe": "קבועות נטו" },
    "variableNetAllowance":   { "monthly": 0,   "enabled": true, "verified": false,
                                "labelHe": "משת.רגי.נטו" }
  },

  "taxTreatment": {
    "upgradeSupplement":          "net",
    "excessKm":                   "net",
    "fuelOverage":                "net",
    "unusedFuelCredit":           "net",
    "homeChargingRefund":         "net",
    "usageValue":                 "taxableBenefit",
    "oneTime":                    "net",
    "forgoneLicenseFee":          "grossedUp",
    "forgoneInsurance":           "grossedUp",
    "forgoneServiceVehicleTierC": "gross",
    "forgoneFixedNet":            "grossedUp",
    "forgoneVariableNet":         "grossedUp",
    "verified": {
      "upgradeSupplement": true,
      "excessKm": true,
      "fuelOverage": true,
      "forgoneLicenseFee": false,
      "forgoneInsurance": false,
      "forgoneServiceVehicleTierC": true,
      "forgoneFixedNet": true,
      "forgoneVariableNet": true
    },
    "sourceRef": "חוזר ביקורת ניכויים 16 של הביטוח הלאומי, 26.9.2023, בעקבות פס\"ד אלביט מערכות. פיצול רכיבי הרכב הפרטי נגזר מתלוש אמיתי: 'רכב שירות ג'' הוא רכיב ברוטו, 'קבועות נטו' ו'משת.רגי.נטו' הם רכיבי נטו מגולמים. אגרת רישוי וביטוח מגולמים לפי תכ\"ם — לא אומת ספציפית לכנסת."
  }
}
```

- [ ] **Step 2: כתיבת הבדיקות הנכשלות**

`test/engine/leaseSupplement.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import policy from '../../src/data/policy/org.json'
import { supplementMonthly } from '../../src/engine/contributors/leaseSupplement'

describe('supplementMonthly', () => {
  it('is zero at or below the tier C budget', () => {
    expect(supplementMonthly(135000, 'C', 0.0215, false, policy)).toBe(0)
    expect(supplementMonthly(120990, 'C', 0.0215, false, policy)).toBe(0)
  })

  it('matches the published table for tier C', () => {
    expect(supplementMonthly(135990, 'C', 0.0215, false, policy)).toBe(21.29)
    expect(supplementMonthly(164990, 'C', 0.0215, false, policy)).toBe(644.79)
    expect(supplementMonthly(184990, 'C', 0.0215, false, policy)).toBe(1074.79)
  })

  it('matches the published table for tier D', () => {
    expect(supplementMonthly(155888, 'D', 0.0215, false, policy)).toBe(19.09)
    expect(supplementMonthly(164990, 'D', 0.0215, false, policy)).toBe(214.79)
    expect(supplementMonthly(154990, 'D', 0.0215, false, policy)).toBe(0)
  })

  it('keeps tier C and tier D exactly 430 apart once both are positive', () => {
    const c = supplementMonthly(176888, 'C', 0.0215, false, policy)
    const d = supplementMonthly(176888, 'D', 0.0215, false, policy)
    expect(c - d).toBeCloseTo(430, 2)
  })

  it('applies the vehicle-specific high rate', () => {
    expect(supplementMonthly(229990, 'C', 0.0232, false, policy)).toBe(2433.27)
    expect(supplementMonthly(189990, 'C', 0.0232, false, policy)).toBe(1505.27)
  })

  it('halves the amount for a rambi-eligible employee', () => {
    expect(supplementMonthly(229990, 'C', 0.0232, true, policy)).toBe(1216.64)
  })
})
```

- [ ] **Step 3: הרצה כדי לוודא כישלון**

Run: `npx vitest run test/engine/leaseSupplement.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: המימוש**

`src/engine/contributors/leaseSupplement.ts`:

```ts
import { round2 } from '../round'
import type { MoneyLine } from '../types'
import type { CalcContext } from '../calculate'

export type ServiceTier = 'C' | 'D'

type SupplementPolicy = {
  supplement: {
    budgetByTier: Record<ServiceTier, number>
    defaultRate: number
    highRate: number
    highRateThreshold: number | null
    rambiDiscount: number
  }
}

/**
 * The published table reproduces exactly as rate x (price - tier budget).
 * Tier C budget 135,000, tier D budget 155,000 — the constant 430 gap in the
 * source table is simply 2.15% of the 20,000 difference between them.
 */
export function supplementMonthly(
  listPrice: number,
  tier: ServiceTier,
  vehicleRate: number,
  rambiEligible: boolean,
  policy: SupplementPolicy
): number {
  const { budgetByTier, highRate, highRateThreshold, rambiDiscount } = policy.supplement
  const rate = highRateThreshold !== null && listPrice > highRateThreshold
    ? highRate
    : vehicleRate
  const over = Math.max(0, listPrice - budgetByTier[tier])
  const gross = rate * over
  return round2(rambiEligible ? gross * (1 - rambiDiscount) : gross)
}

export function leaseSupplement(ctx: CalcContext): MoneyLine[] {
  const monthly = supplementMonthly(
    ctx.vehicle.listPrice, ctx.employee.serviceTier,
    ctx.vehicle.supplementRate, ctx.employee.rambiEligible, ctx.policy
  )
  if (monthly === 0) return []
  return [{
    id: 'upgradeSupplement',
    labelHe: 'השתתפות בשדרוג הרכב',
    category: 'supplement',
    annualAmount: round2(monthly * 12),
    treatment: ctx.policy.taxTreatment.upgradeSupplement,
    trace: {
      formulaHe:
        `${fmt(ctx.vehicle.listPrice)} − ${fmt(ctx.policy.supplement.budgetByTier[ctx.employee.serviceTier])}` +
        ` = ${fmt(Math.max(0, ctx.vehicle.listPrice - ctx.policy.supplement.budgetByTier[ctx.employee.serviceTier]))}\n` +
        `× ${(ctx.vehicle.supplementRate * 100).toFixed(2)}% = ${monthly.toFixed(2)} ₪ לחודש` +
        (ctx.employee.rambiEligible ? `\nזכאות רמב"י: הנחה של 50%` : ''),
      inputs: { listPrice: ctx.vehicle.listPrice, monthly },
      sourceRef: 'policy/org.json · supplement',
    },
  }]
}

const fmt = (n: number) => n.toLocaleString('en-US')
```

- [ ] **Step 5: הרצה כדי לוודא הצלחה**

Run: `npx vitest run test/engine/leaseSupplement.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 6: Commit**

```bash
git add src/engine/contributors/leaseSupplement.ts src/data/policy/org.json test/engine/leaseSupplement.test.ts
git commit -m "feat(engine): upgrade supplement, verified against all 43 catalogue rows"
```

---

### Task 7: אנרגיה, תקציב דלק, וזיכוי דלק שלא נוצל

הכלל שביקשת: דלק שלא נוצל מחושב שנתית ומקזז את התוספת, עד גובה התוספת בלבד.

**Files:**
- Create: `src/engine/contributors/energy.ts`, `src/engine/contributors/fuelBudget.ts`
- Create: `src/data/energy/prices-2026.json`
- Test: `test/engine/fuelBudget.test.ts`

**Interfaces:**
- Consumes: `UsageSplit` מ־Task 5, `supplementMonthly` מ־Task 6
- Produces: `energyCostAnnual(split, vehicle, prices)`, `fuelBudget(ctx)`

- [ ] **Step 1: קובץ מחירי אנרגיה**

`src/data/energy/prices-2026.json`:

```json
{
  "petrol95PerLiter": 7.41,
  "homeElectricityPerKwh": 0.62,
  "asOf": "2026-08-01",
  "verified": false
}
```

- [ ] **Step 2: כתיבת הבדיקות הנכשלות**

`test/engine/fuelBudget.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { unusedFuelCredit } from '../../src/engine/contributors/fuelBudget'

describe('unusedFuelCredit', () => {
  it('credits the unused part of the budget', () => {
    // budget 14,400/yr, spent 9,000 -> 5,400 unused; supplement 7,737 covers it
    expect(unusedFuelCredit(14400, 9000, 7737.48)).toBe(5400)
  })

  it('caps the credit at the annual supplement', () => {
    expect(unusedFuelCredit(14400, 2000, 7737.48)).toBe(7737.48)
  })

  it('pays nothing when there is no supplement to offset', () => {
    expect(unusedFuelCredit(14400, 2000, 0)).toBe(0)
  })

  it('pays nothing when the budget was overspent', () => {
    expect(unusedFuelCredit(9000, 14400, 7737.48)).toBe(0)
  })

  it('pays nothing when the budget was spent exactly', () => {
    expect(unusedFuelCredit(9000, 9000, 7737.48)).toBe(0)
  })

  it('never returns a negative credit', () => {
    expect(unusedFuelCredit(0, 5000, 7737.48)).toBe(0)
  })
})
```

- [ ] **Step 3: הרצה כדי לוודא כישלון**

Run: `npx vitest run test/engine/fuelBudget.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: מימוש עלות האנרגיה**

`src/engine/contributors/energy.ts`:

```ts
import { round2 } from '../round'
import type { UsageSplit } from '../usage'

export type EnergyPrices = { petrol95PerLiter: number; homeElectricityPerKwh: number }
export type VehicleConsumption = {
  kmPerLiter?: number
  kmPerLiterHybridMode?: number
  kwhPer100km?: number
}

export function energyCostAnnual(
  split: UsageSplit, cons: VehicleConsumption, prices: EnergyPrices
): { petrolCost: number; electricityCost: number; liters: number; kwh: number } {
  const kpl = cons.kmPerLiterHybridMode ?? cons.kmPerLiter ?? 0
  const liters = kpl > 0 ? split.iceKm / kpl : 0
  const kwh = cons.kwhPer100km ? (split.evKm * cons.kwhPer100km) / 100 : 0
  return {
    liters: round2(liters),
    kwh: round2(kwh),
    petrolCost: round2(liters * prices.petrol95PerLiter),
    electricityCost: round2(kwh * prices.homeElectricityPerKwh),
  }
}
```

- [ ] **Step 5: מימוש הזיכוי**

`src/engine/contributors/fuelBudget.ts`:

```ts
import { round2 } from '../round'

/**
 * Fuel the employer budgeted but the employee did not burn is settled once a
 * year and offsets the upgrade supplement — but only up to the supplement.
 * There is no cash payout beyond it, and none at all when no supplement exists.
 */
export function unusedFuelCredit(
  annualBudget: number, annualSpend: number, annualSupplement: number
): number {
  const unused = Math.max(0, annualBudget - annualSpend)
  return round2(Math.min(unused, Math.max(0, annualSupplement)))
}
```

- [ ] **Step 6: הרצה כדי לוודא הצלחה**

Run: `npx vitest run test/engine/fuelBudget.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 7: Commit**

```bash
git add src/engine/contributors/energy.ts src/engine/contributors/fuelBudget.ts src/data/energy test/engine/fuelBudget.test.ts
git commit -m "feat(engine): energy cost and annual unused-fuel credit capped at the supplement"
```

---

### Task 8: חריגת קילומטראז' ומרשם התורמים

**Files:**
- Create: `src/engine/contributors/excessKm.ts`, `src/engine/contributors/index.ts`
- Test: `test/engine/excessKm.test.ts`

**Interfaces:**
- Produces: `excessKmAnnual(annualKm, quota, rate)`, `CONTRIBUTORS: Contributor[]`

- [ ] **Step 1: כתיבת הבדיקה הנכשלת**

`test/engine/excessKm.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { excessKmAnnual } from '../../src/engine/contributors/excessKm'

describe('excessKmAnnual', () => {
  it('charges nothing inside the quota', () => {
    expect(excessKmAnnual(20000, 24000, 0.40)).toBe(0)
  })
  it('charges nothing exactly at the quota', () => {
    expect(excessKmAnnual(24000, 24000, 0.40)).toBe(0)
  })
  it('charges the rate on every kilometre over', () => {
    expect(excessKmAnnual(26000, 24000, 0.40)).toBe(800)
  })
  it('is a step, not a slope — one km over already costs', () => {
    expect(excessKmAnnual(24001, 24000, 0.40)).toBe(0.4)
  })
})
```

- [ ] **Step 2: הרצה כדי לוודא כישלון**

Run: `npx vitest run test/engine/excessKm.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: המימוש**

`src/engine/contributors/excessKm.ts`:

```ts
import { round2 } from '../round'

export function excessKmAnnual(
  annualKm: number, quotaKm: number, ratePerKm: number
): number {
  return round2(Math.max(0, annualKm - quotaKm) * ratePerKm)
}
```

- [ ] **Step 4: מרשם התורמים**

`src/engine/contributors/index.ts`:

```ts
import type { MoneyLine } from '../types'
import type { CalcContext } from '../calculate'
import { leaseSupplement } from './leaseSupplement'
import { usageValueTax } from './usageValueTax'
import { energyLines } from './energy'
import { fuelBudgetLines } from './fuelBudget'
import { excessKmLines } from './excessKm'
import { oneTimeLines } from './oneTime'

export type Contributor = (ctx: CalcContext) => MoneyLine[]

/**
 * The whole cost model, in order. Adding a cost component means writing one
 * file and adding one entry here. Removing one means deleting its entry.
 * Order matters only for display; the aggregate is order-independent.
 */
export const CONTRIBUTORS: Contributor[] = [
  leaseSupplement,
  usageValueTax,
  energyLines,
  fuelBudgetLines,
  excessKmLines,
  oneTimeLines,
]
```

- [ ] **Step 5: הרצה כדי לוודא הצלחה**

Run: `npx vitest run test/engine/excessKm.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
git add src/engine/contributors test/engine/excessKm.test.ts
git commit -m "feat(engine): excess-km charge and the contributor registry"
```

---

### Task 9: מה העובד מפסיד

צינור מקביל, אותו טיפוס שורה, תצוגה נפרדת. אגרת רישוי והחזר ביטוח מגולמים על ידי המדינה, ולכן הסכום הרשום הוא הסכום נטו.

**Files:**
- Create: `src/engine/forgone/index.ts`, `licenseFee.ts`, `privateInsurance.ts`, `carAllowance.ts`
- Test: `test/engine/forgone.test.ts`

**Interfaces:**
- Produces: `FORGONE_CONTRIBUTORS: Contributor[]`, `forgoneLines(ctx): MoneyLine[]`

- [ ] **Step 1: כתיבת הבדיקות הנכשלות**

`test/engine/forgone.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { forgoneLines } from '../../src/engine/forgone'
import { splitByTreatment } from '../../src/engine/money'

const ctx = (over = {}) => ({
  policy: {
    forgone: {
      licenseFeeAnnual:       { annual: 1800, enabled: true },
      privateInsuranceAnnual: { annual: 7000, enabled: true },
      serviceVehicleTierC:    { monthly: 1200, enabled: true },
      fixedNetAllowance:      { monthly: 900, enabled: true },
      variableNetAllowance:   { monthly: 400, enabled: true },
    },
    taxTreatment: {
      forgoneLicenseFee: 'grossedUp',
      forgoneInsurance: 'grossedUp',
      forgoneServiceVehicleTierC: 'gross',
      forgoneFixedNet: 'grossedUp',
      forgoneVariableNet: 'grossedUp',
    },
  },
  employee: {
    receivesLicenseFee: true,
    receivesPrivateInsurance: true,
    receivesServiceVehicleTierC: true,
    receivesFixedNet: true,
    receivesVariableNet: true,
    ...over,
  },
})

describe('forgoneLines', () => {
  it('lists every benefit the employee currently receives', () => {
    expect(forgoneLines(ctx()).map(l => l.id).sort()).toEqual([
      'forgoneFixedNet', 'forgoneInsurance', 'forgoneLicenseFee',
      'forgoneServiceVehicleTierC', 'forgoneVariableNet',
    ])
  })

  it('states each as an annual cost to the employee', () => {
    const byId = Object.fromEntries(
      forgoneLines(ctx()).map(l => [l.id, l.annualAmount]))
    expect(byId.forgoneLicenseFee).toBe(1800)
    expect(byId.forgoneInsurance).toBe(7000)
    expect(byId.forgoneServiceVehicleTierC).toBe(14400)
    expect(byId.forgoneFixedNet).toBe(10800)
    expect(byId.forgoneVariableNet).toBe(4800)
  })

  it('omits a benefit the employee does not receive', () => {
    const lines = forgoneLines(ctx({ receivesServiceVehicleTierC: false }))
    expect(lines.find(l => l.id === 'forgoneServiceVehicleTierC')).toBeUndefined()
  })

  /**
   * The whole reason the components are split. Losing a gross salary component
   * also lowers taxable income, so it costs less than its face value. Losing a
   * grossed-up reimbursement costs exactly its face value.
   */
  it('separates the gross component from the grossed-up ones', () => {
    const r = splitByTreatment(forgoneLines(ctx()))
    expect(r.cash).toBe(38800)          // 1800 + 7000 + 14400 + 10800 + 4800
    expect(r.taxableDelta).toBe(-14400) // only רכב שירות ג' moves taxable income
  })

  it('leaves taxable income alone when only grossed-up items are lost', () => {
    const r = splitByTreatment(forgoneLines(ctx({ receivesServiceVehicleTierC: false })))
    expect(r.cash).toBe(24400)
    expect(r.taxableDelta).toBe(0)
  })

  it('produces nothing when the employee receives none of them', () => {
    expect(forgoneLines(ctx({
      receivesLicenseFee: false, receivesPrivateInsurance: false,
      receivesServiceVehicleTierC: false, receivesFixedNet: false,
      receivesVariableNet: false,
    }))).toEqual([])
  })
})
```

- [ ] **Step 2: הרצה כדי לוודא כישלון**

Run: `npx vitest run test/engine/forgone.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: המימוש**

`src/engine/forgone/index.ts`:

```ts
import { round2 } from '../round'
import type { MoneyLine } from '../types'
import type { CalcContext } from '../calculate'

/**
 * What the employee gives up by taking a lease car. Money that stops arriving
 * is a cost in the same sense as the lease itself.
 *
 * The private-car components are NOT one figure. A real payslip carries at
 * least three, and they do not share a tax treatment:
 *
 *   רכב שירות ג'   – a gross salary component. Losing it also lowers taxable
 *                    income, so the real loss is amount x (1 - marginal rate).
 *   קבועות נטו      – a net component the state grosses up. Loss is face value.
 *   משת.רגי.נטו     – same.
 *
 * Folding them into one 'grossedUp' figure overstates the loss on the first.
 * Every treatment below is read from policy and none is hardcoded, so a
 * correction is a JSON edit.
 */
type Spec = {
  id: string
  key: keyof ForgoneContext['policy']['forgone']
  receives: keyof ForgoneContext['employee']
  treatmentKey: string
  labelHe: string
}

const SPECS: Spec[] = [
  { id: 'forgoneLicenseFee', key: 'licenseFeeAnnual', receives: 'receivesLicenseFee',
    treatmentKey: 'forgoneLicenseFee', labelHe: 'החזר אגרת רישוי' },
  { id: 'forgoneInsurance', key: 'privateInsuranceAnnual', receives: 'receivesPrivateInsurance',
    treatmentKey: 'forgoneInsurance', labelHe: 'השתתפות בביטוח רכב פרטי' },
  { id: 'forgoneServiceVehicleTierC', key: 'serviceVehicleTierC', receives: 'receivesServiceVehicleTierC',
    treatmentKey: 'forgoneServiceVehicleTierC', labelHe: "רכב שירות ג'" },
  { id: 'forgoneFixedNet', key: 'fixedNetAllowance', receives: 'receivesFixedNet',
    treatmentKey: 'forgoneFixedNet', labelHe: 'קבועות נטו' },
  { id: 'forgoneVariableNet', key: 'variableNetAllowance', receives: 'receivesVariableNet',
    treatmentKey: 'forgoneVariableNet', labelHe: 'משת.רגי.נטו' },
]

export function forgoneLines(ctx: ForgoneContext): MoneyLine[] {
  return SPECS.flatMap((s): MoneyLine[] => {
    const entry = ctx.policy.forgone[s.key]
    if (!entry?.enabled || !ctx.employee[s.receives]) return []

    // Entries carry either an annual figure or a monthly one, never both.
    const isMonthly = entry.monthly !== undefined
    const annualAmount = round2(isMonthly ? entry.monthly! * 12 : entry.annual!)
    if (annualAmount === 0) return []

    return [{
      id: s.id, labelHe: s.labelHe, category: 'forgone', annualAmount,
      treatment: ctx.policy.taxTreatment[s.treatmentKey],
      trace: {
        formulaHe: isMonthly
          ? `${entry.monthly} ₪ × 12 = ${annualAmount} ₪ שיפסיקו להתקבל`
          : `${annualAmount} ₪ בשנה שיפסיקו להתקבל`,
        inputs: isMonthly ? { monthly: entry.monthly! } : { annual: entry.annual! },
        sourceRef: `policy/org.json · forgone.${s.key}`,
      },
    }]
  })
}
```

- [ ] **Step 4: הרצה כדי לוודא הצלחה**

Run: `npx vitest run test/engine/forgone.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/engine/forgone test/engine/forgone.test.ts
git commit -m "feat(engine): forgone-benefit pipeline for the no-lease comparison"
```

---

### Task 10: הרכבת החישוב וסכמות Zod

**Files:**
- Create: `src/engine/calculate.ts`
- Create: `src/data/schema/catalog.ts`, `policy.ts`, `taxRules.ts`
- Test: `test/engine/calculate.test.ts`, `test/golden/scenarios.test.ts`, `test/data/schema.test.ts`

**Interfaces:**
- Produces: `calculate(input): CalcResult` — נקודת הכניסה היחידה למנוע

- [ ] **Step 1: כתיבת בדיקת הקצה־לקצה הנכשלת**

`test/golden/scenarios.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { calculate } from '../../src/engine/calculate'
import catalog from '../../src/data/catalog/fleet-2026.json'
import policy from '../../src/data/policy/org.json'
import taxRules from '../../src/data/tax-rules/2026.json'
import prices from '../../src/data/energy/prices-2026.json'

const employee = {
  grossMonthlySalary: 28400, creditPoints: 2.25, serviceTier: 'C' as const,
  commuteOneWayKm: 34, workDaysPerMonth: 21, annualKm: 26000,
  rambiEligible: false, chargesDaily: true,
  monthlyFuelBudgetIce: 1200, monthlyFuelBudgetElectrified: 700,
  receivesLicenseFee: false, receivesPrivateInsurance: false,
  receivesCarAllowance: false,
}

const run = (id: string, over = {}) => calculate({
  vehicle: catalog.vehicles.find(v => v.id === id)!,
  employee: { ...employee, ...over },
  policy, taxRules, prices,
})

describe('calculate — end to end', () => {
  it('charges no supplement for a car inside the tier C budget', () => {
    const r = run('skoda-fabia-selection')
    expect(r.lines.find(l => l.id === 'upgradeSupplement')).toBeUndefined()
  })

  it('reconciles: monthly x 12 equals the annual figure', () => {
    const r = run('skoda-octavia-selection')
    expect(r.monthlyNet * 12).toBeCloseTo(r.annualNet, 2)
  })

  it('adds one-time events on top of 36 monthly payments', () => {
    const r = run('skoda-octavia-selection')
    expect(r.threeYearNet).toBeCloseTo(r.annualNet * 3 + r.oneTimeTotal, 2)
  })

  it('taxes usage value on the chosen car, not on the tier budget', () => {
    const cheap = run('skoda-fabia-selection')
    const dear  = run('skoda-kodiaq-adv')
    const uvOf = (r: typeof cheap) =>
      r.lines.find(l => l.id === 'usageValue')!.annualAmount
    expect(uvOf(dear)).toBeGreaterThan(uvOf(cheap))
  })

  it('deducts the supplement from net — taxable income is unaffected by it', () => {
    const r = run('skoda-octavia-selection')
    const supplement = r.lines.find(l => l.id === 'upgradeSupplement')!
    expect(supplement.treatment).toBe('net')
    const uv = r.lines.find(l => l.id === 'usageValue')!.annualAmount
    expect(r.annualTaxableDelta).toBeCloseTo(uv, 2)
  })

  it('makes a plug-in cheaper to fuel when the driver charges daily', () => {
    const charging = run('chery-tiggo7-phev-comfort')
    const not      = run('chery-tiggo7-phev-comfort', { chargesDaily: false })
    const energyOf = (r: typeof charging) => r.lines
      .filter(l => l.category === 'energy')
      .reduce((s, l) => s + l.annualAmount, 0)
    expect(energyOf(charging)).toBeLessThan(energyOf(not))
  })

  it('adds forgone benefits only when the employee receives them', () => {
    const without = run('skoda-octavia-selection')
    const with_   = run('skoda-octavia-selection', {
      receivesLicenseFee: true, receivesPrivateInsurance: true,
    })
    expect(without.forgoneAnnual).toBe(0)
    expect(with_.forgoneAnnual).toBeGreaterThan(0)
    // Forgone benefits sit outside the lease cost and must not silently
    // inflate it. They are reported separately.
    expect(with_.annualNet).toBeCloseTo(without.annualNet, 2)
  })

  it('gives every line a trace with a source', () => {
    for (const l of run('kia-niro-hybrid-lx').lines) {
      expect(l.trace.formulaHe.length).toBeGreaterThan(0)
      expect(l.trace.sourceRef.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: בדיקת סכמה על קבצי הנתונים**

`test/data/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { CatalogSchema } from '../../src/data/schema/catalog'
import { PolicySchema } from '../../src/data/schema/policy'
import { TaxRulesSchema } from '../../src/data/schema/taxRules'
import catalog from '../../src/data/catalog/fleet-2026.json'
import policy from '../../src/data/policy/org.json'
import taxRules from '../../src/data/tax-rules/2026.json'

describe('data files', () => {
  it('catalogue matches its schema', () => {
    expect(() => CatalogSchema.parse(catalog)).not.toThrow()
  })
  it('policy matches its schema', () => {
    expect(() => PolicySchema.parse(policy)).not.toThrow()
  })
  it('tax rules match their schema', () => {
    expect(() => TaxRulesSchema.parse(taxRules)).not.toThrow()
  })
  it('every vehicle id is unique', () => {
    const ids = catalog.vehicles.map(v => v.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('the published supplement matches the formula for every row', () => {
    for (const v of catalog.vehicles) {
      const c = round2(v.supplementRate === 0.0215
        ? 0.0215 * Math.max(0, v.listPrice - 135000)
        : v.supplementRate * v.listPrice - 2902.5)
      expect(c, v.nameHe).toBeCloseTo(v.supplementTierC, 1)
    }
  })
})
const round2 = (n: number) => Math.round(n * 100) / 100
```

- [ ] **Step 3: הרצה כדי לוודא כישלון**

Run: `npx vitest run test/golden test/data`
Expected: FAIL — `calculate` and the schemas do not exist

- [ ] **Step 4: מימוש נקודת הכניסה**

`src/engine/calculate.ts`:

```ts
import { round2 } from './round'
import { splitByTreatment } from './money'
import { deltaTaxAnnual } from './tax/marginal'
import { CONTRIBUTORS } from './contributors'
import { forgoneLines } from './forgone'
import type { MoneyLine } from './types'

export type CalcContext = { /* vehicle, employee, policy, taxRules, prices, usage */ } & Record<string, any>

export type CalcResult = {
  lines: MoneyLine[]
  forgone: MoneyLine[]
  annualCash: number
  annualTaxableDelta: number
  annualTaxDelta: number
  annualNet: number
  monthlyNet: number
  oneTimeTotal: number
  threeYearNet: number
  forgoneAnnual: number
}

export function calculate(input: CalcContext): CalcResult {
  const ctx = withUsage(input)

  const lines = CONTRIBUTORS.flatMap(c => c(ctx))
  const forgone = forgoneLines(ctx)

  const { cash, taxableDelta } = splitByTreatment(lines)
  const annualTaxDelta = deltaTaxAnnual(
    ctx.employee.grossMonthlySalary * 12,
    taxableDelta,
    ctx.employee.creditPoints,
    ctx.taxRules
  )

  const oneTimeTotal = round2(
    lines.filter(l => l.category === 'oneTime')
         .reduce((s, l) => s + l.annualAmount, 0)
  )
  const annualNet = round2(cash + annualTaxDelta)
  const recurringAnnual = round2(annualNet - oneTimeTotal)

  // Forgone benefits need their own tax pass, because "רכב שירות ג'" is a gross
  // salary component — giving it up lowers taxable income and therefore costs
  // less than its face value. Its delta is measured on top of the lease's own
  // taxable change, since if the employee takes the car both happen at once and
  // land on the same marginal rate.
  const fg = splitByTreatment(forgone)
  const annualSalary = ctx.employee.grossMonthlySalary * 12
  const forgoneTaxDelta = round2(
    deltaTaxAnnual(annualSalary, taxableDelta + fg.taxableDelta,
                   ctx.employee.creditPoints, ctx.taxRules)
    - annualTaxDelta
  )

  return {
    lines, forgone,
    annualCash: cash,
    annualTaxableDelta: taxableDelta,
    annualTaxDelta,
    annualNet,
    monthlyNet: round2(annualNet / 12),
    oneTimeTotal,
    threeYearNet: round2(recurringAnnual * 3 + oneTimeTotal),
    forgoneCash: fg.cash,
    forgoneTaxDelta,
    /** What giving these up actually costs, after the tax effect. */
    forgoneAnnual: round2(fg.cash + forgoneTaxDelta),
  }
}
```

- [ ] **Step 5: הרצה כדי לוודא הצלחה**

Run: `npx vitest run`
Expected: PASS — all suites

- [ ] **Step 6: הוספת ולידציה ל־CI**

ב־`package.json`:

```json
{ "scripts": { "validate": "vitest run test/data && tsc --noEmit && eslint ." } }
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(engine): calculate() entry point, Zod schemas, golden scenarios"
```

---

# שלב 3 · ממשק העובד

מכאן המשימות מוגדרות ברמת רכיב וממשק, לא ברמת שורת קוד. הלוגיקה כבר נבדקה; מה שנשאר הוא תצוגה.

---

### Task 11: מערכת העיצוב ומצב האפליקציה

**Files:** `src/ui/tokens.css`, `src/ui/Money.tsx`, `Field.tsx`, `Sheet.tsx`, `Ledger.tsx`, `src/state/profile.ts`

**Interfaces:** Produces `<Money value dir="ltr">`, `<Ledger lines onExpand>`, `useProfile()` (localStorage), `useSelection()` (URL)

- [ ] Heebo 300–900 + IBM Plex Mono; טוקנים לפי `docs/design/ui-mockup.html`
- [ ] `<Money>` עוטף כל סכום ב־`dir="ltr"` — בלעדיו הסימן השלילי נזרק לצד הלא נכון ב־RTL. בדיקה: `−₪1,178` מרונדר בסדר הזה.
- [ ] `useProfile` שומר ב־`localStorage` בלבד; `useSelection` ב־URL כדי שקישור יהיה ניתן לשיתוף
- [ ] בדיקת עשן: כל טוקן צבע מוגדר בשני המצבים
- [ ] Commit: `feat(ui): design tokens, Money, Ledger, profile state`

---

### Task 12: מסך פרופיל

**Files:** `src/features/profile/ProfileForm.tsx`

שדות: שכר ברוטו · נקודות זיכוי · דרגה · מרחק חד־כיווני · ימי עבודה · נסועה שנתית · תקציב דלק לבנזין · תקציב דלק להיברידי ופלאגין · טעינה יומית · זכאות רמב"י · שלוש תיבות סימון למה שהוא מקבל היום.

- [ ] כל שדה תווית אחת ותו לא. אין טקסט עזר שחוזר על התווית.
- [ ] הדרגה בוחרת רמת שירות דרך `policy.gradesToTier`; כל עוד המפה ריקה — בורר ידני ג'/ד' עם סימון "לא אומת"
- [ ] בדיקה: הפרופיל שורד רענון דף
- [ ] Commit: `feat(profile): employee profile form`

---

### Task 13: קטלוג ודף רכב

**Files:** `src/features/catalog/CatalogGrid.tsx`, `src/features/vehicle/VehiclePage.tsx`

- [ ] כל כרטיס מציג את העלות החודשית **שלו**, לא מחיר מחירון
- [ ] דף רכב: לשוניות חודש / שנה / 3 שנים, ספר החשבונות עם ה"שדרה", וכל שורה נפתחת ומציגה את ה־`trace`
- [ ] לפלאגין: מחוון "כמה מהנסועה על חשמל" נגזר מ־`splitAnnualKm` ומוצג כתוצאה, לא כהנחה מוסתרת
- [ ] גוש נפרד "מה תפסיד" מתוך `result.forgone`, לעולם לא מחובר לסכום הליסינג
- [ ] כל שדה שמקורו ב־`verified: false` מסומן
- [ ] Commit: `feat(catalog): personalised grid and vehicle breakdown`

---

### Task 14: השוואה

**Files:** `src/features/compare/ComparePage.tsx`

- [ ] עד 4 רכבים; פס דו־מקטעי — בהיר לעלות המשותפת, מלא לדלתא מעל הזול ביותר
- [ ] טבלה עם הדגשת הזול בכל שורה
- [ ] Commit: `feat(compare): side-by-side comparison`

---

# שלב 4 · מסך מנהל

---

### Task 15: מסך הגדרות מנהל

**Files:** `src/features/admin/AdminGate.tsx`, `AdminPanel.tsx`, `src/state/policyOverride.ts`

**חשוב לומר במפורש:** קוד 0000 באפליקציה סטטית אינו אבטחה. כל מי שיפתח את כלי הפיתוח יראה את קובץ המדיניות. זהו מחסום מפני התעסקות מקרית בלבד. אין כאן נתונים אישיים, ולכן זה מקובל — אבל אסור להציג את זה כהגנה.

- [ ] שער סיסמה מול `policy.adminPasscode`, נשמר ב־`sessionStorage`
- [ ] קבוצות עריכה: תקציב ותוספות · קילומטראז' · הפחתות שווי שימוש · דלק ואנרגיה · פלאגין · מה מפסידים · **סיווגי מס** · אירועים חד־פעמיים
- [ ] כל שדה עם `verified: false` מסומן בענבר עד שיאושר
- [ ] בוררי `TaxTreatment` — ארבע אפשרויות לכל רכיב, עם ציטוט המקור לצידן. זה המקום שמאפשר לשנות את הנוסחה בלי קוד.
- [ ] ייצוא וייבוא JSON כדי שאפשר יהיה לגרסא את המדיניות
- [ ] בדיקה: שינוי `upgradeSupplement` מ־`net` ל־`gross` משנה את התוצאה — ומאמת שהמנוע באמת קורא את השדה
- [ ] Commit: `feat(admin): passcode-gated policy editor with tax-treatment switches`

---

# שלב 5 · נייד וסיום

---

### Task 16: פריסה לנייד ו־PWA

- [ ] נקודות שבירה 390 / 768 / 1180. בנייד: כרטיס אחד בשורה, ספר החשבונות בעמודה אחת, סרגל תחתון עם הסכום החודשי
- [ ] יעדי מגע 44px; ללא גלילה אופקית של ה־body
- [ ] `vite-plugin-pwa`, מניפסט בעברית, עבודה אופליין
- [ ] בדיקה במכשיר אמיתי ב־390px
- [ ] Commit: `feat: mobile layout and installable PWA`

### Task 17: מעבר AI slop

- [ ] מחיקת כל משפט שאפשר להסיק מהמסך; תווית מתייגת, דוגמה מדגימה
- [ ] כפתור שכתוב עליו "שמור" מפיק הודעה "נשמר" — אותה מילה לאורך כל הזרימה
- [ ] מצבי שגיאה מסבירים מה קרה ומה לעשות, בלי התנצלות
- [ ] Commit: `refactor: cut redundant copy`

---

## Self-review

**כיסוי המפרט.** השתתפות נטו — Task 6 + 10. שווי שימוש על הרכב שנבחר — Task 4 + 10. מכסת ק"מ בהגדרות מנהל — Task 8 + 15. תקציב דלק מהעובד — Task 7 + 12. זיכוי דלק שנתי עד תקרת התוספת — Task 7. מודל פלאגין יומי — Task 5. דרגה — Task 12. BYD ATTO2 פלאגין — כבר בקטלוג. מה מפסידים — Task 9 + 13. מסך מנהל 0000 — Task 15. Heebo — Task 11. נייד — Task 16. הסרת slop — Task 17.

**עקביות טיפוסים.** `MoneyLine.annualAmount` בשימוש אחיד; `Contributor` מוגדר פעם אחת ב־`contributors/index.ts` ומיובא ב־`forgone/index.ts`; `TaxTreatment` נקרא מ־`policy.taxTreatment` בכל תורם ואף פעם לא קשיח.

**שתי חולשות מודעות.** Tasks 11–17 מוגדרות ברמת משימה ולא ברמת צעד — הלוגיקה כבר מכוסה בבדיקות, והפירוט המלא שם היה מנפח את המסמך בלי להוריד סיכון. `CalcContext` ב־Task 10 מוגדר רופף (`Record<string, any>`); יש להדק אותו לטיפוס מלא בזמן המימוש, ברגע שכל צורות הקלט ידועות.
