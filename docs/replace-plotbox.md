# Bring your PlotBox records across

PlotBox keeps each cemetery's **sections** and **plots**, the **deceased records** interred in them, the **rights holders** who own each plot, and bookings on its calendars. Build a records report in PlotBox (or a search of deceased records), export it to CSV, and one command loads it. Report columns are whatever the report chose, so the importer takes a mapping file for headings that differ.

## 1. The report

One row per interment, plus one row for each sold plot nobody is interred in yet. Default headings (any order):

| Heading | Becomes |
|---|---|
| Record ID | The interment's reference (re-running skips records already loaded) |
| Cemetery, Section | Cemetery and section (added if new; the section's kind is guessed from its name) |
| Row, Plot | The plot's row and number |
| Plot Type, Capacity | Burial or ashes ("Niche", "Ashes" or "Cremated" means ashes) and how many interments the plot holds (default 1) |
| Deceased First Name, Deceased Last Name | The person interred. Leave both blank for a sold plot with nobody in it |
| Date of Birth, Date of Death, Age | Their dates (YYYY-MM-DD or DD/MM/YYYY) and age |
| Interment Date, Interment Type | When, and burial or ashes. A past date loads as a register entry; a future one as a booking |
| Register Number | The burial register number. A blank one shows on `/compliance` until `assign-number` gives it one |
| Rights Holder, Rights Holder Email, Right Purchased, Certificate Number | The right of burial on the plot, if one is held |

`fixtures/plotbox/records.csv` is a sample. Your PlotBox report will use its own headings: write a mapping file with only the ones that change:

```json
{ "record": "Interment ID", "first": "Forename", "last": "Surname", "register_no": "Burial No" }
```

Keys: `record, cemetery, section, row, plot, plot_type, capacity, first, last, born, died, age, interment_date, interment_type, register_no, holder, holder_email, right_purchased, certificate`.

## 2. Preview, then load

```bash
npm run cem -- import plotbox --file=imports/records.csv --map=imports/map.json --actor="Your name" --dry-run
npm run cem -- import plotbox --file=imports/records.csv --map=imports/map.json --actor="Your name"
```

The preview prints the cemeteries, sections, plots, holders, rights and interments it would add. It refuses a row with a missing value, a date that does not exist, a duplicate record, a certificate number already on file, or more interments in a plot than its capacity, and changes nothing when it refuses.

## 3. What comes across, and what does not

- **Comes across:** cemeteries, sections, plots, the people interred with their dates and register numbers, rights holders and their rights of burial, and future bookings.
- **You record next:** for each future booking, the date the funeral director's paperwork arrived (`paperwork`) and, in a held plot, the holder's consent (`consent`). A records report does not carry those.
- **Does not come across:** the map and its drawings, memorials and permits, scanned documents, invoices and payments, funeral director and mason accounts, and portal history. Export what you must keep from PlotBox before your access ends. PlotBox says it returns customer data in an open format when a contract ends; ask for it. Enterprise DNA can map memorials, money and documents for you.

## 4. Run both, then switch

Keep PlotBox running for a fortnight. Compare `register`, `rights` and `capacity` with PlotBox each morning. When they agree and the office is booking through the commands, stop entering into PlotBox.
