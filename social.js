// sidalog social layer: review photos ("Food & vibes"), feedback saved to the database,
// Sida's private Inbox, and places approved from friends' suggestions.
// Loaded by sync.js once Firebase is ready; everything here is optional for the rest of the app.

const OWNER = 'sidaaaaaaa111@gmail.com';
const MAX_PER_PERSON = 4;

export function initSocial(fb) {
  const { db, auth, collection, doc, setDoc, addDoc, getDoc, getDocs, deleteDoc, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp } = fb;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const me = () => auth.currentUser;
  const isOwner = () => !!(me() && me().email && me().email.toLowerCase() === OWNER && me().emailVerified);
  // only ever render genuine JPEG data URLs (stops anything else being injected into the page)
  const okImg = t => typeof t === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(t) ? t : '';
  const rerender = () => window.__rerender && window.__rerender();

  injectCSS();

  // ---------- covers: one small photo per place for the list ----------
  const COVERS = {};
  onSnapshot(collection(db, 'covers'), snap => {
    snap.forEach(d => { COVERS[d.id] = d.data(); });
    snap.docChanges().forEach(c => { if (c.type === 'removed') delete COVERS[c.doc.id]; });
    rerender();
  }, () => {});
  window.__coverOf = id => okImg(COVERS[id] && COVERS[id].t);

  // ---------- photos per place, loaded when a place is opened ----------
  const PH = {};           // pid -> [{id, uid, name, t, at}]
  const loading = new Set();
  async function loadPhotos(pid, force) {
    if ((PH[pid] && !force) || loading.has(pid)) return;
    loading.add(pid);
    try {
      const s = await getDocs(query(collection(db, 'photos'), where('pid', '==', pid)));
      PH[pid] = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => okImg(x.t)).sort((a, b) => (b.at?.toMillis?.() || 0) - (a.at?.toMillis?.() || 0));
    } catch (e) { console.warn('photos unavailable', e); PH[pid] = PH[pid] || []; }
    loading.delete(pid);
    rerender();
  }

  function addHTML(p) {
    if (!me()) return `<p class="ph-hint"><button type="button" class="linkbtn" data-signin>Sign in</button> to add your food &amp; vibe photos</p>`;
    const mine = (PH[p.id] || []).filter(x => x.uid === me().uid).length;
    const left = MAX_PER_PERSON - mine;
    return `<div class="ph-add">
      <label class="btn ghost${left > 0 ? '' : ' off'}"><input type="file" accept="image/*" multiple data-phfile ${left > 0 ? '' : 'disabled'} hidden>
      <svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>${left > 0 ? 'Add photos' : 'Photo limit reached'}</label>
      <span class="ph-note" id="ph-status">${left > 0 ? `Up to ${left} more · everyone can see them` : 'Delete one of yours to add another'}</span></div>`;
  }
  window.__photosHTML = p => {
    if (!PH[p.id]) loadPhotos(p.id);
    const L = PH[p.id] || [];
    if (!L.length && !me()) return '';
    return `<div class="sec ph-sec"><h3>Food &amp; vibes</h3>${L.length ? `<div class="ph-strip">${L.map((x, i) =>
      `<button type="button" class="ph" data-ph="${i}" aria-label="Photo by ${esc(x.name || 'someone')}"><img src="${x.t}" alt=""></button>`).join('')}</div>` : '<p class="ph-note" style="margin-top:0">No photos yet. Be the first to share the food or the vibe.</p>'}
      ${addHTML(p)}</div>`;
  };

  // shrink a photo on the phone before upload
  function shrink(file, max, q) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        let out = c.toDataURL('image/jpeg', q);
        let qq = q;
        while (out.length > 700000 && qq > 0.4) { qq -= 0.1; out = c.toDataURL('image/jpeg', qq); }
        res(out);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Could not read that photo')); };
      img.src = url;
    });
  }

  async function upload(pid, files) {
    const u = me(); if (!u) return;
    const st = document.getElementById('ph-status');
    const mine = (PH[pid] || []).filter(x => x.uid === u.uid).length;
    const list = [...files].slice(0, Math.max(0, MAX_PER_PERSON - mine));
    let n = 0;
    for (const f of list) {
      if (st) st.textContent = `Uploading ${++n} of ${list.length}…`;
      try {
        const full = await shrink(f, 1280, 0.8);
        const t = await shrink(f, 360, 0.72);
        const base = { pid, uid: u.uid, name: (u.displayName || 'Someone').slice(0, 80), at: serverTimestamp() };
        const ref = await addDoc(collection(db, 'photos'), { ...base, t });
        await setDoc(doc(db, 'photoFull', ref.id), { uid: u.uid, pid, d: full });
        const cur = (await getDoc(doc(db, 'covers', pid))).data();
        if (!cur || isOwner() || !cur.own) await setDoc(doc(db, 'covers', pid), { t: await shrink(f, 200, 0.7), uid: u.uid, own: isOwner(), ph: ref.id, at: serverTimestamp() });
      } catch (e) {
        console.warn(e);
        if (st) st.textContent = 'One photo didn’t upload. Please try again.';
      }
    }
    await loadPhotos(pid, true);
  }

  async function removePhoto(pid, x) {
    await deleteDoc(doc(db, 'photos', x.id)).catch(() => {});
    await deleteDoc(doc(db, 'photoFull', x.id)).catch(() => {});
    const cur = COVERS[pid];
    if (cur && cur.ph === x.id) {
      const rest = (PH[pid] || []).filter(y => y.id !== x.id);
      if (rest.length) await setDoc(doc(db, 'covers', pid), { t: rest[0].t, uid: rest[0].uid, own: false, ph: rest[0].id, at: serverTimestamp() }).catch(() => {});
      else await deleteDoc(doc(db, 'covers', pid)).catch(() => {});
    }
    await loadPhotos(pid, true);
  }

  // lightbox
  function openViewer(pid, i) {
    const L = PH[pid] || []; if (!L[i]) return;
    const box = document.createElement('div');
    box.className = 'ph-view';
    const show = async j => {
      i = (j + L.length) % L.length; const x = L[i];
      const can = me() && (x.uid === me().uid || isOwner());
      box.innerHTML = `<div class="ph-bar"><span>${esc(x.name || 'Someone')}</span>${can ? '<button type="button" data-del>Delete</button>' : ''}<button type="button" data-close aria-label="Close">✕</button></div>
        <img src="${x.t}" alt="">${L.length > 1 ? '<button type="button" class="ph-nav prev" data-prev aria-label="Previous">‹</button><button type="button" class="ph-nav next" data-next aria-label="Next">›</button>' : ''}`;
      try { const d = (await getDoc(doc(db, 'photoFull', x.id))).data(); if (d && okImg(d.d) && L[i] === x) box.querySelector('img').src = d.d; } catch (e) {}
    };
    box.addEventListener('click', async e => {
      if (e.target.closest('[data-close]') || e.target === box) box.remove();
      else if (e.target.closest('[data-prev]')) show(i - 1);
      else if (e.target.closest('[data-next]')) show(i + 1);
      else if (e.target.closest('[data-del]')) { if (confirmDelete(box)) { const x = L[i]; box.remove(); await removePhoto(pid, x); } }
    });
    let sx = null;
    box.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1)); sx = null; });
    document.body.append(box); show(i);
  }
  // inline confirm instead of a browser dialog
  function confirmDelete(box) {
    const b = box.querySelector('[data-del]');
    if (b.dataset.sure) return true;
    b.dataset.sure = '1'; b.textContent = 'Tap again to delete';
    setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = 'Delete'; } }, 3000);
    return false;
  }

  document.addEventListener('change', e => {
    const inp = e.target.closest('input[data-phfile]');
    if (inp && window.__sheetId && window.__sheetId()) upload(window.__sheetId(), inp.files);
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('.ph[data-ph]');
    if (b && window.__sheetId) openViewer(window.__sheetId(), +b.dataset.ph);
  });

  // ---------- feedback saved to the database ----------
  window.__saveFeedback = async body => {
    const u = me();
    await addDoc(collection(db, 'feedback'), {
      kind: body.Type === 'Feedback' ? 'feedback' : 'suggest',
      place: String(body.Place || '').slice(0, 200),
      where: String(body['Where / link'] || '').slice(0, 500),
      msg: String(body.Message || '').slice(0, 3000),
      from: String(body.From || '').slice(0, 100),
      email: String(body['Reply to'] || '').slice(0, 200),
      uid: u ? u.uid : '',
      status: 'new',
      at: serverTimestamp(),
    });
  };

  // ---------- places added from approved suggestions (everyone sees them) ----------
  onSnapshot(collection(db, 'added'), snap => {
    const L = [];
    snap.forEach(d => {
      const x = d.data();
      L.push({
        id: 'a_' + d.id, added: true, n: x.n, s: x.s || 'Casual dining', q: x.q || 'Other', c: x.q || '', b: x.b || 0,
        a: x.a || '', r: x.a || 'Singapore', ad: x.ad || '', l: ['Suggested by friends'], u: x.u || `https://www.google.com/maps/search/${encodeURIComponent(x.n + ' Singapore')}`,
        by: x.by || '', nt: x.nt || '', gr: 0, gn: 0, o: x.at ? x.at.toMillis() : Date.now(),
      });
    });
    window.__setAdded && window.__setAdded(L);
  }, () => {});

  // ---------- Sida's Inbox ----------
  let FB = [], unsubFB = null;
  const inboxBtn = document.createElement('button');
  inboxBtn.type = 'button'; inboxBtn.className = 'iconbtn inbox-btn'; inboxBtn.hidden = true; inboxBtn.setAttribute('aria-label', 'Inbox');
  inboxBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 13l2.5-7h11L20 13v6H4z"/><path d="M4 13h5l1 2h4l1-2h5"/></svg><span class="dotn" hidden></span>';
  const acct = document.getElementById('acct');
  acct && acct.parentNode.insertBefore(inboxBtn, acct);
  inboxBtn.onclick = openInbox;

  auth.onAuthStateChanged(() => {
    if (unsubFB) { unsubFB(); unsubFB = null; }
    inboxBtn.hidden = !isOwner();
    rerender();
    if (!isOwner()) return;
    unsubFB = onSnapshot(query(collection(db, 'feedback'), orderBy('at', 'desc')), snap => {
      FB = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const n = FB.filter(x => x.status === 'new').length;
      const dot = inboxBtn.querySelector('.dotn'); dot.hidden = !n; dot.textContent = n > 9 ? '9+' : n;
      if (document.querySelector('.ibx')) drawInbox();
    }, e => console.warn('inbox unavailable', e));
  });

  let tab = 'new';
  function openInbox() {
    const scrim = document.createElement('div'); scrim.className = 'fb-scrim ibx-scrim';
    scrim.innerHTML = '<div class="fb ibx" role="dialog" aria-modal="true" aria-label="Inbox"></div>';
    scrim.addEventListener('click', e => { if (e.target === scrim) scrim.remove(); });
    document.body.append(scrim); drawInbox();
  }
  function drawInbox() {
    const box = document.querySelector('.ibx'); if (!box) return;
    const L = FB.filter(x => tab === 'new' ? x.status === 'new' : x.status !== 'new');
    const when = x => x.at && x.at.toDate ? x.at.toDate().toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }) : '';
    box.innerHTML = `<div class="ibx-h"><h2>Inbox</h2><button type="button" class="sh-x" data-ix="close" aria-label="Close">✕</button></div>
      <div class="ibx-tabs"><button type="button" data-tab="new" aria-pressed="${tab === 'new'}">New (${FB.filter(x => x.status === 'new').length})</button><button type="button" data-tab="done" aria-pressed="${tab !== 'new'}">Done</button></div>
      ${L.length ? L.map(x => `<article class="ibx-i" data-id="${x.id}">
        <div class="ibx-top"><span class="ibx-k ${x.kind}">${x.kind === 'suggest' ? 'Suggestion' : 'Feedback'}</span><b>${esc(x.place)}</b><span class="ibx-d">${when(x)}</span></div>
        ${x.where ? `<p class="ibx-w">${/^https?:/.test(x.where) ? `<a href="${esc(x.where)}" target="_blank" rel="noopener">${esc(x.where)}</a>` : esc(x.where)}</p>` : ''}
        ${x.msg ? `<p>${esc(x.msg)}</p>` : ''}
        <p class="ibx-f">${esc(x.from || 'Anonymous')}${x.email ? ` · <a href="mailto:${esc(x.email)}">${esc(x.email)}</a>` : ''}${x.status !== 'new' ? ` · <i>${esc(x.status)}</i>` : ''}</p>
        <div class="ibx-a">${x.kind === 'suggest' && x.status === 'new' ? '<button type="button" class="fb-btn fb-send" data-ix="approve">Approve…</button>' : ''}
          ${x.status === 'new' ? `<button type="button" class="fb-btn fb-cancel" data-ix="done">${x.kind === 'suggest' ? 'Dismiss' : 'Mark done'}</button>` : '<button type="button" class="fb-btn fb-cancel" data-ix="reopen">Move to New</button>'}
          <button type="button" class="fb-btn fb-cancel" data-ix="del">Delete</button></div>
      </article>`).join('') : `<p class="ibx-empty">${tab === 'new' ? 'Nothing new. Suggestions and feedback from the app land here.' : 'Nothing here yet.'}</p>`}`;
    box.onclick = async e => {
      const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; drawInbox(); return; }
      const b = e.target.closest('[data-ix]'); if (!b) return;
      const act = b.dataset.ix;
      if (act === 'close') { box.parentNode.remove(); return; }
      const it = FB.find(x => x.id === b.closest('.ibx-i').dataset.id); if (!it) return;
      if (act === 'done') await updateDoc(doc(db, 'feedback', it.id), { status: it.kind === 'suggest' ? 'dismissed' : 'done' });
      if (act === 'reopen') await updateDoc(doc(db, 'feedback', it.id), { status: 'new' });
      if (act === 'del') { if (b.dataset.sure) await deleteDoc(doc(db, 'feedback', it.id)); else { b.dataset.sure = 1; b.textContent = 'Tap again'; } }
      if (act === 'approve') approveForm(b.closest('.ibx-i'), it);
    };
  }

  const TYPES = ['Fine dining', 'Smart casual', 'Casual dining', 'Quick & cheap', 'Street food', 'Cafe', 'Bakery & dessert', 'Cocktail bar', 'Wine & spirits bar', 'Pub & craft beer', 'Izakaya & sake bar', 'Rooftop & lounge', 'Bar', 'Other'];
  function approveForm(card, it) {
    const link = /^https?:/.test(it.where) ? it.where : '';
    card.querySelector('.ibx-a').outerHTML = `<form class="ibx-form">
      <label>Name<input name="n" value="${esc(it.place)}" required></label>
      <div class="row"><label>Type<select name="s">${TYPES.map(t => `<option${t === 'Casual dining' ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      <label>Price<select name="b"><option value="0">–</option><option value="1">$</option><option value="2" selected>$$</option><option value="3">$$$</option><option value="4">$$$$</option><option value="5">$$$$$</option></select></label></div>
      <div class="row"><label>Cuisine<input name="q" placeholder="e.g. Japanese"></label><label>Area<input name="a" value="${esc(link ? '' : it.where)}" placeholder="e.g. Tanjong Pagar"></label></div>
      <label>Google Maps link<input name="u" value="${esc(link)}" placeholder="Optional"></label>
      <label>Your note (optional)<textarea name="nt" placeholder="Shows on the place">${esc(it.msg)}</textarea></label>
      <div class="ibx-a"><button type="submit" class="fb-btn fb-send">Add to sidalog</button><button type="button" class="fb-btn fb-cancel" data-ix2="cancel">Cancel</button></div></form>`;
    const f = card.querySelector('form');
    f.querySelector('[data-ix2]').onclick = () => drawInbox();
    f.onsubmit = async e => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(f));
      if (!v.n.trim()) return;
      f.querySelector('[type=submit]').disabled = true;
      await setDoc(doc(db, 'added', it.id), {
        n: v.n.trim().slice(0, 120), s: v.s, q: v.q.trim().slice(0, 60), b: +v.b, a: v.a.trim().slice(0, 80),
        u: v.u.trim().slice(0, 500), nt: v.nt.trim().slice(0, 600), by: (it.from || '').slice(0, 80), at: serverTimestamp(),
      });
      await updateDoc(doc(db, 'feedback', it.id), { status: 'added' });
    };
  }
}

function injectCSS() {
  const s = document.createElement('style');
  s.textContent = `
  .tile.has-ph{padding:0;overflow:hidden}.tile.has-ph img{width:100%;height:100%;object-fit:cover;display:block}
  .ph-strip{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:4px;margin:0 -2px}
  .ph{flex:none;width:132px;height:132px;border:0;padding:0;border-radius:8px;overflow:hidden;background:var(--soft);scroll-snap-align:start}
  .ph img{width:100%;height:100%;object-fit:cover;display:block}
  .ph-add{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}
  .ph-add .btn{display:inline-flex;align-items:center;gap:6px;cursor:pointer}.ph-add .btn svg{width:16px;height:16px}
  .ph-add .btn.off{opacity:.5;cursor:default}
  .btn.ghost{background:transparent;border:1px solid var(--line);color:var(--ink)}
  .ph-note,.ph-hint{font-size:.78rem;color:var(--muted);margin:8px 0 0}
  .ph-view{position:fixed;inset:0;z-index:90;background:rgba(10,8,6,.94);display:grid;place-items:center}
  .ph-view img{max-width:100vw;max-height:calc(100vh - 120px);object-fit:contain}
  .ph-bar{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 12px) 14px 12px;color:#F4ECDF;font-size:.9rem}
  .ph-bar span{flex:1;font-weight:600}
  .ph-bar button{background:rgba(255,255,255,.12);color:#fff;border:0;border-radius:999px;padding:8px 12px;font:inherit;font-size:.82rem}
  .ph-nav{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.12);color:#fff;border:0;border-radius:50%;width:40px;height:40px;font-size:1.4rem}
  .ph-nav.prev{left:10px}.ph-nav.next{right:10px}
  .inbox-btn{position:relative}.inbox-btn .dotn{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;border-radius:9px;background:var(--accent);color:var(--accent-ink);font-size:.66rem;font-weight:800;display:grid;place-items:center;padding:0 4px}
  .inbox-btn .dotn[hidden]{display:none}
  .ibx{max-height:92vh}
  .ibx-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.ibx-h h2{margin:0}.ibx .sh-x{position:static;flex:none}
  .ibx-tabs{display:flex;gap:8px;margin-bottom:12px}
  .ibx-tabs button{border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:6px 12px;font:inherit;font-size:.84rem;font-weight:600;color:var(--ink-2)}
  .ibx-tabs button[aria-pressed=true]{background:var(--ink);color:var(--surface);border-color:var(--ink)}
  .ibx-i{border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin-bottom:10px;background:var(--surface)}
  .ibx-i p{margin:6px 0;font-size:.88rem;white-space:pre-wrap;overflow-wrap:anywhere}
  .ibx-top{display:flex;align-items:center;gap:8px}.ibx-top b{flex:1;min-width:0}
  .ibx-k{font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--accent2,var(--accent));box-shadow:inset 0 0 0 1px currentColor;border-radius:6px;padding:2px 6px}
  .ibx-k.feedback{color:var(--muted)}
  .ibx-d,.ibx-f{font-size:.78rem!important;color:var(--muted)}
  .ibx-a{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.ibx-a .fb-btn{padding:8px 12px;font-size:.84rem}
  .ibx-empty{color:var(--muted);text-align:center;padding:24px 0}
  .ibx-form label{display:block;font-size:.78rem;font-weight:700;color:var(--ink-2);margin-top:8px}
  .ibx-form input,.ibx-form select,.ibx-form textarea{display:block;width:100%;margin-top:4px;border:1px solid var(--line);background:var(--soft);border-radius:8px;padding:8px 10px;font:inherit;font-size:.88rem;color:var(--ink)}
  .ibx-form textarea{min-height:64px}
  .ibx-form .row{display:flex;gap:8px}.ibx-form .row label{flex:1;min-width:0}
  .by-tag{font-size:.74rem;color:var(--muted)}`;
  document.head.append(s);
}
