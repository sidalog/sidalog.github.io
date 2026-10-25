// sidalog account sync: Google sign-in + private favourites/notes in Firestore.
// Without a Firebase config the app keeps working, saving marks on this device only.
const cfg = window.SIDALOG_FIREBASE;
const btn = document.getElementById('acct');

if (cfg && cfg.apiKey && !cfg.apiKey.startsWith('PASTE')) {
  const V = '10.12.2';
  const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  const { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } =
    await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
  const { getFirestore, collection, collectionGroup, doc, setDoc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot, writeBatch, serverTimestamp, query, where, orderBy } =
    await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);

  const app = initializeApp(cfg);
  const auth = getAuth(app);
  const db = getFirestore(app);
  let unsub = null;
  try {
    const { initSocial } = await import('./social.js?v=10');
    initSocial({ db, auth, collection, doc, setDoc, addDoc, getDoc, getDocs, deleteDoc, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp });
  } catch (e) { console.warn('social features unavailable', e); }
  const OWNER = 'sidaaaaaaa111@gmail.com';

  // Everyone's shared ratings (public): places/{placeId}/ratings/{uid}
  onSnapshot(collectionGroup(db, 'ratings'), snap => {
    const map = {};
    snap.forEach(d => {
      const pid = d.ref.parent.parent && d.ref.parent.parent.id;
      const x = d.data();
      if (!pid || !(x.r >= 1 && x.r <= 5)) return;
      (map[pid] = map[pid] || []).push({ uid: d.id, r: x.r, t: x.t || '', name: x.name || '', photo: x.photo || '', pick: !!x.pick, at: x.at ? x.at.toMillis() : 0 });
    });
    for (const k in map) map[k].sort((a, b) => b.at - a.at);
    window.__setReviews && window.__setReviews(map);
  }, err => console.warn('ratings unavailable', err));

  window.__signIn = async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) { if (e.code !== 'auth/popup-closed-by-user') alert('Sign-in did not finish. Please try again.'); }
  };

  const closeMenu = () => document.querySelectorAll('.menu').forEach(m => m.remove());
  btn.hidden = false;
  document.body.classList.add('has-auth');
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const u = auth.currentUser;
    if (!u) { window.__signIn(); return; }
    closeMenu();
    const m = document.createElement('div');
    m.className = 'menu';
    const r = btn.getBoundingClientRect();
    m.style.top = (r.bottom + 6) + 'px';
    m.style.right = Math.max(12, innerWidth - r.right) + 'px';
    const p = document.createElement('p');
    p.textContent = 'Signed in as ' + (u.email || u.displayName || 'you');
    const out = document.createElement('button');
    out.type = 'button';
    out.textContent = 'Sign out';
    out.onclick = async () => { closeMenu(); await signOut(auth); };
    m.append(p, out);
    document.body.append(m);
  });
  document.addEventListener('click', closeMenu);

  onAuthStateChanged(auth, user => {
    if (unsub) { unsub(); unsub = null; }
    if (!user) {
      btn.textContent = 'Sign in';
      btn.classList.remove('signed');
      window.__cloudSave = null;
      window.__sidalogUser = null;
      window.__publishReview = null;
      window.__isOwner = false;
      window.__setCloud(false);
      return;
    }
    const initial = (user.displayName || user.email || '?').trim()[0].toUpperCase();
    btn.innerHTML = '';
    const av = document.createElement('span');
    av.className = 'av';
    av.textContent = initial;
    if (user.photoURL) {
      const img = document.createElement('img');
      img.src = user.photoURL;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.onload = () => { av.textContent = ''; av.append(img); av.classList.add('photo'); };
    }
    btn.append(av);
    btn.setAttribute('aria-label', 'Account');
    btn.classList.add('signed');
    window.__sidalogUser = { name: user.displayName || '', email: user.email || '' };
    window.__isOwner = !!(user.email && user.email.toLowerCase() === OWNER && user.emailVerified);
    window.__publishReview = async (placeId, m) => {
      const ref = doc(db, 'places', placeId, 'ratings', user.uid);
      if (m.pub && m.rating >= 1) {
        await setDoc(ref, {
          r: m.rating,
          t: (m.note || '').slice(0, 600),
          name: (user.displayName || 'Someone').slice(0, 80),
          photo: (user.photoURL || '').slice(0, 500),
          pick: window.__isOwner,
          at: serverTimestamp(),
        });
      } else {
        await deleteDoc(ref).catch(() => {});
      }
    };

    const col = collection(db, 'users', user.uid, 'marks');
    window.__cloudSave = (id, data) => setDoc(doc(col, id), data);
    let first = true;
    unsub = onSnapshot(col, async snap => {
      const marks = {};
      snap.forEach(d => { marks[d.id] = d.data(); });
      if (first) {
        first = false;
        // Bring over anything saved on this device before signing in.
        const local = window.__getLocal();
        const missing = Object.entries(local).filter(([k]) => !marks[k]);
        if (missing.length) {
          for (let i = 0; i < missing.length; i += 400) {
            const b = writeBatch(db);
            missing.slice(i, i + 400).forEach(([k, v]) => { b.set(doc(col, k), v); marks[k] = v; });
            try { await b.commit(); } catch (e) { console.warn('merge failed', e); }
          }
        }
      }
      window.__setCloud(true, marks);
    }, err => { console.warn('sync unavailable', err); window.__setCloud(false); });
  });
}
