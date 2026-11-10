/** The ISBN barcode card on the Cover template tab. */

import { barcodeScene, parseIsbn, priceAddon, sceneToPdf, sceneToRaster, sceneToSvg, type Scene } from '../core';
import { $, toast } from './dom';
import { saveFile } from './files';
import { loadFonts } from './media';

export function initBarcode(): void {
  const isbn = $<HTMLInputElement>('bc-isbn');
  const price = $<HTMLInputElement>('bc-price');
  const scale = $<HTMLSelectElement>('bc-scale');
  const msg = $('bc-msg');
  const preview = $('bc-preview');
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-bc]')];
  let scene: Scene | null = null;
  let code = '';

  function update(): void {
    scene = null;
    const raw = isbn.value.trim();
    const p = priceAddon(price.value);
    const i = raw ? parseIsbn(raw) : null;
    if (!i) msg.textContent = 'Enter your ISBN to make a barcode.';
    else if (!i.ok) msg.textContent = i.error ?? '';
    else if (!p.ok) msg.textContent = p.error ?? '';
    else {
      code = i.isbn13;
      scene = barcodeScene({ isbn13: i.isbn13, addon: p.code || undefined, scale: Number(scale.value) });
      msg.textContent = `ISBN ${i.isbn13}${p.code ? `, add-on ${p.code}` : ''}. ${scene.width.toFixed(2)}" × ${scene.height.toFixed(2)}", black on white. Place it inside the barcode area on the back cover.`;
    }
    preview.hidden = !scene;
    preview.innerHTML = scene ? sceneToSvg(scene, { title: `ISBN ${code} barcode` }) : '';
    for (const b of buttons) b.disabled = !scene;
  }

  for (const el of [isbn, price]) el.addEventListener('input', update);
  scale.addEventListener('change', update);
  for (const b of buttons)
    b.addEventListener('click', async () => {
      if (!scene) return;
      const name = `isbn-barcode_${code}`;
      try {
        let r;
        if (b.dataset.bc === 'svg') r = await saveFile(`${name}.svg`, sceneToSvg(scene, { title: `ISBN ${code}`, sized: true }), 'image/svg+xml');
        else if (b.dataset.bc === 'png') {
          const img = await sceneToRaster(scene, 300, 'png');
          r = await saveFile(`${name}.png`, img.bytes, img.mime);
        } else r = await saveFile(`${name}.pdf`, await sceneToPdf(scene, { title: `ISBN ${code} barcode`, fonts: await loadFonts() }), 'application/pdf');
        if (r.saved) toast(r.path ? `Saved ${r.path}` : 'Barcode downloaded');
      } catch (err) {
        toast(`Could not save the barcode: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  update();
}
