# User guide

The same guide is built into the app: press **User Guide** in the top bar, or F1.

The left column, **Your book**, is shared by the Cover template, Preflight and 3D mockup tabs. Fill it in once; every tab uses it. (The Kindle eBook tab has its own size picker.)

## Your book

| Field | What to enter |
| --- | --- |
| **Binding** | **Paperback**, or **Hardcover** (KDP's case-laminate hardcover). Hardcovers have five trim sizes, three paper options and a 76–550 page range. |
| **Trim size** | The finished page size you chose on KDP. Paperbacks also offer **Custom size…** (4–8.5" wide, 6–11.69" tall). |
| **Ink and paper** | Must match your KDP print options. Paper thickness drives the spine width. |
| **Number of pages** | The page count of your *finished interior* as KDP will print it. The spine is sized from this number, so if it changes, regenerate your cover. |
| **Advanced → Reading direction** | Left to right (back, spine, front) or right to left for languages such as Japanese. |
| **Advanced → Safe-zone margin** | Paperback only. *KDP standard* (0.25" from the outer edge) or *extra cautious* (0.375" from the edge). |

Messages under the form tell you when something is out of range (too few or too many pages, a paper KDP doesn't offer for that binding, spine text not allowed).

## Cover template

The card at the top shows the size to create your design at, in your chosen unit, the other two units, and in pixels at your DPI. **Copy size** puts it on the clipboard. Under the preview, **Measurements** lists every zone, and **Guide positions** gives distances from the top-left corner of the canvas so you can place rulers or shapes by number.

**Download**

| Version | File types | Use it to |
| --- | --- | --- |
| **Template** | PNG, JPG, PDF | See all the zones labelled; upload as a background guide |
| **Guides overlay** | PNG, PDF | Lay transparent guides *over* finished artwork (JPG can't be transparent) |

PNG is lossless; JPG is smaller. Both are tagged with your DPI so design tools open them at the real size. The PDF is vector, one page, exactly the cover size: print it at 100% and measure with a ruler. **Copy measurements** / **Save as text** give a plain-text summary.

### Colour key

| Mark | Paperback | Hardcover |
| --- | --- | --- |
| Red band | **Bleed**: extend artwork into it; it is trimmed off | **Wrap**: extend artwork into it; it folds around the board |
| Amber band | **Trim variance**: keep text out | **Margin**: keep text out |
| Teal band | | **Hinge**: no text or barcode beside the spine |
| Green dashed box | **Safe area** for the back and front covers | same |
| Blue dashed box | **Spine text zone** (0.0625" clear of each fold; 79+ pages) | **Spine text zone** |
| Black dashed line | **Trim line** | **Board edge** |
| Purple dashed lines | **Spine folds** | **Spine edges** |
| White dashed box | **Barcode area**: KDP places an ISBN barcode here if you don't supply one | same |

## Interior (low-content books)

Builds a print-ready interior PDF for coloring and activity books (one of your images per page) and for journals, notebooks and planners (wide or college rule, dot grid, graph, handwriting practice or blank pages). Trim size, binding and paper come from **Your book**.

- **Printing: Front only** puts every page on a right-hand page with a blank back (best for coloring books: no marker bleed-through). **Front and back** prints both sides.
- **Bleed**: choose it only if your art runs off the edge of the page; otherwise choose **No bleed**. Bleed pages are trim + 0.125" wide and + 0.25" tall and images fill them; without bleed, images are fitted inside the margins. Pick the same option on KDP.
- Mirrored margins with KDP's page-count-based gutter; optional "This book belongs to", title and copyright pages; spread preview; checks for page-count limits, low DPI and blank-page runs. The PDF embeds every font.
- **Your cover** shows the full-wrap, front, back and spine sizes for the finished page count. Add front (and optional back) art, spine colour and text, and download a full-wrap cover PDF. **Use this page count in "Your book"** keeps the other tabs in step.

## Kindle eBook

An eBook cover is one front image sized in **pixels**: no spine, back cover or bleed. Pick KDP's ideal size (1600 × 2560 px), the HD size, the minimum, or a custom size. The template shows the size, a suggested text margin (a design aid, not a KDP rule), the 3–4 px gray border KDP suggests for white covers, and what to leave out. JPG is KDP's preferred format.

## Preflight

1. Fill in **Your book** on the left to match the book you are about to upload.
2. Choose your finished cover (or drop it on the box): PDF, PNG or JPG.
3. Read the checklist:
   - **Page size / shape**: does it match the canvas this book needs? A PDF must be exactly the right size; an image must have the right proportions.
   - **Resolution** (images): effective DPI when spread over the full cover; KDP asks for 300.
   - **Pages**: the PDF must be one page with back, spine and front together.
   - **File type and size**.
4. If something is off, the message says why where it can: rotated file, no bleed, front cover only, the wrong binding, or a spine width that implies a different page count.
5. Check the preview: your artwork with the guides on top. Switch **Guides off** to see it clean.

Preflight cannot check embedded fonts, color mode, transparency, the resolution of images *inside* a PDF, or whether text sits in the safe zone. Those are listed under **What this doesn't check**. KDP publishes no size tolerance; this app treats ±0.005" as an exact match and ±0.03" as "close".

### Interior preflight

Switch Preflight to **Interior** and choose your interior PDF (the book's binding, trim size and paper must be set; the page count can be blank). It checks:

- **Page size and bleed**: the trim size (no bleed) or 0.125" wider and 0.25" taller (bleed), and that every page is the same size.
- **Page count**: within KDP's limits, and whether it matches the cover. **Set the book to … pages** updates the cover template.
- **Margins**: anything printed within 0.25" (no bleed) or 0.375" (bleed) of the outside, top and bottom edges, or inside the gutter, which grows with the page count. With bleed, art may run off the edge, but text should stay out of the margins.
- **Fonts**: all embedded.
- **Image resolution**: the printed resolution of every placed image; KDP asks for 300 DPI.

Up to 300 pages are measured.

## ISBN barcode

On the **Cover template** tab, enter your ISBN (10 or 13 digits) and optionally a price add-on (`14.99`, or `90000` for no price). Download it as PDF, PNG (300 DPI) or SVG and place it inside the barcode area. 85% is the usual size for books. With a free KDP ISBN, or an empty barcode area, KDP prints the barcode itself.

## Book projects

The **Projects** button saves everything for one book: Your book, every tab's settings, the Page designer pages and the puzzles. Save, open, rename, start a new book, or export a project file (with its Page designer images) for backup or another computer. Uploaded covers and coloring pages are not kept in a project.

## 3D mockup

1. **Artwork.** Choose **Full wrap cover** and upload your finished cover; the back, spine and front are cut out using your book settings. Or choose **Front cover only**, upload the front, and pick a spine and back colour (or upload a back cover). With nothing uploaded, the cover template is used as a placeholder.
2. **Pose.** Standing, Front on, Floating, Pair, Stack, Lying flat, Back + spine, Spine. Drag to orbit, scroll to zoom, **Reset view** to go back.
3. **Image shape.** Square 1:1 is the default (ideal for square coloring books and listing images), plus 4:5, 2:3, 3:2 and 16:9.
4. **Background, finish, shadow, spine crease.** Matte or glossy covers; a transparent background keeps the soft shadow. The **spine crease** (a faint fold line beside the spine, like a novel) is off by default because coloring-book covers are flat; turn it on if you want it.
5. **Download** as PNG or JPG at 1000–4000 px on the longest side (JPG can't be transparent).

For hardcovers the book is built with boards, a case spine and a recessed page block. For right-to-left books the spine is on the right.

## FAQ

**Why is my spine text zone missing?** KDP rejects paperback covers with spine text under 79 pages. The spine is still shown so you can keep it clear.

**My page count changed. Do I need a new template?** Yes. Spine width, and therefore the canvas width, changes with the page count.

**Do the numbers match KDP's calculator?** Yes. The hardcover numbers were checked against 10 runs of the live calculator and the paperback numbers against its published workbook and live runs. See [KDP-SPECS.md](KDP-SPECS.md).

**The mockup says WebGL could not start.** The 3D view needs WebGL. Update your graphics driver or try a different browser. Everything else still works.

**Is anything uploaded?** No. Everything is computed on your computer.
