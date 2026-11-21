// Offscreen document: used only to put plain text into the clipboard
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target !== 'offscreen' || msg.type !== 'copy-text') return;
  const ta = document.createElement('textarea');
  ta.value = msg.text;
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  sendResponse({ ok: ok });
});
