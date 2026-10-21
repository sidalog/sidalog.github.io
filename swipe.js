// sidalog: drag a bottom panel down to close it (phones), like a native app sheet.
(function () {
  const MOBILE = () => !matchMedia('(min-width:1000px)').matches;
  function attach(el, opts) {
    let y0 = null, dy = 0, t0 = 0, dragging = false;
    const set = v => { el.style.translate = v ? `0 ${v}px` : ''; };
    const reset = () => { el.style.transition = ''; set(0); };
    el.addEventListener('touchstart', e => {
      if (!opts.isOpen() || !opts.when()) return;
      const onHandle = !!e.target.closest(opts.handle);
      const scroller = opts.scroller ? opts.scroller() : el;
      if (!onHandle && scroller.scrollTop > 0) return; // let the content scroll first
      if (e.target.closest('input,textarea,select')) return;
      y0 = e.touches[0].clientY; dy = 0; t0 = Date.now(); dragging = false;
      el.style.transition = 'none';
    }, { passive: true });
    el.addEventListener('touchmove', e => {
      if (y0 == null) return;
      dy = e.touches[0].clientY - y0;
      if (!dragging) {
        if (dy < -4) { y0 = null; reset(); return; } // scrolling up: not a dismiss
        if (dy > 6) dragging = true; else return;
      }
      e.preventDefault();
      set(Math.max(0, dy));
    }, { passive: false });
    const end = () => {
      if (y0 == null) return;
      const speed = dy / Math.max(1, Date.now() - t0);
      y0 = null;
      if (dragging && (dy > 110 || (speed > 0.6 && dy > 50))) {
        el.style.transition = 'translate .18s ease-out';
        set(el.offsetHeight);
        setTimeout(() => { reset(); opts.onClose(); }, 170);
      } else {
        el.style.transition = 'translate .2s ease-out';
        set(0);
        setTimeout(() => { el.style.transition = ''; }, 210);
      }
      dragging = false;
    };
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
  }
  window.SidalogSwipe = { attach, MOBILE };
})();
