# Centraleyes E2E Automation

Playwright end-to-end suite for the Centraleyes GRC platform. JavaScript, **CommonJS only**
(`require` / `module.exports`) — no TypeScript, no ESM.

**179 spec files · 130 page objects · 7 application/role targets**

> **Working on this repo?** [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) is the
> authoritative reference for architecture and coding style (~2,250 lines, 19 sections,
> with verbatim code examples). [`CLAUDE.md`](CLAUDE.md) is the condensed rulebook. Read the
> relevant section before adding a test, page object, helper or enum — do not infer
> conventions from a single nearby file.

---

## 🚀 Key features

- **Page Object Model** — one page object per spec, selectors in a public `this.selectors`
  contract, assertions owned by `verify*` methods on the page object.
- **Multi-application** — one repo drives the Secure, Beacher and MidMarket products, plus
  four role-scoped suites, all switched by a single `APP` env var.
- **Sequential by design** — `workers: 1`, `fullyParallel: false`. Tests within a spec run
  in declaration order and share data forward from a `00` setup test. Parallelism is
  process-level, via `npm run regression:parallel`.
- **Session reuse** — no `globalSetup`; each app's login spec performs a real login + OTP
  and writes its own `storageState` file, which every other spec opts into.
- **S3-sourced OTP** — login codes are read from `public/AUTOMATION/{email}/OTP.txt` on S3
  rather than scraped from email.
- **Backend verification** — AWS S3 reads let specs assert UI counts against stored state.
- **Allure + GitHub Actions** — per-app CI jobs, merged Allure report, `TEST_SUMMARY.md`.

---

## 📁 Project structure

```
CentraleyesAutomations/
├── pages/                  # Page Object Model classes, one folder per app/role
│   ├── Secure/             #   app 1 - the main platform (+ BasePage all others extend)
│   ├── Beacher/            #   app 2 - Beecher / BnB Cyber Site
│   ├── MidMarket/          #   app 3 - the "Cyber app" mid-market variant
│   ├── Participant/        #   role-scoped suites; each has its own session file
│   ├── SubEntityLeader/
│   ├── EntityLeader/
│   ├── MSSP/
│   └── SuperEntityLeader/  #   scaffolding only, no specs yet
├── tests/                  # Spec files, mirroring the pages/ layout
├── constant/               # enums.js (single source of truth) + testData.js
├── helpers/                # common/, collection/, riskRegister/, vendor/
├── services/               # AWS S3 client, service wrapper, cache
├── testData/<APP>/         # Per-app JSON written by setKey and read by getKey
├── scripts/                # Regression runners and per-suite runners
├── docs/PROJECT_CONTEXT.md # Architecture and style reference (read this first)
├── test-cases/             # Manual test-case source material
├── filesTest/              # Upload fixtures
├── .github/workflows/      # dev.yml, main.yml, run-tests.yml, test-jobs.yml
├── playwright.config.js
└── package.json
```

---

## 🛠️ Installation

```bash
npm install
```

```bash
npx playwright install
```

---

## ⚙️ Environment configuration

Local runs read `.env` (gitignored); CI supplies the same values as workflow env plus
GitHub Secrets for the AWS keys.

```env
# Per-app base URLs. BASE_URL is the Secure default.
BASE_URL=https://secure.cygovdev.com
BASE_URL_BEACHER=https://secure-cyber-in-site.cygovdev.com/
BASE_URL_MIDMARKET=https://midmarket.cygovdev.com/

# Shared platform account. Beacher and MidMarket reuse it.
USER_EMAIL=<uuid>@mailinator.com
USER_PASSWORD=your_password
MAILINATOR_ADDRESS=<uuid>

# OTP and backend verification both read from S3.
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
AWS_S3_BUCKET=cygov-storage-secure
```

Never commit credentials. Enums that expose an account (`MIDMARKET_USER`,
`POLICY_MANAGEMENT_SECOND_USER`) should read from `process.env`, not carry a literal.

---

## 🖥️ Applications and roles — the `APP` env var

`APP` (default `"Secure"`) switches **three things at once**: the base URL, the session
file and the `testData/` folder.

