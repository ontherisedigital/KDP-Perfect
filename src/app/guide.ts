/**
 * The User Guide: every feature, how to use it, and the tips that matter. Opens from the "User Guide" button in the
 * top bar (or F1). Works offline like the rest of the app. Keep one subject per topic; people jump straight to it.
 * The plain-text twin of this guide for GitHub readers is docs/USER-GUIDE.md: keep them in step.
 */

import { BLEED_ADVICE } from '../core';

const REPO = 'https://github.com/ontherisedigital/KDP-Perfect';
const SUPPORT_EMAIL = 'admin@ontherisedigitalhq.com';

interface Topic {
  id: string;
  title: string;
  html: string;
}

const TOPICS: Topic[] = [
  {
    id: 'start',
    title: 'Quick start',
    html: `
      <p><b>KDP Perfect</b> gets your book ready for Amazon KDP: cover templates at the exact size, print-ready interiors
      for low-content books, covers built from your own art, a preflight check and 3D mockups for your listing.</p>
      <h4>Making a paperback or hardcover cover</h4>
      <ol>
        <li>Fill in <b>Your book</b> on the left: binding, trim size, ink and paper, and number of pages. Use the same
        choices you will pick on KDP.</li>
        <li>On <b>Cover template</b>, note the size at the top (or press <b>Copy size</b>) and download the template.</li>
        <li>Design your cover on top of the template in Canva, Affinity, Photoshop or any design app.</li>
        <li>Check the finished file on <b>Preflight</b>, then upload it to KDP.</li>
      </ol>
      <h4>Making a coloring book, journal or planner</h4>
      <ol>
        <li>Set the binding, trim size and ink and paper in <b>Your book</b>.</li>
        <li>Open <b>Interior</b>, add your page images (or pick a page style), and download the interior PDF.</li>
        <li>Press <b>Use this page count in "Your book"</b>, then make your cover at the size shown under
        <b>Your cover</b>, or add your front and back art there to get the finished cover PDF.</li>
      </ol>
      <h4>The tabs</h4>
      <ul>
        <li><b>Cover template</b>: the full-wrap cover size and a marked-up template.</li>
        <li><b>Interior</b>: print-ready interiors for low-content books, and a cover from your art.</li>
        <li><b>Kindle eBook</b>: the front-cover image for the Kindle edition.</li>
        <li><b>Preflight</b>: checks a finished cover file against your book.</li>
        <li><b>3D mockup</b>: pictures of your book for your listing, website and social media.</li>
      </ul>
      <p class="guide-small">Everything you type is remembered on this computer for next time. Nothing is uploaded.</p>`,
  },
  {
    id: 'book',
    title: 'Your book',
    html: `
      <p>The <b>Your book</b> panel on the left is shared by every tab except Kindle eBook. Fill it in once.</p>
      <table class="guide-table"><thead><tr><th>Field</th><th>What to enter</th></tr></thead><tbody>
        <tr><td><b>Binding</b></td><td><b>Paperback</b>, or <b>Hardcover</b> (KDP's case-laminate hardcover). Hardcovers
        have five trim sizes, three paper options and 76 to 550 pages.</td></tr>
        <tr><td><b>Trim size</b></td><td>The finished page size you chose on KDP. Paperbacks also have <b>Custom size</b>
        (4 to 8.5" wide, 6 to 11.69" tall).</td></tr>
        <tr><td><b>Ink and paper</b></td><td>Must match your KDP print options. The paper's thickness sets the spine width.</td></tr>
        <tr><td><b>Number of pages</b></td><td>The page count of your finished interior, as KDP will print it. The spine is
        sized from it.</td></tr>
        <tr><td><b>Advanced › Reading direction</b></td><td>Left to right (back, spine, front), or right to left for
        languages such as Japanese.</td></tr>
        <tr><td><b>Advanced › Safe-zone margin</b></td><td>Paperback only. <b>KDP standard</b> (0.25" from the outer edge)
        or <b>extra cautious</b> (0.375").</td></tr>
      </tbody></table>
      <p>Messages under the form say when something is out of range: too few or too many pages, a paper KDP doesn't offer
      for that binding, or no spine text allowed.</p>
      <p class="guide-tip"><b>Tip:</b> the page count changes the spine width, and with it the whole cover size. If your
      interior gains or loses pages, make a new template.</p>`,
  },
  {
    id: 'cover',
    title: 'Cover template',
    html: `
      <p>The card at the top shows the size to make your cover: in your unit, in the other two units, and in pixels at
      the DPI you choose. <b>Copy size</b> puts it on the clipboard.</p>
      <h4>Downloading</h4>
      <table class="guide-table"><thead><tr><th>Version</th><th>File types</th><th>Use it to</th></tr></thead><tbody>
        <tr><td><b>Template</b></td><td>PNG, JPG, PDF</td><td>See every zone labelled; use it as the bottom layer of your design.</td></tr>
        <tr><td><b>Guides overlay</b></td><td>PNG, PDF</td><td>Lay see-through guides <i>over</i> finished artwork to check it.</td></tr>
      </tbody></table>
      <ul>
        <li>PNG and JPG are tagged with the DPI, so design apps open them at the real size. 300 DPI is what KDP asks for.</li>
        <li>The PDF is vector and exactly the cover size. Print it at 100% (actual size) and measure it with a ruler.</li>
        <li><b>Measurements</b> lists every zone. <b>Guide positions</b> gives distances from the top-left corner, so you
        can place rulers by number. <b>Copy measurements</b> and <b>Save as text</b> give a plain-text summary.</li>
        <li>Units: inches, centimetres or millimetres, from the unit menu.</li>
      </ul>
      <h4>What the colours mean</h4>
      <table class="guide-table"><thead><tr><th>Mark</th><th>Meaning</th></tr></thead><tbody>
        <tr><td>Red band</td><td><b>Bleed</b> (paperback) or <b>wrap</b> (hardcover). Run your background into it; it is trimmed off or folded round the board.</td></tr>
        <tr><td>Amber band</td><td><b>Trim variance</b> or <b>margin</b>. The cut can land anywhere in here: keep text out.</td></tr>
        <tr><td>Teal band</td><td>Hardcover <b>hinge</b>. No text or barcode next to the spine.</td></tr>
        <tr><td>Green dashed box</td><td><b>Safe area</b> for the front and back. Keep all text and important art inside.</td></tr>
        <tr><td>Blue dashed box</td><td><b>Spine text zone</b> (books with 79 pages or more).</td></tr>
        <tr><td>Black dashed line</td><td><b>Trim line</b> or board edge.</td></tr>
        <tr><td>Purple dashed lines</td><td><b>Spine folds</b>.</td></tr>
        <tr><td>White box</td><td><b>Barcode area</b>. KDP prints the barcode here if you don't supply one.</td></tr>
      </tbody></table>
      <p class="guide-tip"><b>Tip:</b> put the template on its own layer at the bottom, design above it, then hide or
      delete the template layer before you export. KDP will print anything you leave on the cover, including the guides.</p>`,
  },
  {
    id: 'interior',
    title: 'Interior: low-content books',
    html: `
      <p>The <b>Interior</b> tab builds a print-ready interior PDF for low-content books. You don't need Kindle Create
      for these: KDP takes the PDF as your manuscript. The trim size, binding, and ink and paper come from <b>Your book</b>.</p>
      <h4>Book type</h4>
      <ul>
        <li><b>Coloring / activity book</b>: one of your images per page. Coloring pages, activity pages, mazes, puzzles,
        word searches.</li>
        <li><b>Journal / notebook / planner</b>: pages the app draws for you. Wide rule (11/32"), college rule (9/32"),
        dot grid, graph paper, handwriting practice or blank. Choose how many writing pages, and whether to add a
        "Date" line and page numbers.</li>
      </ul>
      <h4>Printing: Front only or Front and back</h4>
      <ul>
        <li><b>Front only</b>: each page is printed on one side and its back is left blank. Every design lands on a
        right-hand page. Best for coloring books: markers can't bleed through onto the next design, and pages can be
        cut out and framed.</li>
        <li><b>Front and back</b>: pages print on both sides, like a normal book. Uses half the pages, so the book costs
        less to print.</li>
      </ul>
      <h4>Bleed or No bleed</h4>
      <p class="guide-callout">${BLEED_ADVICE}</p>
      <ul>
        <li><b>No bleed</b>: the PDF pages are exactly the trim size. Your images are shrunk to fit inside the margins and
        centred, so nothing can be cut off.</li>
        <li><b>Bleed</b>: the pages are 0.125" wider and 0.25" taller than the trim size. Your images fill the whole page
        and run off the edges; KDP trims the extra away. Pick <b>Bleed</b> on KDP too when you upload.</li>
        <li>The setting must match what you choose on KDP, or KDP will reject the file.</li>
      </ul>
      <h4>Adding your pages (coloring books)</h4>
      <ul>
        <li>Choose or drop PNG, JPG or WebP files. They are added in file-name order, so naming them 01, 02, 03… keeps
        them in order. Use the arrows to move a page, ✕ to remove it, or <b>Sort by file name</b>.</li>
        <li>Each page shows its <b>DPI</b> at print size: green is 300 or more, amber is a little low, red will look blurry.</li>
        <li>The hint above the list gives the exact pixel size to make your pages so they fit perfectly.</li>
        <li>With bleed, an image that is a different shape from the page is cropped to fill it. The list says how much.</li>
      </ul>
      <h4>Front pages</h4>
      <ul>
        <li><b>This book belongs to</b>: a name page at the very front, with a blank back.</li>
        <li><b>Title page</b>: title, subtitle and author, always on a right-hand page.</li>
        <li><b>Copyright page</b>: printed on the back of the title page. <b>Insert a standard notice</b> fills in a
        simple one you can edit.</li>
        <li>Leave the title empty to start straight with your pages.</li>
      </ul>
      <h4>Margins and page count</h4>
      <ul>
        <li>Margins are mirrored. The inside margin (the <b>gutter</b>, by the spine) grows with the page count, from
        0.375" to 0.875", as KDP requires. The outside, top and bottom margins are at least 0.25" (0.375" with bleed).</li>
        <li>An odd page count gets a blank last page, because pages are printed on both sides of each sheet.</li>
        <li>KDP needs at least 24 pages for a paperback and 76 for a hardcover. The app says how many more pages or
        images you need.</li>
        <li>KDP may reject long runs of blank pages inside the book; the app warns you.</li>
      </ul>
      <h4>Preview and download</h4>
      <ul>
        <li>The preview shows the book as spreads, as it will open. The dashed red line is where the page is trimmed;
        the blue box is the margin. Black-ink books are shown in grey, close to how they will print.</li>
        <li><b>Download interior PDF</b> saves the finished file, at the exact page size and with every font embedded
        (KDP requires embedded fonts).</li>
        <li><b>Use this page count in "Your book"</b> copies the page count to the left panel, so the cover template,
        preflight and mockup all match your interior.</li>
      </ul>`,
  },
  {
    id: 'designer',
    title: 'Page designer',
    html: `
      <p>Build your own planner, journal and notebook pages from a library of elements, add your own images, then repeat
      and date the pages to make a whole book. The page size comes from <b>Your book</b> (set it on the Interior or Cover
      template tab).</p>
      <h4>Layouts</h4>
      <ul>
        <li>Each pill at the top is a <b>page layout</b>. Press <b>+</b> for a new one; click the page background to rename,
        duplicate or delete it on the right.</li>
        <li><b>Start from a template</b>: monthly calendar, weekly and daily planners, habit tracker, year at a glance,
        gratitude journal, bullet-journal key and index, meal planner, year in pixels, and a fun-shape month.</li>
        <li><b>Mirror on left-hand pages</b> flips the layout on left pages so the wide inside margin stays by the spine.</li>
      </ul>
      <h4>Elements</h4>
      <ul>
        <li><b>Calendar</b>: day slot, week, month grid, mini month, year at a glance, date heading.</li>
        <li><b>Planner</b>: checklist / to-do, numbered or bullet list, hourly schedule, habit tracker, counter / water
        tracker, table.</li>
        <li><b>Bullet journal</b>: year in pixels, key / legend, daily log, title banner, mood scale.</li>
        <li><b>Writing</b>: lined, dot grid, graph, handwriting or blank areas, and titled notes boxes.</li>
        <li><b>Basics</b>: text, shapes and frames, lines, dividers, images and page numbers.</li>
      </ul>
      <h4>Shapes, lined or unlined</h4>
      <p>Every calendar slot, frame and tracker can be a rectangle or square, rounded (with a <b>corner roundness</b>
      slider), pill, circle or oval, hexagon, octagon, diamond, arch, ticket, tag, banner, shield, or a fun shape: speech
      bubble, heart, star, flower, cloud, leaf or water drop. Each can be <b>unlined</b>, <b>lined</b>, <b>dotted</b> or
      <b>grid</b> inside, with your own spacing and colour.</p>
      <h4>Placing and editing</h4>
      <ul>
        <li><b>Drag</b> an element from the library onto the page, or click it to add it in the middle.</li>
        <li>Drag to move; drag the square handles to resize (hold <b>Shift</b> on a corner to keep the shape); drag the
        round handle to rotate. <b>Snap</b> lines things up with the page, the margins and other elements, and rotation
        snaps to 15°. Hold <b>Alt</b> to move freely.</li>
        <li>Everything about the selected element is on the right: position, size and rotation in inches, shape, inside
        pattern, colours, lines, text and dates. Duplicate, bring to front, send to back, centre, lock or delete it there.</li>
        <li>Keys: <b>Delete</b> removes, arrows nudge (Shift for bigger steps), <b>Ctrl+Z</b>/<b>Ctrl+Y</b> undo and redo,
        <b>Ctrl+D</b> duplicates, <b>Ctrl+C</b>/<b>Ctrl+V</b> copy and paste.</li>
      </ul>
      <h4>Your images</h4>
      <ul>
        <li>Drop image files onto the page (or onto <b>Your images</b> in the library). They are kept on this computer.</li>
        <li>Drag an image from the library onto the page to place it; drop it on an image frame to swap the picture.</li>
        <li>Image frames can be any shape, and can show the whole image or fill the frame.</li>
      </ul>
      <h4>Dates and page order</h4>
      <ul>
        <li>Calendar elements take their dates <b>from the page</b>, from <b>a date you choose</b>, or are
        <b>undated</b> so buyers fill them in.</li>
        <li><b>Page order</b> lists the layouts in your book and how many copies of each. Set a layout to <b>Daily</b>,
        <b>Weekly</b> or <b>Monthly</b> and every copy gets the next date, from <b>Planner starts on</b>.</li>
        <li><b>Make a year planner</b> builds 12 months, each month page followed by its weekly pages.</li>
        <li><b>Build the book on the Interior tab</b> opens it as <b>My designed pages</b>, where you choose printing,
        bleed and front pages, download the PDF and make the cover.</li>
        <li><b>Save design file</b> keeps the whole design, images included, to open later or on another computer.</li>
      </ul>
      <p class="guide-tip"><b>Tip:</b> keep everything inside the blue box. The designer warns you when something reaches
      into the margins, which KDP may reject.</p>`,
  },
  {
    id: 'puzzles',
    title: 'Puzzles',
    html: `
      <p>The <b>Puzzles</b> tab builds puzzle and activity books: word searches, crosswords, mazes and sudoku, each with
      its answer. It is separate from the Page designer.</p>
      <h4>Adding puzzles</h4>
      <ul>
        <li>Press <b>+ Word search</b>, <b>+ Crossword</b>, <b>+ Maze</b> or <b>+ Sudoku</b>. Each puzzle is one page.
        Click a puzzle in the list to edit it; use the arrows to reorder, ⧉ to duplicate, ✕ to remove.</li>
        <li><b>Word search</b>: one word per line. Choose the grid size, and whether words can run diagonally or
        backwards. If a word doesn't fit, the app says which; make the grid bigger or use fewer words.</li>
        <li><b>Crossword</b>: one answer and clue per line, like <code>WHALE - Largest animal on Earth</code>. The
        app builds the grid and numbers the clues. Words that share letters fit best.</li>
        <li><b>Maze</b>: choose the width in cells; the height follows the page shape. Start is top left, finish bottom right.</li>
        <li><b>Sudoku</b>: easy, medium or hard. Every puzzle has exactly one solution.</li>
        <li><b>New layout</b> makes a fresh arrangement with the same settings. <b>Show the answer</b> previews the solution.</li>
      </ul>
      <h4>Answers and the book</h4>
      <ul>
        <li>Answer pages go after all the puzzles: <b>4 per page</b>, <b>1 per page</b>, or none.</li>
        <li><b>Build the book on the Interior tab</b> opens it as <b>Puzzle book</b>, where you add front pages, choose
        bleed, download the PDF and make the cover.</li>
        <li>Puzzles are kept on this computer and rebuild exactly the same next time.</li>
      </ul>
      <p class="guide-tip"><b>Tip:</b> puzzle books often sell in themed sets. Duplicate a puzzle, change its words, and
      keep the titles consistent (Ocean 1, Ocean 2…).</p>`,
  },
  {
    id: 'cover-art',
    title: 'Cover from your art',
    html: `
      <p>At the bottom of the <b>Interior</b> tab, <b>Your cover</b> shows the sizes to make your cover art for the
      interior you just built, and turns your art into a print-ready full-wrap cover PDF.</p>
      <h4>Sizes</h4>
      <ul>
        <li><b>Full cover</b>: back, spine and front together, including the bleed (paperback) or wrap (hardcover).</li>
        <li><b>Front cover art</b> and <b>back cover art</b>: each panel including its outer bleed or wrap. Make each image
        at the pixel size shown (300 DPI).</li>
        <li><b>Spine</b>: its width depends on the page count and paper. Thin books have very thin spines.</li>
      </ul>
      <h4>Building the cover</h4>
      <ol>
        <li>Add your <b>front cover image</b>. Add a <b>back cover image</b> too, or leave it out and pick a back colour.</li>
        <li>Pick a <b>spine colour</b>. If the book has 79 pages or more, type <b>spine text</b> (usually title and
        author) and pick its colour; it is sized to fit the spine's safe zone automatically.</li>
        <li>Check the preview: the dashed red line is the trim, the blue lines are the spine folds, and the white box is
        where KDP prints the barcode.</li>
        <li>Press <b>Download cover PDF</b> and upload it to KDP as your cover.</li>
      </ol>
      <p class="guide-tip"><b>Tip:</b> keep text and faces at least 0.25" in from the trim line and out of the barcode
      area on the back. Run backgrounds all the way to the edge of the art.</p>`,
  },
  {
    id: 'ebook',
    title: 'Kindle eBook',
    html: `
      <p>An eBook cover is one front image, sized in pixels: no spine, back cover or bleed. It has its own settings on
      the left.</p>
      <ul>
        <li><b>Size</b>: KDP's ideal 1600 × 2560 px, a larger size for HD devices, the minimum, or your own size.</li>
        <li>The template shows a suggested text margin (a design aid, not a KDP rule), and the thin grey border KDP
        suggests for covers with a white background so they stand out on the white store page.</li>
        <li>Download as <b>JPG</b> (KDP's preferred format) or <b>PNG</b>, or as a see-through guides overlay.</li>
      </ul>
      <p class="guide-tip"><b>Tip:</b> your eBook cover is shown as a small thumbnail in the store. Check that the title
      is still readable when the image is about 2 cm tall.</p>`,
  },
  {
    id: 'preflight',
    title: 'Preflight',
    html: `
      <ol>
        <li>Fill in <b>Your book</b> to match the book you are about to upload.</li>
        <li>Choose your finished cover, or drop it on the box: PDF, PNG or JPG.</li>
        <li>Read the checklist:
          <ul>
            <li><b>Page size and shape</b>: a PDF must be exactly the right size; an image must have the right proportions.</li>
            <li><b>Resolution</b> (images): the DPI across the full cover. KDP asks for 300.</li>
            <li><b>Pages</b>: one page with back, spine and front together.</li>
            <li><b>File type and size</b>.</li>
          </ul>
        </li>
        <li>If something is off, the message says why where it can: the file is rotated, has no bleed, is the front cover
        only, is for the other binding, or has a spine for a different page count.</li>
        <li>Look at the preview: your artwork with the guides on top. Switch the guides off to see it clean.</li>
      </ol>
      <p class="guide-small">Preflight cannot check embedded fonts, colour mode, transparency, the resolution of images
      inside a PDF, or whether text sits in the safe area. They are listed under <b>What this doesn't check</b>.</p>`,
  },
  {
    id: 'mockup',
    title: '3D mockup',
    html: `
      <ol>
        <li><b>Artwork</b>: choose <b>Full wrap cover</b> and upload your finished cover (back, spine and front are cut
        out using Your book), or <b>Front cover only</b> with a spine and back colour or a back image. With nothing
        uploaded, the template is used as a stand-in.</li>
        <li><b>Pose</b>: Standing, Front on, Floating, Pair, Stack, Lying flat, Back + spine, or Spine. Drag to turn the
        book, scroll to zoom, <b>Reset view</b> to start again.</li>
        <li><b>Image shape</b>: square 1:1 (best for listings and square coloring books), 4:5, 2:3, 3:2 or 16:9.</li>
        <li><b>Background, finish, shadow, spine crease</b>: matte or glossy, a soft shadow, and an optional crease next
        to the spine. A transparent background keeps the shadow.</li>
        <li><b>Download</b> PNG or JPG, 1000 to 4000 px on the longest side.</li>
      </ol>
      <p class="guide-tip"><b>Tip:</b> use a transparent PNG to place the book on your own photos and graphics in Canva.</p>`,
  },
  {
    id: 'kdp',
    title: 'Uploading to KDP',
    html: `
      <ol>
        <li>On KDP's <b>Paperback Content</b> (or Hardcover Content) page, pick the same <b>ink and paper</b> and
        <b>trim size</b> you set here.</li>
        <li>Choose <b>Bleed</b> or <b>No bleed</b> to match your interior.</li>
        <li><b>Manuscript</b>: upload your interior PDF.</li>
        <li><b>Book cover</b>: choose <b>Upload a cover you already have</b> and upload your cover PDF.</li>
        <li>Use KDP's <b>Print Previewer</b> and read every flagged issue before you approve.</li>
        <li>Order a proof copy before you publish. It is the only way to see the real colours and paper.</li>
      </ol>
      <p class="guide-small">KDP has special options for low-content books (journals, notebooks, planners). Check KDP's
      current help pages for what they allow before you publish one.</p>`,
  },
  {
    id: 'tips',
    title: 'Tips & tricks',
    html: `
      <ul>
        <li><b>Work at 300 DPI.</b> Make page images and cover art at the pixel sizes the app shows; anything smaller
        prints soft.</li>
        <li><b>Black ink books print in grey.</b> Colour images are printed in shades of grey; check the grey preview.</li>
        <li><b>Line art</b>: thicker, darker lines print better than thin grey ones. Aim for lines at least 0.5 pt.</li>
        <li><b>Front only for coloring books</b>: it adds pages, but markers won't ruin the next design.</li>
        <li><b>Name your files 01, 02, 03…</b> so pages land in order.</li>
        <li><b>Change the page count, change the cover.</b> Rebuild the cover whenever the interior changes length.</li>
        <li><b>Print the PDF template at 100%</b> to check measurements with a ruler.</li>
        <li><b>Copy size</b> and <b>Copy measurements</b> are quicker than retyping numbers into a design app.</li>
        <li><b>Press F1</b> anywhere to open this guide.</li>
      </ul>`,
  },
  {
    id: 'trouble',
    title: 'When something goes wrong',
    html: `
      <h4>KDP says my cover is the wrong size</h4>
      <p>The page count, paper or trim size on KDP doesn't match Your book. Fix Your book, make a new template or cover,
      and check it on Preflight.</p>
      <h4>The spine text zone is missing</h4>
      <p>KDP doesn't allow spine text on books under 79 pages. The spine is still shown so you can keep it clear.</p>
      <h4>KDP says content is outside the margins</h4>
      <p>Your art runs past the margins without bleed. Switch to <b>Bleed</b> (and pick Bleed on KDP), or use art with a
      white border.</p>
      <h4>My images look blurry</h4>
      <p>They are under 300 DPI at print size. Make them at the pixel size shown, from the original artwork; enlarging a
      small image doesn't add detail.</p>
      <h4>The 3D mockup says WebGL could not start</h4>
      <p>The 3D view needs graphics acceleration. Update your graphics driver, or try another computer. Everything else
      still works.</p>
      <h4>Do the numbers match KDP's calculator?</h4>
      <p>Yes. Paperback and hardcover sizes are checked against KDP's own calculator in the app's tests.</p>`,
  },
  {
    id: 'privacy',
    title: 'Privacy & help',
    html: `
      <p>Everything happens on your computer. Your files, images and settings are never uploaded. There are no
      accounts, ads or tracking. Settings are kept on this computer only, so the app remembers your book next time.</p>
      <h4>Getting help</h4>
      <p>Questions? Email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>. You can also report a problem or
      suggest a feature on <a href="${REPO}/issues" target="_blank" rel="noopener">GitHub</a>.
      The <a href="${REPO}#readme" target="_blank" rel="noopener">project page</a> has the full documentation and the
      changelog.</p>
      <p class="guide-small">KDP Perfect is not made by or affiliated with Amazon. KDP's rules change from time to time;
      when in doubt, check KDP's help pages.</p>`,
  },
];

