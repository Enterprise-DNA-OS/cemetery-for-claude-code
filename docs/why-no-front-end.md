# Why there is no front end

PlotBox is a database with a subscription. Underneath sit ordinary records: cemeteries, sections, plots, rights of burial, the people interred, bookings from funeral directors, memorials. What the subscription pays for is the layer on top that lets office staff without database skills reach those records: screens, a calendar, a map, portals, forms.

That layer used to be the whole product, because talking to a database was hard. It is not hard any more. Open this folder in Claude Code, ask "which family plots lapse in the next year?" or "is the paperwork in for Thursday's burial?", and it runs the right command and explains the answer.

## What you gain

- **Answers the dashboard never had.** Which rights of burial lapse under section 10(4) while the plot still has room. Which burial is booked in a held plot with no consent from the holder. How many years each section has left at last year's rate.
- **No per-user bill.** PlotBox prices each named user by tier. Here everyone in the office, the grounds team and management can look.
- **Your register in your own database.** The burial register is a public record you must keep and index. Here it is plain rows you can back up, print and query from anything.
- **Rules you can read.** Every check is listed in `docs/compliance.md` with the section beside it.

## What a screen gives that this does not

- **A digital map.** PlotBox draws plots on aerial images. Here a plot is its section, row and number, and the map stays on the wall or in your GIS. Enterprise DNA can add a map view on top of the same records for your version.
- **Portals.** Funeral directors book online and families search the register on the web with PlotBox's portals. Here the office takes bookings by phone or email and runs the search for the enquirer.
- **A tablet app for the grounds team.** Here a groundsperson tells the office, or logs a job where Claude Code runs.
- **A help desk at the vendor.** This is open source. Enterprise DNA supports the installed version for cemeteries that want someone to call.

## Who this fits

A council, a cemetery trust or a private cemetery or crematorium with a small office who would rather ask than click. If funeral directors must book online, Enterprise DNA builds that portal on the same records for your version.

Installed and run for you: https://enterprisedna.co/omni/instead-of/plotbox
