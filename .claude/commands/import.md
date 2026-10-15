---
description: Bring plots, rights, holders and the burial register across from a PlotBox records report saved as CSV.
---

Run `npm run cem -- import plotbox --file=<report.csv> [--map=<mapping.json>] --actor=<name>`.

This changes records. Get the real staff name for --actor. Run it with --dry-run first, show the operator what will change, and run it for real only after a yes in this session. Never invent a date, an amount or a person.

Read docs/replace-plotbox.md first. Always run with --dry-run and show the counts before the real run. Memorials, documents, maps and money do not come across in a records report.
