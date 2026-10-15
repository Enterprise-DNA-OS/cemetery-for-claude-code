<h1 align="center">Cemetery for Claude Code</h1>

<p align="center">
  <strong>The open-source cemetery records system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your PlotBox data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=plotbox">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/plotbox?utm_source=github&utm_medium=readme&utm_campaign=plotbox">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-plotbox">Instead of PlotBox</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Cemetery for Claude Code does the job you pay PlotBox for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the PlotBox dashboard cannot.

PlotBox's own price list charges £150 a month for each administrative user and £50 for each grounds or management user, plus VAT, with bolt-on modules for mapping, portals and finance on top and an onboarding fee from £4,500 ([PlotBox Pro G-Cloud 15 pricing document](https://assets.applytosupply.digitalmarketplace.service.gov.uk/g-cloud-15/documents/702569/762511737682905-pricing-document-2026-01-30-1015.pdf), checked 15 October 2026). One small US cemetery district's public agreement shows US$7,980 a year after up to US$49,230 of start-up costs ([Riverside County, 25 June 2024](https://media.rivcocob.org/proceeds/2024/p2024_06_25_files/03.41001.pdf)). The bill is per named user, per module and every year.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=plotbox).

It covers what a cemetery office does every week: plots and what is available, rights of burial and who holds them, bookings from funeral directors, the burial register, removals, memorial permits and safety checks, grounds jobs, and what each funeral director owes. It is built for New Zealand councils, cemetery trusts, private cemeteries and crematoria under the Burial and Cremation Act 1964, and `/compliance` checks your records against sections 10, 50 and 51.

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/cemetery-for-claude-code.git
cd cemetery-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/attention`. It answers from the demo cemeteries: a burial tonight with no paperwork on file, a burial booked in a family plot with no consent from the holder, a right of burial that lapsed two years ago, an unsafe headstone, and a funeral director 70 days overdue.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

Every command drives one CLI, `npm run cem -- <command>` (`--json` for machines, `help` for every flag). Changes take `--actor` and `--dry-run`, and land in an audit trail nobody can edit.

**Every day**

| Command | What it does |
|---|---|
| `/attention` | What needs attention today: rule checks, interments in the next seven days, rights about to lapse, accounts overdue and open grounds jobs. |
| `/schedule` | Interments booked from today on, with funeral director, paperwork and the holder's consent. |
| `/book` | Book a burial or an interment of ashes: plot, the deceased, the funeral director and the time. Raises the interment fee to the funeral director. |
| `/consent` | Record the date the holder of the right of burial consented to an interment in their plot (s 10(2)). |
| `/paperwork` | Record that the funeral director's burial paperwork is on file for a booking. |
| `/reschedule` | Move a booked interment to a new time. |
| `/complete` | Mark a booked interment done and enter it in the burial register with the next register number. Refused without paperwork, or without consent in a held plot. |
| `/cancel` | Cancel a booked interment and credit the interment fee back to the funeral director. |
| `/draft-confirmation` | Draft the booking confirmation to the funeral director: date, time, plot, the fee, and anything still missing. |
| `/search` | Find a person in the register by name, optionally between two dates of death. For family history and grave-finding enquiries. |
| `/plot` | Everything about one plot: rights of burial, who is interred, memorials and grounds jobs. |

**Monday**

| Command | What it does |
|---|---|
| `/weekly-review` | The Monday review for the cemetery manager: this week's interments, last week's burials, capacity by section, rights lapsing, memorial permits waiting, accounts overdue and rule checks by rule. |
| `/compliance` | Check the records against the Burial and Cremation Act 1964 and the house standards in docs/compliance.md, and report what is breached or about to be, with the section cited. |
| `/capacity` | Plots available, reserved, in use and unusable by section, burials in the last year, and how many years the available plots last at that rate. |
| `/arrears` | Accounts overdue: funeral directors and holders, how much and how many days. |

**The register**

| Command | What it does |
|---|---|
| `/register` | The burial register: every burial and interment of ashes with its register number, plot and date, newest first. |
| `/assign-number` | Give a completed interment that has no register number the next number in its cemetery's register (s 50). |
| `/disinter` | Record the removal of a body or ashes. Refused without the Minister's licence reference (s 51). |
| `/record-licence` | Add the licence reference to a removal recorded without one. |

**Rights of burial**

| Command | What it does |
|---|---|
| `/available` | Plots available to sell, optionally in one cemetery or section, burial or ashes, with the right and interment fees. |
| `/sell-right` | Sell the exclusive right of burial in an available plot to a holder, in perpetuity or for a term. Charges the section's right fee unless a price is given. |
| `/rights` | Every active right of burial: plot, holder, certificate, date bought, last burial, when it lapses and space left. |
| `/lapsing` | Rights of burial that lapse under section 10(4) or reach the end of their term within the notice window, with space still in the plot. |
| `/draft-lapse-notice` | Draft a letter to the holder of a right of burial that is about to lapse, citing section 10(4) and the date. |
| `/transfer-right` | Transfer a right of burial to a new holder. The date bought stays, so the 60-year lapse clock does not restart. |
| `/surrender-right` | Record a right of burial given back by agreement (s 10(3)), with an optional refund credited to the holder. |
| `/end-right` | Mark a right of burial lapsed under s 10(4) or expired at the end of its term. Refused if it has not ended. |
| `/holders` | Holders of rights of burial with their contact details and plots. |
| `/add-holder` | Add a holder of a right of burial (or someone about to buy one). |

**Memorials and grounds**

| Command | What it does |
|---|---|
| `/memorials` | Every memorial with its permit decision, installation date and safety condition. |
| `/apply-memorial` | Record a memorial permit application: plot, applicant (usually the monumental mason) and what is proposed. |
| `/decide-memorial` | Approve or decline a memorial permit application. |
| `/install-memorial` | Record a memorial installed. Refused without an approved permit. |
| `/inspect-memorial` | Record a memorial safety inspection: safe, leaning or unsafe. |
| `/make-safe` | Record that an unsafe or leaning memorial has been made safe. |
| `/grounds` | Open grounds jobs (sunken graves, drainage, trees, paths) with days open. |
| `/report-grounds` | Log a grounds job: sunken grave, drainage, tree, mowing, path, fence, water or other. |
| `/resolve-grounds` | Mark a grounds job done. |

**Money**

| Command | What it does |
|---|---|
| `/accounts` | Every account with charges, amount due, paid and overdue. |
| `/charge` | Add a charge to a funeral director's or holder's account. |
| `/pay` | Record a payment from a funeral director or holder. |
| `/directors` | Funeral directors with bookings, interments in the last year and amount overdue. |
| `/add-director` | Add a funeral director. |

**Cemeteries and plots**

| Command | What it does |
|---|---|
| `/cemeteries` | Cemeteries with plots and plots available, and the date any closed. |
| `/add-cemetery` | Add a cemetery. |
| `/sections` | Sections with their kind, right fee, interment fee and plot count. |
| `/add-section` | Add a section to a cemetery with its kind and fees. |
| `/set-section` | Change a section's right fee or interment fee. |
| `/plots` | Every plot with type, capacity, interments done and booked, status and holder. |
| `/add-plots` | Add a run of plots to a section: a row and a number range, burial or ashes, and how many each holds. |
| `/set-plot` | Mark a plot unusable (with the reason) or usable again, or change how many interments it holds. |

**Setup and data**

| Command | What it does |
|---|---|
| `/settings` | The house settings: lapse years and notice, paperwork hours, memorial and grounds targets, invoice terms, currency. |
| `/set` | Change a house setting. |
| `/activity` | The audit trail: who changed what, when. |
| `/import` | Bring plots, rights, holders and the burial register across from a PlotBox records report saved as CSV. |
| `/export` | Write every record to one JSON archive. |
| `/customise` | Make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it. |
| `/new-view` | Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view`. |

Documents, in your brand from `brand.json`: `npm run docs` renders a certificate of right of burial for each holder, the burial register for each cemetery (indexed by name, as section 50 asks) and an account statement for each funeral director. `npm run view` renders three read-only pages: this week, capacity, and memorials.

## Ten questions PlotBox does not answer

1. Which family plots lose their right of burial in the next year under section 10(4), and still have room? (`/lapsing`)
2. Which burials this week are in a held plot with no consent from the holder? (`/schedule`, `/compliance`)
3. Which burials in the next 24 hours have no paperwork from the funeral director? (`/attention`)
4. How many years does each section have left at last year's rate? (`/capacity`)
5. Which completed burials have no register number? (`/compliance`)
6. Which removals have no Minister's licence on file? (`/compliance`)
7. Which memorials were found unsafe and are still not made safe? (`/memorials`, `/compliance`)
8. Which memorials went in without an approved permit? (`/compliance`)
9. Which funeral director owes us money, how much and how many days late? (`/arrears`)
10. Is there anyone named Grant buried here who died before 1970? (`/search`)

## Your first hour: ten things to ask for

1. "Put our council's name and logo on everything." (`brand.json`)
2. "Add our two cemeteries, their sections and fees." (`/add-cemetery`, `/add-section`)
3. "Lay out row B of Lawn 2, plots 1 to 40, double depth." (`/add-plots`)
4. "Bring across this PlotBox records report." (`/import`)
5. "Book Mary Jones into Lawn A A-3 for Thursday at 11 with Harbour Funerals." (`/book`)
6. "What needs attention today?" (`/attention`)
7. "Write to every holder whose right lapses next year." (`/draft-lapse-notice`)
8. "Add a field for the grave depth to every interment." (`/customise`)
9. "Make me a page of every RSA plot and who is in it." (`/new-view`)
10. "Write Monday's review for the cemetery manager." (`/weekly-review`)

## Instead of PlotBox

Build a records report in PlotBox, export it to CSV, preview with `npm run cem -- import plotbox --file=records.csv --actor="Your name" --dry-run`, then load it. Cemeteries, sections, plots, the people interred with their register numbers, and rights holders come across; the map, memorials, documents and money do not. The full guide, with the column mapping: [docs/replace-plotbox.md](docs/replace-plotbox.md).

What the checks are based on: [docs/compliance.md](docs/compliance.md).

## Architecture

```
cemetery-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/cemetery.mjs      the one CLI the commands drive
  documents.json            right of burial certificate, burial register, funeral director statement
  views.json                this week, capacity, memorials
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the thesis and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Cemetery for Claude Code for your business, migrates your PlotBox data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=plotbox)
- Read more: [enterprisedna.co/omni/instead-of/plotbox](https://enterprisedna.co/omni/instead-of/plotbox?utm_source=github&utm_medium=readme&utm_campaign=plotbox)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
