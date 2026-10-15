# Rules this system checks

Checked 15 October 2026 against the **Burial and Cremation Act 1964** (New Zealand), sections 10, 50 and 51, as published on [legislation.govt.nz](https://www.legislation.govt.nz/act/public/1964/0075/latest/whole.html). The Act is still in force; the Ministry of Health's review of it has not produced a new law. The cemetery's own bylaw, made under the Act, sets the local rules for memorials, plot sizes and hours.

`npm run cem -- compliance` runs every check below. It reads your records; it does not certify that you meet the Act. Outside New Zealand, replace the sections with the rules you live under (for example a state Cemeteries and Crematoria Act) using `/customise`.

| Rule | What the data must show | Source |
|---|---|---|
| BURIAL_REGISTERED | Every completed burial or interment of ashes has a register number, and its plot (section, row and number) is on record. `complete` gives the next number in that cemetery's register. | s 50(1) |
| HOLDER_CONSENT | A booking in a plot whose right of burial has been sold has the date the holder consented. `book` and `complete` refuse without it. | s 10(2) |
| RIGHT_LAPSE | A right of burial with space left in the plot is flagged `right_lapse_notice_days` (365) before 60 years pass without a burial, and again once they have. `end-right` marks it lapsed only after that date. A transfer keeps the original purchase date. | s 10(4) |
| RIGHT_TERM_ENDED | A right sold for a limited period is still marked active after its term ended. | s 10(1) (rights sold "for a limited period") |
| DISINTERMENT_LICENCE | Every removal of a body or ashes has the Minister's licence reference on file. `disinter` refuses without one. | s 51(1) |
| PAPERWORK | A booking within `paperwork_hours` (24) has the funeral director's burial paperwork on file. `complete` refuses without it. | House standard |
| OVER_CAPACITY | No plot holds more interments than it was laid out for. `book` and `import` refuse it. | Data check |
| MEMORIAL_UNSAFE | A memorial inspected as unsafe is made safe within `make_safe_days` (7). The cemetery is a workplace and the people who manage it must keep it without risk to visitors and staff. | Health and Safety at Work Act 2015, s 37 (the duty); the target is yours |
| MEMORIAL_NO_PERMIT | No memorial is installed without an approved permit. `install-memorial` refuses. | Your cemetery bylaw |
| MEMORIAL_PERMIT_WAITING | A memorial application is decided within `memorial_permit_days` (10). | House standard |
| GROUNDS_OPEN | A grounds job (sunken grave, drainage, tree) is not open longer than `grounds_days` (14). | House standard |

## The exact words

**Section 10(1).** "A local authority may sell either in perpetuity or for a limited period the exclusive right of burial in any part of a cemetery, and also the right of constructing any vault or place of burial with the exclusive right of burial therein."

**Section 10(2).** "Before any body is permitted to be buried in any vault, brick grave, or place of burial, the exclusive right of burial wherein has been sold, the local authority may require satisfactory evidence that the person for the time being appearing to it to be entitled as owner to such exclusive right has consented or would not object to the burial taking place therein."

**Section 10(3).** A sale "may at any time be rescinded by agreement between the local authority and the person for the time being appearing to it to be entitled as owner", and the authority may pay an agreed price for it. `surrender-right` records this, with any refund.

**Section 10(4).** "any exclusive right of burial referred to in subsection (1), whether sold before or after the commencement of this Act, shall lapse if, at any time after the sale, 60 years pass without a burial taking place in that part of the cemetery or in that vault, brick grave, or place of burial which is the subject of such exclusive right."

**Section 50(1).** "All burials within any cemetery shall be registered in a register to be provided and kept for that purpose by the local authority and in such register shall be distinguished in what parts of the cemetery the several bodies are buried, and a proper description of every grave shall be given, so that the situation thereof can be ascertained, and such register shall be indexed, so as to facilitate searches for entries therein." `npm run docs -- burial-register` prints the register for each cemetery, indexed by name; `/search` runs the index.

**Section 50(2).** The register is "open for inspection at all reasonable times".

**Section 51(1).** "It shall not be lawful to remove from its burial place any body, or the remains of any body, buried in any cemetery, Maori burial ground, or other burial ground or place of burial, without licence under the hand of the Minister, and except in accordance with such conditions as he may prescribe."

Nothing here is legal advice. Section 10 is written for local authority cemeteries; trustees of other cemeteries should check how their own Act or deed applies it.
