// sidalog: "Suggest a place" and "Feedback on this place", delivered to Sida by email.
// SIDALOG_FEEDBACK.mode: 'script' posts to Sida's Google Apps Script (emails him); 'mailto' opens the visitor's mail app.
(function () {
  const C = window.SIDALOG_FEEDBACK || {};
  const $ = s => document.querySelector(s);

  const css = document.createElement('style');
  css.textContent = `
  .fb-scrim{position:fixed;inset:0;background:rgba(17,24,39,.45);z-index:80;display:grid;place-items:end center}
  @media (min-width:640px){.fb-scrim{place-items:center}}
  .fb{background:var(--surface);color:var(--ink);width:min(520px,100%);max-height:92vh;overflow:auto;border-radius:20px 20px 0 0;padding:22px 20px calc(20px + env(safe-area-inset-bottom));box-shadow:var(--shadow-lg)}
  @media (min-width:640px){.fb{border-radius:20px}}
  .fb h2{margin:0 0 4px;font-size:1.15rem;font-weight:800;letter-spacing:-.01em}
  .fb .fb-sub{margin:0 0 16px;color:var(--muted);font-size:.86rem}
  .fb label{display:block;font-size:.8rem;font-weight:700;margin:12px 0 6px;color:var(--ink-2)}
  .fb label small{font-weight:500;color:var(--muted)}
  .fb input,.fb textarea{width:100%;border:1px solid var(--line);background:var(--soft);border-radius:12px;padding:10px 12px;font:inherit;font-size:.92rem;color:var(--ink)}
  .fb input:focus,.fb textarea:focus{outline:none;border-color:var(--accent);background:var(--surface)}
  .fb textarea{min-height:96px;resize:vertical}
  .fb .row{display:flex;gap:10px}.fb .row>div{flex:1;min-width:0}
  .fb .fb-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}
  .fb .fb-btn{border:0;border-radius:12px;padding:11px 18px;font-weight:700;font-size:.9rem;cursor:pointer}
  .fb .fb-send{background:var(--ink);color:var(--surface)}.fb .fb-send:disabled{opacity:.6}
  .fb .fb-cancel{background:var(--soft);color:var(--ink)}
  .fb .fb-msg{margin-top:12px;font-size:.86rem}
  .fb .fb-msg.err{color:#B42318}
  .fb .fb-done{text-align:center;padding:18px 4px}.fb .fb-done b{display:block;font-size:1.05rem;margin-bottom:6px}
  .fb .hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
  .fb-link{display:inline-flex;align-items:center;gap:6px;border:0;background:none;padding:0;font:inherit;font-size:.84rem;font-weight:600;color:var(--accent);cursor:pointer;text-decoration:underline;text-underline-offset:3px}
  .fb-cta{margin-top:10px;border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:9px 16px;font:inherit;font-size:.86rem;font-weight:700;color:var(--ink);cursor:pointer;font-style:normal}
  .fb-cta:hover{background:var(--soft)}`;
  document.head.append(css);

  const el = (t, a = {}, kids = []) => { const e = document.createElement(t); for (const [k, v] of Object.entries(a)) { if (k === 'text') e.textContent = v; else e.setAttribute(k, v); } kids.forEach(k => e.append(k)); return e; };

  function field(id, label, opt, tag = 'input', attrs = {}) {
    const wrap = el('div');
    const l = el('label', { for: id }); l.append(label); if (opt) l.append(el('small', { text: ' (optional)' }));
    const i = el(tag, { id, ...attrs });
    wrap.append(l, i);
    return [wrap, i];
  }

  function open(kind, place) {
    const me = window.__sidalogUser || {};
    const scrim = el('div', { class: 'fb-scrim', role: 'presentation' });
    const box = el('div', { class: 'fb', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'fb-title' });
    const isFb = kind === 'feedback';
    box.append(el('h2', { id: 'fb-title', text: isFb ? 'Feedback on ' + place : 'Suggest a place' }));
    box.append(el('p', { class: 'fb-sub', text: isFb ? 'Closed, price changed, a must-order dish? Tell Sida.' : 'Know somewhere great that isn’t overhyped? Sida reads every suggestion.' }));
    const form = el('form', { novalidate: '' });
    let fPlace, fWhere;
    if (!isFb) {
      const [w1, i1] = field('fb-place', 'Place name', false, 'input', { required: '', placeholder: 'e.g. Kok Sen Restaurant', autocomplete: 'off' });
      const [w2, i2] = field('fb-where', 'Google Maps link or area', true, 'input', { placeholder: 'Paste a link, or e.g. Chinatown' });
      fPlace = i1; fWhere = i2; form.append(w1, w2);
    }
    const [w3, fMsg] = field('fb-msg', isFb ? 'Your feedback' : 'Why it’s worth adding', !isFb, 'textarea', { ...(isFb ? { required: '' } : {}), placeholder: isFb ? 'What should Sida know?' : 'What to order, the vibe, price…' });
    form.append(w3);
    const row = el('div', { class: 'row' });
    const [w4, fName] = field('fb-name', 'Your name', true, 'input', { autocomplete: 'name' });
    const [w5, fEmail] = field('fb-email', 'Email for a reply', true, 'input', { type: 'email', autocomplete: 'email' });
    fName.value = me.name || ''; fEmail.value = me.email || '';
    row.append(w4, w5); form.append(row);
    const hp = el('div', { class: 'hp', 'aria-hidden': 'true' }); const hpi = el('input', { tabindex: '-1', autocomplete: 'off', name: '_honey' }); hp.append(hpi); form.append(hp);
    const msg = el('div', { class: 'fb-msg', role: 'status' });
    const actions = el('div', { class: 'fb-actions' });
    const cancel = el('button', { type: 'button', class: 'fb-btn fb-cancel', text: 'Cancel' });
    const send = el('button', { type: 'submit', class: 'fb-btn fb-send', text: C.mode === 'mailto' ? 'Open email' : 'Send' });
    actions.append(cancel, send); form.append(msg, actions);
    box.append(form); scrim.append(box); document.body.append(scrim);
    (fPlace || fMsg).focus();

    const close = () => { scrim.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    cancel.onclick = close;
    scrim.addEventListener('click', e => { if (e.target === scrim) close(); });

    form.onsubmit = async e => {
      e.preventDefault();
      msg.className = 'fb-msg'; msg.textContent = '';
      if (fPlace && !fPlace.value.trim()) { msg.className = 'fb-msg err'; msg.textContent = 'Please add the place name.'; return; }
      if (isFb && !fMsg.value.trim()) { msg.className = 'fb-msg err'; msg.textContent = 'Please write a short message.'; return; }
      if (hpi.value) { close(); return; }
      const subject = isFb ? `sidalog feedback: ${place}` : `sidalog suggestion: ${fPlace.value.trim()}`;
      const lines = [
        isFb ? `Place: ${place}` : `Place: ${fPlace.value.trim()}`,
        !isFb && fWhere.value.trim() ? `Where / link: ${fWhere.value.trim()}` : '',
        fMsg.value.trim() ? `Message: ${fMsg.value.trim()}` : '',
        fName.value.trim() ? `From: ${fName.value.trim()}` : '',
        fEmail.value.trim() ? `Reply to: ${fEmail.value.trim()}` : '',
      ].filter(Boolean);
      if (C.mode === 'mailto') {
        location.href = `mailto:${C.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
        close(); return;
      }
      send.disabled = true; send.textContent = 'Sending…';
      try {
        const body = {
          subject,
          Type: isFb ? 'Feedback' : 'New place suggestion',
          Place: isFb ? place : fPlace.value.trim(),
          'Where / link': !isFb ? fWhere.value.trim() : '',
          Message: fMsg.value.trim(),
          From: fName.value.trim(),
          'Reply to': fEmail.value.trim(),
          Page: location.href,
        };
        // Apps Script web app: plain-text POST avoids a CORS preflight; the response is opaque.
        await fetch(C.endpoint, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
        box.innerHTML = '';
        const done = el('div', { class: 'fb-done' });
        done.append(el('b', { text: 'Thank you!' }), el('span', { text: isFb ? 'Your feedback is on its way to Sida.' : 'Your suggestion is on its way to Sida.' }));
        const ok = el('div', { class: 'fb-actions' }); const b = el('button', { type: 'button', class: 'fb-btn fb-send', text: 'Done' }); b.onclick = close; ok.append(b);
        box.append(done, ok); b.focus();
      } catch (err) {
        send.disabled = false; send.textContent = 'Send';
        msg.className = 'fb-msg err'; msg.textContent = 'Sorry, that didn’t send. Please try again in a moment.';
      }
    };
  }

  window.SidalogFeedback = { open };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-fb]');
    if (!b) return;
    e.preventDefault();
    open(b.dataset.fb, b.dataset.place || '');
  });
})();
