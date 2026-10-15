---
description: Mark a right of burial lapsed under s 10(4) or expired at the end of its term. Refused if it has not ended.
---

Run `npm run cem -- end-right --right="<certificate, plot or holder>" [--on=YYYY-MM-DD] --actor=<name>`.

This changes records. Get the real staff name for --actor. Run it with --dry-run first, show the operator what will change, and run it for real only after a yes in this session. Never invent a date, an amount or a person.

Check the holder was written to first (`draft-lapse-notice`) and that no family member has asked to keep it.
