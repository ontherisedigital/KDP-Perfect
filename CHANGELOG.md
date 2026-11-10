# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.7.0] - 2026-11-09

### Changed
- New app icon (installer, window, taskbar) and logo in the top bar.
- Prettier cover template to match the app: a soft blue page (#D3EBF3), sky-blue trim-variance and margin bands (#1CB6E7), softer theme colours, Fredoka and Dosis lettering, and the size details, colour key and barcode box on rounded cards. Guides stay square and exact. PDF templates embed the app's fonts.

## [0.6.0] - 2026-11-08

### Added
- Page designer: **multi-select** (Shift/Ctrl-click, box select, Ctrl+A) to move, delete, duplicate, copy, lock and reorder elements together.
- Page designer: **alignment tools**: align left, centre, right, top, middle or bottom to the margins, the page edges or each other; space evenly across or down; make elements the same width, height or size.

### Fixed
- Month grid "Always 5 rows" no longer drops the last days of 6-row months; they share slots (23/30) like printed calendars.

## [0.5.0] - 2026-11-08

### Added
- **Page designer** tab: build planner, journal and notebook pages from a modular element library. Calendar (day slot, week, month grid, mini month, year at a glance, date heading), planner (checklist, lists, hourly schedule, habit tracker, counter / water tracker, table), bullet journal (year in pixels, key, daily log, banner, mood scale), writing areas and notes boxes, text, shapes, lines, dividers, images and page numbers.
- 19 shapes for every slot and frame (rectangle, rounded with a corner slider, pill, circle, hexagon, octagon, diamond, arch, ticket, tag, banner, shield, speech bubble, heart, star, flower, cloud, leaf, water drop), each unlined, lined, dotted or grid inside.
- Drag and drop: elements from the library, image files from your computer (kept locally), images onto frames; move, resize, rotate, snapping guides, undo/redo, keyboard shortcuts, templates, mirrored left-hand pages.
- Dated planners: daily, weekly or monthly page repeats from a start date, and a one-click year planner (each month followed by its weeks). Designs save and open as files, images included.
- **Puzzles** tab: word search (grid size, diagonal and backwards words), crossword (built and numbered from your answers and clues), maze and sudoku (easy, medium, hard; unique solutions). Seeded so puzzles rebuild identically; answer pages at the back, 4 or 1 per page. The Interior tab's **Puzzle book** type turns them into a print-ready PDF.
- Interior tab: **My designed pages** book type builds the designer's pages into the print-ready PDF, with the same printing, bleed, front pages and cover tools.
- **User Guide** button in the top bar (or press F1): complete instructions for every tab, plus uploading to KDP, tips and tricks, troubleshooting, and privacy and help. Works offline. The Interior tab links to its bleed and margins section.

## [0.4.0] - 2026-11-08

### Added
- **Interior tab: low-content interior builder.** Coloring and activity books from your page images (PNG, JPG or WebP; reorder, per-image DPI and crop check), and journals, notebooks and planners from generated pages (wide or college rule, dot grid, graph, handwriting practice, blank) with optional date line and page numbers.
- **Front only / Front and back printing** for every book type. Front only puts each page on a right-hand page and leaves its back blank (best for coloring books, so markers don't bleed through).
- **Bleed or No bleed**, with a plain explanation: use bleed only when the art runs off the edge of the page. Bleed pages are trim + 0.125" wide and + 0.25" tall; art fills to the edge. Without bleed, art is fitted inside the margins.
- Mirrored margins with KDP's page-count-based gutter, optional "This book belongs to", title and copyright pages, a page-by-page spread preview (black-and-white books are previewed in grayscale), and checks for KDP's page-count limits and blank-page runs.
- Interior PDF at the exact page size with every font embedded, as KDP requires.
- **Cover from your art.** The Interior tab shows the full-wrap cover size for the finished page count, plus the front, back and spine sizes in inches and pixels. Add a front image (and optionally a back image), pick spine and back colours and spine text, and download a print-ready full-wrap cover PDF. One click copies the page count to "Your book" so the cover template, preflight and mockup match.

### Changed
- The bundled fonts moved from `public/fonts` to `src/app/fonts` so they can also be embedded in PDFs.

## [0.3.0] - 2026-11-07

### Changed
- New look: the On the Rise Digital "liquid glass" style (frosted glass panels over a drifting color background, Fredoka / Dosis / Arima fonts bundled for offline use, blue-to-violet accents, sliding segmented controls and springy animations). Light and dark mode and reduced motion are supported.

## [0.2.1] - 2026-10-29

### Changed
- 3D mockup: the spine crease is now off by default (coloring-book covers are smooth and flat) and much subtler when switched on.
- The release workflow no longer builds macOS packages (they could not be tested), and the macOS electron-builder target was removed. Windows and Linux builds are unchanged.

## [0.2.0] - 2026-10-29

Hardcover covers, Kindle eBook covers, Preflight and the 3D mockup.

### Added
- **Hardcover (case laminate) covers.** Binding switch on the book form. Wrap, board, hinge, case spine, safe areas, spine text zone and barcode box, with a hardcover-specific template and measurements. Five trim sizes, black & white (white or cream) or premium color, 76-550 pages. Verified against KDP's live cover calculator.
- **Kindle eBook cover template.** 1600 x 2560 px ideal size, HD and minimum presets or a custom size; template with the border guide and KDP's requirements; JPG/PNG export at exact pixels.
- **Preflight check.** Drop in a finished cover (PDF, PNG or JPG): page size and shape vs the book, page count, effective DPI, file type and size, with diagnosis of common mistakes (rotated, no bleed, front cover only, wrong binding, implied page count). Shows the artwork with the KDP guides on top. PDFs are drawn with pdf.js.
- **3D book mockup.** three.js book with your cover (full wrap or front only): eight poses, matte or glossy, soft shadows, solid/gradient/transparent backgrounds, spine crease, drag-to-orbit; PNG/JPG export in 1:1, 4:5, 2:3, 3:2 and 16:9 up to 4000 px. Paperbacks and hardcovers, left-to-right and right-to-left.
- Groundwood paper (0.00235"/page) for paperbacks.
- Test fixtures from the live KDP calculator (`tests/fixtures/kdp-live-calculator.json`) and tests for hardcover, eBook, preflight, mockup helpers and app state.
- The desktop smoke test now exercises every screen, including pdf.js under `file://` and WebGL.

### Changed
- The app is now a tabbed workspace (Cover template, Kindle eBook, Preflight, 3D mockup) with a shared "Your book" form. The cover Download controls moved under the preview.
- Custom paperback sizes outside 4-8.5" x 6-11.69" are now an error, as in KDP's calculator (they were a warning).
- pdf.js and three.js load only when Preflight or the 3D mockup is first opened.

### Fixed
- **8.25 x 11 removed from paperback presets.** It is a hardcover-only size in KDP's calculator (it was wrongly offered for paperbacks).

### Docs
- `docs/KDP-SPECS.md` documents the hardcover and eBook numbers, the live-calculator checks, and every place KDP's sources disagree.

## [0.1.0] - 2026-10-01

First release: the cover template generator.

### Added
- Cover template generator for KDP paperbacks: enter trim size, ink/paper and page count; get the full-wrap canvas size and a marked-up template.
- Template marks the bleed, trim lines, trim-variance band, front/back safe areas, spine folds, spine text zone and the 2" × 1.2" barcode area, and prints the canvas size and pixel dimensions on the artwork.
- Downloads at actual size as PNG, JPG (DPI-tagged) or PDF (exact page size); transparent guides overlay as PNG or PDF.
- All 16 trim sizes from Amazon's calculator plus 8.25 × 11 and custom sizes; black and color ink, white and cream paper; left-to-right and right-to-left books; "extra cautious" safe-zone option.
- Measurements table, guide-position tables, copy/save of all numbers, in inches, cm or mm.
- Validation: minimum/maximum pages per trim size and paper, spine text availability (79+ pages), unavailable ink/paper combinations.
- Desktop app (Electron, Windows installer and portable exe) and a static web build from the same code.
- Interior margin helpers (`src/core/interior.ts`) as groundwork for the planned interior formatter.
- Test suite with golden values extracted from Amazon's KDP Print File Setup Calculator V5, plus an end-to-end desktop smoke test.

[Unreleased]: https://github.com/ontherisedigital/KDP-Perfect/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/ontherisedigital/KDP-Perfect/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/ontherisedigital/KDP-Perfect/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/ontherisedigital/KDP-Perfect/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/ontherisedigital/KDP-Perfect/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/ontherisedigital/KDP-Perfect/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/ontherisedigital/KDP-Perfect/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/ontherisedigital/KDP-Perfect/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ontherisedigital/KDP-Perfect/releases/tag/v0.1.0
