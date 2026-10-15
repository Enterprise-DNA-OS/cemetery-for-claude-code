---
description: Sell the exclusive right of burial in an available plot to a holder, in perpetuity or for a term. Charges the section's right fee unless a price is given.
---

Run `npm run cem -- sell-right --plot="<plot>" --holder="<holder>" [--price=<amount>] [--term=<years>] [--certificate="<number>"] [--on=YYYY-MM-DD] --actor=<name>`.

This changes records. Get the real staff name for --actor. Run it with --dry-run first, show the operator what will change, and run it for real only after a yes in this session. Never invent a date, an amount or a person.

Add the holder first with `add-holder` if they are new. Check `available` before choosing a plot.
