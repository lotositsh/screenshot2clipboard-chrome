// Shared by background.js and options.js
function pad(n, len) {
  return String(n).padStart(len || 2, '0');
}

function randomString(len) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = '';
  for (const b of bytes) out += chars[b % chars.length];
  return out;
}

function sanitizeName(name) {
  let out = name.replace(/[\\\/:*?"<>|\u0000-\u001f]/g, '').replace(/^[.\s]+|[.\s]+$/g, '');
  if (out.length > 100) out = out.slice(0, 100);
  return out || 'image';
}

// opts: { utc: boolean, n: number }
function buildName(template, opts) {
  const o = opts || {};
  const d = new Date();
  const utc = !!o.utc;
  const Y = utc ? d.getUTCFullYear() : d.getFullYear();
  const M = (utc ? d.getUTCMonth() : d.getMonth()) + 1;
  const D = utc ? d.getUTCDate() : d.getDate();
  const h = utc ? d.getUTCHours() : d.getHours();
  const m = utc ? d.getUTCMinutes() : d.getMinutes();
  const s = utc ? d.getUTCSeconds() : d.getSeconds();
  const ms = utc ? d.getUTCMilliseconds() : d.getMilliseconds();
  const n = o.n || 1;
  const tokens = {
    YYYY: () => pad(Y, 4),
    YY: () => pad(Y % 100),
    MM: () => pad(M),
    DD: () => pad(D),
    hh: () => pad(h),
    mm: () => pad(m),
    ss: () => pad(s),
    ms: () => pad(ms, 3),
    unix: () => String(Math.floor(d.getTime() / 1000)),
    unixms: () => String(d.getTime()),
    rand: () => randomString(6),
    rand12: () => randomString(12),
    uuid: () => crypto.randomUUID(),
    n: () => String(n),
    n3: () => pad(n, 3),
    n5: () => pad(n, 5)
  };
  const raw = template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(tokens, key) ? tokens[key]() : match);
  return sanitizeName(raw);
}