| `APP`             | Base URL             | Session file                        | Test data                   |
| ----------------- | -------------------- | ----------------------------------- | --------------------------- |
| `Secure`          | `BASE_URL`           | `storageState.json`                 | `testData/Secure/`          |
| `Beacher`         | `BASE_URL_BEACHER`   | `storageState.beacher.json`         | `testData/Beacher/`         |
| `MidMarket`       | `BASE_URL_MIDMARKET` | `storageState.midmarket.json`       | `testData/MidMarket/`       |
| `Participant`     | `BASE_URL`           | `storageState.participant.json`     | `testData/Participant/`     |
| `SubEntityLeader` | `BASE_URL`           | `storageState.subEntityLeader.json` | `testData/SubEntityLeader/` |
| `EntityLeader`    | `BASE_URL`           | `storageState.entityLeader.json`    | `testData/EntityLeader/`    |
| `MSSP`            | `BASE_URL`           | `storageState.mssp.json`            | `testData/MSSP/`            |

Beacher and MidMarket specs also pin `baseURL` and `storageState` in `test.use()`, so they
hit the right domain even when run directly without setting `APP`.

**Which app is which.** The platform selects its white-label variant by **subdomain**
(`UtilsService.isMidMarket`, `isBnBCyberSite`), so a run pointed at the wrong host silently
gets the Secure UI rather than failing — always check the base URL first when a suite
behaves unexpectedly.

The three products are genuinely different UIs, not skins: Beacher's new-entity wizard has
8 steps, MidMarket's has 3 (broker) plus 4 (invited client) and is a **different Angular
component entirely**, so their page objects share no code.

---

## 🔐 Authentication

There is **no `globalSetup`** — the login spec itself seeds the session:

| App       | Login spec                                                 | Writes                        |
| --------- | ---------------------------------------------------------- | ----------------------------- |
| Secure    | `tests/Secure/login.spec.js` → `LOGIN - 09`                | `storageState.json`           |
| Beacher   | `tests/Beacher/Login/login.spec.js` → `BEACHER LOGIN - 09` | `storageState.beacher.json`   |
| MidMarket | `tests/MidMarket/Login/login.spec.js` → `MMLOGIN - 05`     | `storageState.midmarket.json` |

Participant, SubEntityLeader and EntityLeader have no plain login: their **setup spec
provisions the user and is the login step**, so each of those jobs is self-contained.

OTP is read from S3 (`public/AUTOMATION/{email}/OTP.txt`) with a 30 s pre-wait then 6
retries. `MailinatorHelper` is now a backwards-compatible shim forwarding to `S3OtpHelper`.

Because Secure, Beacher and MidMarket share one account, **do not run their login specs
concurrently** — they would race for the same OTP file.

---

## 🧪 Running tests

### Standard

```bash
npm test
```

```bash
npm run test:headed
```

```bash
npm run test:ui
```

```bash
npm run test:debug
```

### A single spec or test

```bash
npx playwright test tests/Secure/RiskRegister/riskRegisterRisks.spec.js
```

```bash
npx playwright test tests/Secure/addClient.spec.js -g "AC - 06"
```

### Regression — what CI runs

```bash
npm run regression:parallel
```

Runs login once, then every worker group in parallel; each group runs its specs
sequentially against the shared session and continues past failures. Per-app shortcuts:

```bash
npm run regression:secure
```

```bash
npm run regression:beacher
```

`regression:participant`, `regression:sub-entity-leader`, `regression:entity-leader` and
`regression:mssp` follow the same pattern.

### Standalone suite runners

Newer coverage lives outside the shared CI runner until it has been through a live pass, so
it cannot lengthen every pipeline run:

```bash
node scripts/run-midmarket-suite.js
```

```bash
node scripts/run-remediation-suite.js
```

Both accept `--group <name>`; the MidMarket runner also takes `--skip-login` to reuse a
saved session, and treats login failure as a hard gate with a diagnostic message.

### Reports

```bash
npm run allure:generate
```

```bash
npm run allure:open
```

> The suite is slow and runs with `workers: 1`. Do not cancel a long run prematurely.

---

## 🤖 GitHub Actions