let dialog: HTMLDialogElement | null = null;

function build(): HTMLDialogElement {
  const d = document.createElement('dialog');
  d.className = 'guide glass';
  d.setAttribute('aria-labelledby', 'guide-title');
  d.innerHTML = `
    <header class="guide-head">
      <h2 id="guide-title">User Guide</h2>
      <button type="button" class="btn small subtle guide-close" aria-label="Close the User Guide">✕</button>
    </header>
    <div class="guide-body">
      <nav class="guide-nav" aria-label="Guide topics">${TOPICS.map((t) => `<button type="button" data-topic="${t.id}">${t.title}</button>`).join('')}</nav>
      <article class="guide-page" tabindex="-1"></article>
    </div>`;
  const page = d.querySelector<HTMLElement>('.guide-page')!;
  d.addEventListener('click', (e) => {
    if (e.target === d) return d.close(); // click on the backdrop
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-topic]');
    if (t) {
      show(d, t.dataset.topic!);
      page.focus({ preventScroll: true });
    }
    if ((e.target as HTMLElement).closest('.guide-close')) d.close();
  });
  document.body.appendChild(d);
  return d;
}

function show(d: HTMLDialogElement, id: string): void {
  const t = TOPICS.find((x) => x.id === id) ?? TOPICS[0]!;
  const page = d.querySelector<HTMLElement>('.guide-page')!;
  page.innerHTML = `<h3>${t.title}</h3>${t.html}`;
  page.scrollTop = 0;
  d.querySelectorAll<HTMLElement>('[data-topic]').forEach((b) => {
    if (b.dataset.topic === t.id) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
}

/** Open the guide, on a topic (e.g. 'interior') or on Quick start. */
export function openGuide(topic = 'start'): void {
  dialog ??= build();
  show(dialog, topic);
  if (!dialog.open) dialog.showModal();
}

/** Wire the top-bar button, F1, and any `[data-guide="topic"]` link in the page. */
export function initGuide(): void {
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-guide]');
    if (!a) return;
    e.preventDefault();
    openGuide(a.dataset.guide || 'start');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
      e.preventDefault();
      openGuide();
    }
  });
}

export const GUIDE_TOPICS = TOPICS.map((t) => t.id);
