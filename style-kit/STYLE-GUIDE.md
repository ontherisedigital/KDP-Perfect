# On the Rise Digital app style guide ("liquid glass")

The look and feel of Color Palette Studio, written so every app can match it. Alison's favorite UI so far, so match it closely.

**The kit:** `studio-theme.css` (everything below in one file), plus the three fonts in `assets/fonts/` (`fredoka-latin.woff2`, `dosis-latin.woff2`, `arima-bold-latin.woff2`) and their licence texts in `Legal/licences/` (keep them with the fonts). Copy those into the new app, fix the font paths at the top of the CSS, and link the stylesheet.

## The feel

Playful, soft, a little glossy. Frosted glass panels float over a slowly drifting, colorful background. Everything that appears **rises, deals or pops in** with a springy ease, and everything you press **squishes down, then springs back**. It is friendly and quick, never sterile. Designed touch-first (it is tested on an iPad), with large round targets, and it works in light and dark mode.

## Fonts (always these three)

| Font | Used for | CSS |
|---|---|---|
| **Fredoka** | Headings (palette names are the one exception, see below) | `font-family: var(--display)`, weight 800 (`.display`) |
| **Dosis** | Subtitles, subheadings and body text, buttons, labels | `var(--body)`, weight 500 by default, 800 for bold |
| **Arima Bold** | Titles and section headers, including the name of the item you are looking at | `var(--title)`, weight 700 (`.title-font`) |

- Dosis is slim and looks small, so the kit sets `html { font-size: 106.25% }` and a body weight of 500. Keep both.
- Section headers: Arima Bold, small, uppercase, letter-spaced, in the soft ink color (`.section-h`).
- Never fetch fonts from the internet. They are bundled so the app works offline.

## Color

Tokens are CSS variables on `:root`, with a dark-mode override:

- **Ink:** `--ink #17213D` (text), `--ink-soft #56658C` (secondary text and labels). Dark mode: `#EEF3FF` and `#A5B3D6` on `--bg #0A0F21`.
- **Accent:** blue `--accent #1A7FD8` to violet `--accent-2 #6A5CFF`, used as a 135° gradient on primary buttons, selected chips and badges. Text on it is white.
- **Ambient colors:** `--a1 #33ADE8`, `--a2 #8EDCF7`, `--a3 #B79CFF`, `--a4 #FF8FB1` tint four blurred blobs behind everything. An app may retint these from its own content (Color Palette Studio uses the colors on screen), with a 1.4 s fade.
- **Glass:** white at 46% (panels), 74% (dialogs, hover), 38% (insets such as inputs), with a 75% white border. Dark mode swaps to translucent navy.
- **Extras:** star/favorite `#FFE27A → #FFB443`; danger `#FF6B6B → #E8365D`.
- Keep text contrast readable (aim for WCAG AA) on glass.

## Shape and depth

- Panels use `--radius: 26px`; dialogs 28px; buttons, chips and segmented controls are full pills (`999px`); icon buttons are circles; inputs 12–14px.
- Glass = `backdrop-filter: blur(22px) saturate(180%)`, a 1px light border, a soft blue shadow, and two glossy highlights (an inner top edge and a curved sheen). Use the `.glass` class and let it do that.
- Primary buttons have a gloss: a lighter top half.

## Motion (this is most of the personality)

- **Easing:** one springy curve everywhere, `--spring: cubic-bezier(.3, 1.45, .45, 1)`. It slightly overshoots.
- **Entrances:** panels `rise` (6px up), cards `card-in` (18px up, slight scale), tiles and swatches `deal` (like dealing cards: up, a little rotation, 30 ms apart per item), dialogs and menus `pop-in`.
- **Presses:** buttons scale to .95 on press; icon buttons to .9; tiles to .94. Hover lifts 1–3px.
- **Hover wiggle:** icons on tiles `bob` (up and a small rotation).
- **Segmented controls:** the highlight ("ink") slides between choices on the spring curve, with a quick stretch while it moves.
- **Pointer sheen:** on devices with a mouse, a soft light follows the pointer across glass panels.
- **Feedback:** short haptic buzz on taps where supported; a little confetti burst when saving a favorite.
- **Reduced motion:** always honor `prefers-reduced-motion` (the kit does).

## Layout

