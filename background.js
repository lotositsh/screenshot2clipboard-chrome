importScripts('naming.js');

const DEFAULTS = {
  mode: 'clipboard',      // 'clipboard' or 'imgbb'
  convert: true,
  format: 'image/webp',   // 'image/webp' or 'image/jpeg'
  quality: 0.8,
  expiration: 0,          // seconds, 0 = never delete
  nameTemplate: 'image',
  utc: false,
  apiKey: ''
};

const ICON_NORMAL = {
  16: 'icons/icon16.png',
  48: 'icons/icon48.png',
  128: 'icons/icon128.png'
};
const ICON_OK = {
  16: 'icons/icon16_ok.png',
  48: 'icons/icon48_ok.png',
  128: 'icons/icon128_ok.png'
};

// Short blink of the toolbar icon on success
function flashOk() {
  chrome.action.setIcon({ path: ICON_OK });
  setTimeout(() => chrome.action.setIcon({ path: ICON_NORMAL }), 1000);
}

// Red badge for a few seconds on error
function flashError() {
  chrome.action.setBadgeBackgroundColor({ color: '#d33' });
  chrome.action.setBadgeText({ text: '!' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
}

// Re-encode through a canvas: the result is a bare bitmap, no metadata
async function convertBlob(blob, mime, quality) {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  const out = await canvas.convertToBlob({ type: mime, quality: quality });
  if (out.type !== mime) {
    throw new Error('Encoding to ' + mime + ' is not supported');
  }
  return out;
}

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// Runs inside the page (injected), must be self-contained
async function pageCopyImage(b64) {
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'image/png' });
    window.focus();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function copyImage(tabId, pngBlob) {
  const clean = await convertBlob(pngBlob, 'image/png', 1);
  const b64 = await blobToBase64(clean);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: pageCopyImage,
    args: [b64]
  });
  const res = results && results[0] && results[0].result;
  if (!res || !res.ok) {
    throw new Error((res && res.error) || 'Clipboard write failed');
  }
}

async function ensureOffscreen() {
  const url = chrome.runtime.getURL('offscreen.html');
  const existing = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [url]
  });
  if (existing.length > 0) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['CLIPBOARD'],
    justification: 'Copy the imgbb link to the clipboard'
  });
}

async function copyText(text) {
  await ensureOffscreen();
  const res = await chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'copy-text',
    text: text
  });
  if (!res || !res.ok) throw new Error('Copy of the link failed');
}

async function makeName(s) {
  let n = 1;
  if (/\{n(3|5)?\}/.test(s.nameTemplate)) {
    const r = await chrome.storage.local.get({ counter: 0 });
    n = r.counter + 1;
    await chrome.storage.local.set({ counter: n });
  }
  return buildName(s.nameTemplate || 'image', { utc: s.utc, n: n });
}

async function uploadImgbb(pngBlob, s) {
  if (!s.apiKey) {
    chrome.runtime.openOptionsPage();
    throw new Error('API key is not set');
  }
  let blob;
  let ext = 'png';
  if (s.convert) {
    blob = await convertBlob(pngBlob, s.format, s.quality);
    ext = s.format === 'image/webp' ? 'webp' : 'jpg';
  } else {
    blob = await convertBlob(pngBlob, 'image/png', 1);
  }
  const stem = await makeName(s);
  const fd = new FormData();
  fd.append('name', stem);
  if (s.expiration > 0) {
    fd.append('expiration', String(s.expiration));
  }
  fd.append('image', blob, stem + '.' + ext);
  const resp = await fetch(
    'https://api.imgbb.com/1/upload?key=' + encodeURIComponent(s.apiKey),
    { method: 'POST', body: fd }
  );
  const json = await resp.json();
  if (!resp.ok || !json.success) {
    throw new Error((json.error && json.error.message) || ('HTTP ' + resp.status));
  }
  await copyText(json.data.url_viewer);   // looks like https://ibb.co/Wv6DhRdq
}

chrome.action.onClicked.addListener(async (tab) => {
  try {
    const s = await chrome.storage.local.get(DEFAULTS);
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    const pngBlob = await (await fetch(dataUrl)).blob();
    if (s.mode === 'imgbb') {
      await uploadImgbb(pngBlob, s);
    } else {
      await copyImage(tab.id, pngBlob);
    }
    flashOk();
  } catch (err) {
    console.error(err);
    flashError();
  }
});
