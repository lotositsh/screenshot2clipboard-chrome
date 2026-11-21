const DEFAULTS = {
  mode: 'clipboard',
  convert: true,
  format: 'image/webp',
  quality: 0.8,
  expiration: 0,
  nameTemplate: 'image',
  utc: false,
  apiKey: ''
};

const PRESETS = [
  ['image (standard, no date)',            'image'],
  ['Date-time: 2026-10-23_20-22-15',       '{YYYY}-{MM}-{DD}_{hh}-{mm}-{ss}'],
  ['Date-time: 2026-10-23-20-22-15',       '{YYYY}-{MM}-{DD}-{hh}-{mm}-{ss}'],
  ['Date-time joined: 20261023-202215',    '{YYYY}{MM}{DD}-{hh}{mm}{ss}'],
  ['Date-time fully joined: 20261023202215','{YYYY}{MM}{DD}{hh}{mm}{ss}'],
  ['Date-time with ms',                    '{YYYY}{MM}{DD}-{hh}{mm}{ss}-{ms}'],
  ['Date only: 2026-10-23',                '{YYYY}-{MM}-{DD}'],
  ['Time only: 20-22-15',                  '{hh}-{mm}-{ss}'],
  ['Time only joined: 202215',             '{hh}{mm}{ss}'],
  ['Unix time: 1792787259',                '{unix}'],
  ['Unix time ms',                         '{unixms}'],
  ['Name + unix time: shot-1792787259',    'shot-{unix}'],
  ['Name + unix time joined: shot1792787259', 'shot{unix}'],
  ['Name + date-time: shot_2026-10-23_20-22-15', 'shot_{YYYY}-{MM}-{DD}_{hh}-{mm}-{ss}'],
  ['Name + date-time joined: shot-20261023-202215', 'shot-{YYYY}{MM}{DD}-{hh}{mm}{ss}'],
  ['Name + time: shot-20-22-15',           'shot-{hh}-{mm}-{ss}'],
  ['Name + counter: image_001',            'image_{n3}'],
  ['Name + random: shot-a1b2c3',           'shot-{rand}'],
  ['Random only: a1b2c3',                  '{rand}'],
  ['Random long',                          '{rand12}'],
  ['UUID',                                 '{uuid}'],
  ['Custom (type below)',                  '']
];

const $ = (id) => document.getElementById(id);

function currentMode() {
  return document.querySelector('input[name=mode]:checked').value;
}

function refreshState() {
  const imgbb = currentMode() === 'imgbb';
  $('imgbbBox').disabled = !imgbb;
  if (imgbb) {
    const conv = $('convert').checked;
    $('format').disabled = !conv;
    $('quality').disabled = !conv;
  }
}

function updatePreview() {
  const tpl = $('nameTemplate').value;
  const name = buildName(tpl || 'image', { utc: $('utc').checked, n: 1 });
  $('preview').textContent = name + '.' + extFor();
}

function extFor() {
  if (!$('convert').checked) return 'png';
  return $('format').value === 'image/webp' ? 'webp' : 'jpg';
}

function syncPresetFromTemplate() {
  const tpl = $('nameTemplate').value;
  const idx = PRESETS.findIndex((p) => p[1] === tpl && p[1] !== '');
  $('namePreset').value = String(idx >= 0 ? idx : PRESETS.length - 1);
}

function fillPresets() {
  PRESETS.forEach((p, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = p[0];
    $('namePreset').appendChild(o);
  });
}

async function load() {
  fillPresets();
  const s = await chrome.storage.local.get(DEFAULTS);
  document.querySelector('input[name=mode][value=' + s.mode + ']').checked = true;
  $('convert').checked = s.convert;
  $('format').value = s.format;
  $('quality').value = String(s.quality);
  $('expiration').value = String(s.expiration);
  $('nameTemplate').value = s.nameTemplate;
  $('utc').checked = s.utc;
  $('apiKey').value = s.apiKey;
  syncPresetFromTemplate();
  refreshState();
  updatePreview();
}

async function save() {
  await chrome.storage.local.set({
    mode: currentMode(),
    convert: $('convert').checked,
    format: $('format').value,
    quality: parseFloat($('quality').value),
    expiration: parseInt($('expiration').value, 10),
    nameTemplate: $('nameTemplate').value.trim() || 'image',
    utc: $('utc').checked,
    apiKey: $('apiKey').value.trim()
  });
  $('msg').textContent = 'Saved';
  setTimeout(() => { $('msg').textContent = ''; }, 2000);
}

document.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', refreshState));
$('convert').addEventListener('change', () => { refreshState(); updatePreview(); });
$('format').addEventListener('change', updatePreview);
$('namePreset').addEventListener('change', () => {
  const tpl = PRESETS[parseInt($('namePreset').value, 10)][1];
  if (tpl !== '') $('nameTemplate').value = tpl;
  updatePreview();
});
$('nameTemplate').addEventListener('input', () => { syncPresetFromTemplate(); updatePreview(); });
$('utc').addEventListener('change', updatePreview);

// Autosave: any change is stored automatically (text fields are debounced)
let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; save(); }, 300);
}
document.querySelectorAll('input, select').forEach((el) => {
  el.addEventListener('change', scheduleSave);
  el.addEventListener('input', scheduleSave);
});
window.addEventListener('pagehide', () => {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; save(); }
});
load();
