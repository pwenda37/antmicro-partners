/* Partnerzy: przełączanie układu i panel z opisem partnera. */
(function () {
  var data = JSON.parse(document.getElementById('partners-data').textContent);
  var bento = document.querySelector('.partners-bento');
  var pp = document.querySelector('.pp');
  var card = pp.querySelector('.pp__card');
  var scroller = pp.querySelector('.pp__scroll');
  var els = {
    logo: pp.querySelector('.pp__logo img'),
    tag: pp.querySelector('.pp__tag'),
    count: pp.querySelector('.pp__count'),
    title: pp.querySelector('.pp__title'),
    text: pp.querySelector('.pp__text'),
    link: pp.querySelector('.pp__link'),
    url: pp.querySelector('.pp__link-url'),
  };

  var params = new URLSearchParams(location.search);
  // eksport do Figmy: płaskie logotypy zamiast masek, bez paska prototypu i animacji

  var state = {
    layout: params.get('layout') === 'equal' ? 'equal' : 'bento',
    preview: params.get('preview') === 'overlay' ? 'overlay' : 'drawer',
    hero: ['dither', 'pcb'].indexOf(params.get('hero')) >= 0 ? params.get('hero') : 'orbit',
    tint: params.get('tint') === 'mono' ? 'mono' : 'accent',
    figma: params.get('figma') === '1' ? 'on' : 'off',
    filter: params.get('cat') || 'all',
    mode: 'drawer',
    index: -1,
    closeTimer: null,
  };

  /* ---------- pasek prototypu ---------- */
  function syncBar() {
    document.querySelectorAll('.proto-bar__seg').forEach(function (seg) {
      var key = seg.dataset.control;
      seg.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.value === state[key]));
      });
    });
    document.documentElement.dataset.hero = state.hero;
    document.documentElement.dataset.tint = state.tint;
    document.documentElement.classList.toggle('figma-export', state.figma === 'on');
    history.replaceState(null, '', location.pathname + '?hero=' + state.hero + '&tint=' + state.tint + '&layout=' + state.layout + '&preview=' + state.preview + (state.figma === 'on' ? '&figma=1' : '') + (state.filter !== 'all' ? '&cat=' + state.filter : '') + location.hash);
  }
  document.querySelectorAll('.proto-bar__seg').forEach(function (seg) {
    seg.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (state.index >= 0) close(true);
      state[seg.dataset.control] = b.dataset.value;
      applyFilter();
      syncBar();
    });
  });

  /* ---------- zakładki branż ---------- */
  var tabBtns = [].slice.call(document.querySelectorAll('.partners-tabs__btn'));
  var cta = bento.querySelector('.partner-tile--cta');
  if (!tabBtns.some(function (b) { return b.dataset.filter === state.filter; })) state.filter = 'all';

  function visibleIdx() {
    return [].slice.call(bento.querySelectorAll('.partner-tile[data-index]:not([hidden])'))
      .map(function (t) { return Number(t.dataset.index); });
  }
  // CTA dopełnia ostatni rząd (1 wolna komórka = mały pionowy kafel); pełny rząd = CTA w nowym rzędzie
  function fitCta() {
    if (state.filter === 'all') { cta.style.gridColumn = ''; cta.classList.remove('is-narrow'); return; }
    var cols = parseInt(getComputedStyle(bento).getPropertyValue('--cols'), 10) || 2;
    var span = cols - (visibleIdx().length % cols);
    cta.style.gridColumn = 'span ' + span;
    cta.classList.toggle('is-narrow', span === 1);
  }
  function applyFilter() {
    var f = state.filter;
    tabBtns.forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.filter === f));
      // mobile: aktywna zakładka zawsze widoczna w przewijanym pasku
      if (b.dataset.filter === f) { var bar = b.parentNode; bar.scrollLeft += b.getBoundingClientRect().left - bar.getBoundingClientRect().left - (bar.clientWidth - b.offsetWidth) / 2; }
    });
    bento.querySelectorAll('.partner-tile[data-index]').forEach(function (t) {
      t.hidden = f !== 'all' && t.dataset.group !== f;
    });
    // po odfiltrowaniu bento traci sens (dziury w siatce), więc kafle są równe
    bento.dataset.layout = f === 'all' ? state.layout : 'equal';
    bento.dataset.filtered = f === 'all' ? 'false' : 'true';
    fitCta();
    bento.classList.remove('is-filtering');
    void bento.offsetWidth;
    bento.classList.add('is-filtering');
  }
  tabBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      if (state.index >= 0) close(true);
      state.filter = b.dataset.filter;
      applyFilter();
      syncBar();
    });
  });
  window.addEventListener('resize', fitCta);
  applyFilter();
  bento.classList.remove('is-filtering');
  syncBar();
  // H: schowaj / pokaż pasek prototypu (np. przed przechwyceniem do Figmy)
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'h' || e.key === 'H') && !e.metaKey && !e.ctrlKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      var bar = document.querySelector('.proto-bar');
      if (bar) bar.classList.toggle('is-hidden');
    }
  });

  /* ---------- panel ---------- */
  // logotypy podglądu ładowane z góry, żeby przełączanie strzałkami było natychmiastowe
  setTimeout(function () { data.forEach(function (p) { new Image().src = p.logo; }); }, 1200);
  function tileOf(i) { return bento.querySelector('.partner-tile[data-index="' + i + '"]'); }
  // nawigacja w podglądzie: tylko partnerzy z aktywnej zakładki (chyba że otwarto kogoś spoza niej, np. z orbit)
  function navList(i) {
    var v = visibleIdx();
    return v.indexOf(i) >= 0 ? v : data.map(function (_, k) { return k; });
  }
  function pad(n) { return String(n).padStart(2, '0'); }

  function fill(i) {
    var p = data[i];
    els.logo.src = p.logo;
    els.logo.alt = p.name + ' logo';
    els.logo.style.setProperty('--logo-w', p.logoW + 'px');
    els.logo.style.setProperty('--logo-h', p.logoH + 'px');
    els.tag.textContent = p.category;
    var list = navList(i);
    els.count.textContent = pad(list.indexOf(i) + 1) + ' / ' + pad(list.length);
    els.title.textContent = p.name;
    els.text.innerHTML = '';
    p.description.forEach(function (t) {
      var el = document.createElement('p');
      el.textContent = t;
      els.text.appendChild(el);
    });
    els.link.hidden = !p.url;
    els.link.href = p.url;
    els.url.textContent = p.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    document.querySelectorAll('.partner-tile.is-active').forEach(function (t) { t.classList.remove('is-active'); });
    var t = tileOf(i);
    if (t) t.classList.add('is-active');
  }

  // transformacja, która nakłada kartę na kafel (wariant B)
  function flipFromTile(i) {
    var t = tileOf(i);
    if (!t || t.hidden) return 'none';   // kafel ukryty przez zakładkę (np. otwarcie z orbit): bez lotu z punktu 0,0
    var r = t.getBoundingClientRect();
    var b = bento.getBoundingClientRect();
    var c = card.getBoundingClientRect();
    var sx = r.width / c.width, sy = r.height / c.height;
    return 'translate(' + (r.left - b.left) + 'px,' + (r.top - b.top) + 'px) scale(' + sx + ',' + sy + ')';
  }

  // wariant B: tekst wyśrodkowany w pionie względem NAJDŁUŻSZEGO opisu, więc przy zmianie partnera tytuł stoi w miejscu
  var topCache = {};
  function overlayTop() {
    var body = pp.querySelector('.pp__body');
    if (state.mode !== 'overlay' || pp.hidden) { body.style.removeProperty('--pp-top'); return; }
    var key = body.offsetWidth + 'x' + body.clientHeight;
    if (!topCache[key]) {
      var probe = body.cloneNode(true);
      probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;height:auto;padding-top:0;padding-bottom:0;overflow:visible;width:' + body.offsetWidth + 'px';
      body.parentNode.appendChild(probe);
      var t = probe.querySelector('.pp__title'), x = probe.querySelector('.pp__text'), max = 0;
      data.forEach(function (p) {
        t.textContent = p.name;
        x.innerHTML = '';
        p.description.forEach(function (d) { var e = document.createElement('p'); e.textContent = d; x.appendChild(e); });
        max = Math.max(max, probe.offsetHeight);
      });
      probe.remove();
      topCache[key] = Math.max(40, Math.round((body.clientHeight - max) / 2));
    }
    body.style.setProperty('--pp-top', topCache[key] + 'px');
  }
  // zmiana szerokości przy otwartej karcie: na mobile zawsze panel od dołu, na desktopie wybrany wariant
  window.addEventListener('resize', function () {
    if (state.index < 0 || document.documentElement.classList.contains('pp-capture')) return;
    var want = window.innerWidth < 768 ? 'drawer' : state.preview;
    if (want !== state.mode) { var i = state.index; close(true); open(i); return; }
    overlayTop();
  });

  function open(i) {
    clearTimeout(state.closeTimer);
    state.index = i;
    state.mode = window.innerWidth < 768 ? 'drawer' : state.preview;
    fill(i);
    pp.dataset.mode = state.mode;
    pp.dataset.state = 'closed';

    var capture = document.documentElement.classList.contains('figma-export');
    if (capture) {
      // tryb Figmy: panel jako zwykła strona do przechwycenia (bez fixed, animacji i rozmycia)
      document.body.appendChild(pp);
      document.documentElement.classList.add('pp-capture');
      card.style.removeProperty('--flip');
      window.scrollTo(0, 0);
    } else if (state.mode === 'overlay') {
      bento.appendChild(pp);
      var top = bento.getBoundingClientRect().top;
      var header = document.querySelector('header');
      var offset = (header ? header.getBoundingClientRect().height : 56) + 16;
      if (Math.abs(top - offset) > 4) window.scrollTo({ top: window.scrollY + top - offset, behavior: 'smooth' });
      card.style.setProperty('--flip', 'none');
      pp.hidden = false;
      card.style.setProperty('--flip', flipFromTile(i));
      document.documentElement.classList.add('pp-blur');
      overlayTop();
    } else {
      document.body.appendChild(pp);
      pp.hidden = false;
      document.documentElement.style.overflow = 'hidden';
    }
    if (capture) pp.hidden = false;

    scroller.scrollTop = 0;
    pp.querySelector('.pp__body').scrollTop = 0;
    void card.offsetWidth;            // wymuś reflow, żeby animacja wejścia ruszyła
    pp.classList.add('is-entering');      // opóźnione pojawienie treści tylko przy otwarciu, nie przy strzałkach
    clearTimeout(state.enterTimer);
    state.enterTimer = setTimeout(function () { pp.classList.remove('is-entering'); }, 900);
    pp.dataset.state = 'open';
    pp.querySelector('.pp__btn[data-close]').focus({ preventScroll: true });
  }

  function close(instant) {
    if (state.index < 0) return;
    clearTimeout(state.swapTimer);
    state.swapToken = (state.swapToken || 0) + 1;
    card.classList.remove('is-swapping');
    var t = tileOf(state.index);
    var wasCapture = document.documentElement.classList.contains('pp-capture');
    document.documentElement.classList.remove('pp-capture');
    if (wasCapture) instant = true;
    if (state.mode === 'overlay' && !wasCapture) card.style.setProperty('--flip', flipFromTile(state.index));
    state.index = -1;
    pp.dataset.state = 'closed';
    document.documentElement.style.overflow = '';
    document.documentElement.classList.remove('pp-blur');
    var done = function () {
      pp.hidden = true;
      if (t) t.classList.remove('is-active');
    };
    if (instant) done(); else state.closeTimer = setTimeout(done, 550);
    var btn = t && t.querySelector('.partner-tile__open');
    if (btn && !instant) btn.focus({ preventScroll: true });
  }

  // wariant B: klik poza kartą zamyka podgląd
  document.addEventListener('click', function (e) {
    if (state.index < 0 || state.mode !== 'overlay') return;
    if (card.contains(e.target) || e.target.closest('.proto-bar, [data-open]')) return;
    close();
  }, true);

  function step(delta) {
    if (state.index < 0) return;
    var list = navList(state.index);
    var next = list[(list.indexOf(state.index) + delta + list.length) % list.length];
    state.index = next;
    card.classList.add('is-swapping');
    // szybkie klikanie: jedna zmiana naraz, bez migania od poprzednich timerów
    clearTimeout(state.swapTimer);
    // nowe logo najpierw się dekoduje, dopiero potem podmiana (bez mignięcia starego logo w nowym rozmiarze)
    var pre = new Image();
    pre.src = data[next].logo;
    var ready = pre.decode ? pre.decode().catch(function () {}) : Promise.resolve();
    var faded = new Promise(function (r) { state.swapTimer = setTimeout(r, 180); });
    var token = state.swapToken = (state.swapToken || 0) + 1;
    Promise.all([ready, faded]).then(function () {
      if (token !== state.swapToken || state.index !== next) return;   // w międzyczasie kliknięto dalej
      fill(next);
      scroller.scrollTop = 0;
      pp.querySelector('.pp__body').scrollTop = 0;
      card.classList.remove('is-swapping');
    });
  }

  // dostęp z zewnątrz (np. orbity w hero)
  window.partnersOpen = open;

  bento.addEventListener('click', function (e) {
    var b = e.target.closest('[data-open]');
    if (b) open(Number(b.dataset.open));
  });
  pp.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) close();
    else if (e.target.closest('[data-prev]')) step(-1);
    else if (e.target.closest('[data-next]')) step(1);
  });

  document.addEventListener('keydown', function (e) {
    if (state.index < 0) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'Tab') {
      // pętla fokusu wewnątrz panelu
      var f = [].filter.call(card.querySelectorAll('button, a[href]'), function (el) { return !el.hidden; });
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
})();
