---
description: Book a burial or an interment of ashes: plot, the deceased, the funeral director and the time. Raises the interment fee to the funeral director.
---

Run `npm run cem -- book --plot="<plot>" --deceased="<full name>" --died=YYYY-MM-DD [--born=YYYY-MM-DD] [--age=<n>] [--address="…"] [--director="<funeral director>"] --at=YYYY-MM-DDTHH:MM [--kind=burial|ashes] [--consent=YYYY-MM-DD] [--paperwork=YYYY-MM-DD] --actor=<name>`.

This changes records. Get the real staff name for --actor. Run it with --dry-run first, show the operator what will change, and run it for real only after a yes in this session. Never invent a date, an amount or a person.

Check the plot first with `plot`. If the plot's right is held by someone, the booking is refused until the date they consented is given (s 10(2)). A burial cannot go in an ashes plot, and a full or unusable plot is refused.