- Sticky glass top bar with the brand at left and navigation in a segmented control; on phones (≤ 700 px) the navigation moves to a dock at the bottom.
- Two-column "tool + results" layout on wide screens (a 340 px control panel and the results), single column below 960 px. Panels are sticky when they sit beside scrolling content.
- Generous spacing (gaps of 12–28 px), big touch targets (at least 40 px), content fluid with `clamp()` side padding.

## Writing style

Friendly and short, in plain words ("Tap a color to copy it", "Pick a color, then tap a shape to repaint it"). Say "tap" (works for touch and click). Light touches of emoji only where the content calls for it (theme names). No jargon. Error and empty states are kind and tell you what to do next.

## Copy-paste: the JavaScript bits the CSS expects

```js
// Pointer-following sheen on glass panels (skip on touch devices).
export function initSheen() {
  if (matchMedia('(hover: none)').matches) return;
  let last = null;
  document.addEventListener('pointermove', (e) => {
    const g = e.target.closest?.('.glass');
    if (last && last !== g) last.classList.remove('lit');
    if (!g) { last = null; return; }
    const r = g.getBoundingClientRect();
    g.style.setProperty('--mx', `${e.clientX - r.left}px`);
    g.style.setProperty('--my', `${e.clientY - r.top}px`);
    g.classList.add('lit');
    last = g;
  }, { passive: true });
}

// Slide the segmented control's ink under the selected button (call again whenever .is-on changes).
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export function syncSegment(seg) {
  const ink = seg.querySelector('.seg-ink'), on = seg.querySelector('.is-on');
  if (!ink || !on) return;
  const prev = ink.style.left;
  ink.style.left = `${on.offsetLeft}px`;
  ink.style.width = `${on.offsetWidth}px`;
  if (prev && prev !== ink.style.left && !reducedMotion()) {
    ink.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(1.18) scaleY(.9)' }, { transform: 'scaleX(1)' }], { duration: 420, easing: 'ease-out' });
  }
}

// Light tap feedback where the device supports it.
export function haptic(ms = 8) {
  try { if (navigator.userActivation?.hasBeenActive === false) return; navigator.vibrate?.(ms); } catch { /* unsupported */ }
}
```

## Copy-paste: the markup patterns

```html
<div class="ambient" aria-hidden="true"><i class="blob b1"></i><i class="blob b2"></i><i class="blob b3"></i><i class="blob b4"></i></div>

<header class="topbar">
  <a class="brand"><span class="brand-name">App <b>Name</b></span></a>
  <nav class="seg glass" id="main-nav"><span class="seg-ink"></span>
    <button class="is-on">Create</button><button>Library</button>
  </nav>
</header>

<section class="card glass">
  <h2 class="title-font">Item name</h2>            <!-- Arima Bold -->
  <h3 class="display">A heading</h3>               <!-- Fredoka -->
  <p>Body text in Dosis.</p>
  <h4 class="section-h">Section header</h4>
  <button class="btn btn-primary">Primary</button>
  <button class="btn btn-glass">Secondary</button>
  <button class="icon-btn" aria-label="More">…</button>
  <span class="fchips"><button class="fchip is-on">On</button><button class="fchip">Off</button></span>
</section>

<dialog class="modal glass">
  <form method="dialog" class="modal-head"><h2>Dialog title</h2><button class="icon-btn" aria-label="Close" value="close">✕</button></form>
  …
</dialog>
```

## Prompt to give another chat

> Match this app's UI to the "liquid glass" style guide. Use the files in `docs/style-kit/` from the Color Palette Studio project (`studio-theme.css` and `STYLE-GUIDE.md`) and the three bundled fonts (Fredoka for headings, Dosis for subtitles, subheadings and body, Arima Bold for titles and section headers). Do not invent new colors, fonts or animation curves: use the kit's CSS variables and classes (`.glass`, `.btn`, `.btn-primary`, `.btn-glass`, `.icon-btn`, `.fchip`, `.seg` with `.seg-ink`, `.modal`, `.toast`, `.card`, `.tile`) and its animations (`rise`, `card-in`, `deal`, `pop-in`, `bob`) with the `--spring` easing. Keep it touch-first (iPad), keep it working offline, support light and dark mode and `prefers-reduced-motion`, and keep the friendly, short, plain-language tone. When adding a screen, reuse these patterns before writing new CSS.
