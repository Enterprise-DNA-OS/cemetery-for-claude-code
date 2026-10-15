---
description: Find a person in the register by name, optionally between two dates of death. For family history and grave-finding enquiries.
---

Run `npm run cem -- search --name="<part of the name>" [--died-from=YYYY-MM-DD] [--died-to=YYYY-MM-DD] --json`.

Present the result as a short table in plain words. If a name matches more than one record the command lists them: ask which one.

Answer the enquirer's question in one line per match: name, dates, cemetery, plot. If there are many matches, ask for a year or a cemetery to narrow it.
