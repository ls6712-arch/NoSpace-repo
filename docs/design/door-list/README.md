# Door list design source

These files are the source of the four "Door list, chosen" screens on the Soosh design canvas, approved by the founder on Oct 23, 2026. They are copied here because the canvas itself can't be opened from a coding session.

| File | Screen |
|---|---|
| `DoorDiscover.dc.html` | Discover (Corners tab) |
| `DoorTicket.dc.html` | Ticket sheet |
| `DoorStub.dc.html` | Stub kept |
| `DoorShelf.dc.html` | Shelf, Stubs tab |

**How to read them:**
- Each one is a single 390px-wide phone screen, with all styles written inline.
- Text in double curly braces is placeholder data filled in by the small script at the bottom of each file.
- Take the exact sizes, colours, spacing and SVG paths from them; the build brief (`claude-code-brief-door-list.md`) has the rules.
- Where the brief and a file disagree, follow the brief and say so in the PR.

The stub on `DoorStub.dc.html` is still tilted −4°. The founder has since asked for no tilts, so build it straight.
