---
description: Plots available to sell, optionally in one cemetery or section, burial or ashes, with the right and interment fees.
---

Run `npm run cem -- available [--cemetery=<name or code>] [--section="<section>"] [--type=burial|ashes] --json`.

Present the result as a short table in plain words. If a name matches more than one record the command lists them: ask which one.

Closed cemeteries are left out: they sell no new rights.
