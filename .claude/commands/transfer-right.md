---
description: Transfer a right of burial to a new holder. The date bought stays, so the 60-year lapse clock does not restart.
---

Run `npm run cem -- transfer-right --right="<certificate, plot or holder>" --to="<holder>" [--certificate="<new number>"] [--on=YYYY-MM-DD] [--note="…"] --actor=<name>`.

This changes records. Get the real staff name for --actor. Run it with --dry-run first, show the operator what will change, and run it for real only after a yes in this session. Never invent a date, an amount or a person.

Ask what the transfer rests on (a will, a deed, a statutory declaration) and put it in --note.