| Workflow        | Trigger                                     | What it does                                                                                                                                         |
| --------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main.yml`      | `repository_dispatch: run-e2e`              | One job per app — Secure, Beacher, Participant, SubEntityLeader, EntityLeader — with `fail-fast: false` so one app's failure never cancels the rest. |
| `dev.yml`       | `repository_dispatch: run-e2e-dev` / manual | Secure only, against the dev environment.                                                                                                            |
| `run-tests.yml` | Manual                                      | Pick an app, then run its complete suite, a single spec, or `list-specs` to print every spec for that app into the run summary.                      |
| `test-jobs.yml` | Manual                                      | Named job groups (login, add-client, policy-management, upperdeck, …).                                                                               |

Runs are on `runs-on: self-hosted`. Each uploads its Playwright report and appends
`TEST_SUMMARY.md` to the GitHub step summary.

The matrix in `main.yml` must stay in step with `workersByApp` / `loginSpecByApp` in
`scripts/run-parallel-workers.js` — the script runs **one** app per invocation, so an app
missing from the matrix is simply never dispatched. MidMarket is deliberately **not** in
the matrix yet; run it via `scripts/run-midmarket-suite.js`.

---

## 📂 Coverage

**Secure (66 specs)** — Collection (1st and 3rd party), Risk Register, Controls, Policy
Management, Remediation + Remediation Simulation, Framework Settings, Global Controls,
Import Assessment, Dynamic Label Management, Regulatory Watch, Upperdeck, Vendor, AI
Answering, Settings/user roles, client and multi-entity creation.

**MSSP (52)** · **EntityLeader (21)** · **SubEntityLeader (14)** · **Participant (3)** —
role-scoped ports of the Secure flows, each with its own provisioning setup spec.

**Beacher (19)** — new-entity Wizard, Application scoring and artifacts, Controls,
Collection, Import Assessment, Lock Assessment, Remediation.

**MidMarket (4)** — login plus the broker-side new-entity wizard: step rendering, the six
step-1 validation branches, save/resume draft, and the SEND TO CLIENT invite handoff.

---

## 📝 House rules

1. **Never alter an existing page-object method.** Add a new one instead — `Grep` for
   usages first. Same for shared selectors: add a new key rather than changing one.
2. **All enums live in `constant/enums.js`.** Never inline an enum in a spec or page object.
3. **All shared data goes through `TestData`**, keyed by `FILE_KEYS.*`, filed under a
   `TEST_DATA_FILE_ENUMS.*` value, always with all three arguments.
4. **Assertions belong in page objects** (`verify*`). Specs assert only numeric/derived
   values, and `console.log` the `expected … | actual …` pair first.
5. **Preserve sequential assumptions** — 1 worker, declaration order, data flowing forward
   from the `00` setup test.
6. **Prefer an explicit condition** (`waitForElement`, locator state, spinner-hidden,
   `waitForLoadState`) over a bare `waitForTimeout`. Size any fixed wait to an observed
   need, verified live — never pad on assumption.
7. **Never weaken or delete an assertion, add `test.skip`, or comment out a step to make a
   test pass.** Park a test only deliberately, keeping its ID and full body.
8. **A missing precondition is not a failure.** If `getKey` returns nothing, trace the
   `setKey` that produces it, run that producer first, then re-run.
9. **Capture locators live** with the Playwright MCP rather than guessing.

### Locators

The app is Angular with **no `data-testid`** — never reach for `getByTestId`. XPath-first:

```js
"//button[contains(@class,'sub-menu-item')]//span[normalize-space(text())='Policies']";
```

Toasts are CSS: `"#toast-container .toast-message:has-text('Saved Successfully')"`.
`getByRole` / `getByText` only ever scoped to a container, never at page level.

### Naming

Tests: `"<PREFIX> - <NN> | <@tag> <Sentence description>"` — e.g.
`"RRR - 13 | @regression Add Manual Risk"`. Zero-padded 2-digit numbers, tags `@regression`
or `@smoke`. **Numbering gaps are intentional** — a parked test's number is never reused.
Check §17 of `PROJECT_CONTEXT.md` so a new prefix is unique.

Method prefixes: `click*` · `verify*` (preferred over `assert*`) · `select*`/`set*`/`create*`
(return what they picked/made) · `get*` · `waitFor*` · `enter*`/`fill*` · `is*` (boolean,
never throws).

### Formatting

Prettier defaults, no config file: 2-space indent, double quotes, semicolons, ~80-col wrap,
trailing commas including after the last argument. `console.log` narrating intent as a
method's first line is a first-class convention here — keep writing them, plain text, no
emoji. A comment above a method documenting an intent or trap is the most valuable habit in
this repo.
