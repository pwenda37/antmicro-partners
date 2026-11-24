/* Orbity partnerów w hero.
   Pierścienie = kategorie, punkty = partnerzy. Układ jest lekko pochylony (elipsy),
   punkty z przodu są większe i jaśniejsze. Kursor przechyla układ, hover pokazuje etykietę,
   klik otwiera panel partnera (window.partnersOpen z partners.js). */
(function () {
  var root = document.querySelector('[data-orbit]');
  if (!root) return;
  var data = JSON.parse(document.getElementById('partners-data').textContent);
  var svg = root.querySelector('.orbit__svg');
  var layer = root.querySelector('.orbit__labels');
  var NS = 'http://www.w3.org/2000/svg';
  var C = 320;                                   // środek viewBox 640x640
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var RINGS = [
    { name: 'Open source',          r: 122, speed:  0.07,  test: function (c) { return c === 'Open source'; } },
    { name: 'Silicon',              r: 204, speed: -0.04,  test: function (c) { return c === 'Silicon'; } },
    { name: 'Hardware & research',  r: 286, speed:  0.025, test: function () { return true; } },
  ];

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    (parent || svg).appendChild(e);
    return e;
  }

  /* ---------- przypisanie partnerów do pierścieni ---------- */
  var nodes = [];
  data.forEach(function (p, i) {
    for (var r = 0; r < RINGS.length; r++) {
      if (RINGS[r].test(p.category)) { nodes.push({ i: i, ring: r, p: p }); break; }
    }
  });
  RINGS.forEach(function (ring, r) {
    var list = nodes.filter(function (n) { return n.ring === r; });
    list.forEach(function (n, k) { n.base = (k / list.length) * Math.PI * 2 + r * 0.7; });
    ring.rot = 0;
  });

  /* ---------- rysunek ---------- */
  var gSpokes = el('g', {});
  var gRings = el('g', {});
  RINGS.forEach(function (ring) {
    ring.ellipse = el('ellipse', { class: 'orbit__ring', cx: C, cy: C, rx: ring.r, ry: ring.r / 2 }, gRings);
    ring.label = el('text', { class: 'orbit__ring-label', x: C, 'text-anchor': 'middle' }, gRings);
    ring.label.textContent = ring.name;
  });

  // rdzeń: heksagon Antmicro
  var gCore = el('g', {});
  function hex(r) {
    var pts = [];
    for (var k = 0; k < 6; k++) {
      var a = Math.PI / 6 + k * Math.PI / 3;
      pts.push((C + r * Math.cos(a)).toFixed(1) + ',' + (C + r * Math.sin(a)).toFixed(1));
    }
    return pts.join(' ');
  }
  el('circle', { class: 'orbit__core-glow', cx: C, cy: C, r: 54 }, gCore);
  el('polygon', { class: 'orbit__core-hex', points: hex(34) }, gCore);
  el('polygon', { class: 'orbit__core-hex', points: hex(18), style: 'fill: var(--color-foreground)' }, gCore);

  var gDots = el('g', {});
  nodes.forEach(function (n) {
    n.spoke = el('line', { class: 'orbit__spoke', x1: C, y1: C }, gSpokes);
    n.pulse = el('circle', { class: 'orbit__pulse', r: 6 }, gDots);
    n.dot = el('circle', { class: 'orbit__dot', r: 4 }, gDots);

    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'orbit__node';
    b.setAttribute('aria-label', n.p.name + ', ' + n.p.category + '. Show more');
    var tag = document.createElement('span');
    tag.className = 'orbit__tag';
    tag.innerHTML = '<span></span><small></small>';
    tag.firstChild.textContent = n.p.name;
    tag.lastChild.textContent = n.p.category;
    b.appendChild(tag);
    layer.appendChild(b);
    n.btn = b;

    b.addEventListener('mouseenter', function () { setHover(n); });
    b.addEventListener('mouseleave', function () { setHover(null); });
    b.addEventListener('focus', function () { setHover(n); });
    b.addEventListener('blur', function () { setHover(null); });
    b.addEventListener('click', function () { if (window.partnersOpen) window.partnersOpen(n.i); });
  });

  /* ---------- stan aktywny: hover albo automatyczna prezentacja ---------- */
  var hover = null, auto = null, active = null;
  function setActive(n) {
    if (active === n) return;
    if (active) {
      active.dot.classList.remove('is-active');
      active.spoke.classList.remove('is-active');
      active.pulse.classList.remove('is-active');
      active.btn.classList.remove('is-active');
    }
    active = n;
    if (n) {
      n.dot.classList.add('is-active');
      n.spoke.classList.add('is-active');
      n.pulse.classList.add('is-active');
      n.btn.classList.add('is-active');
    }
  }
  function setHover(n) { hover = n; setActive(n || auto); }

  // co kilka sekund wyróżnij kolejnego partnera z przodu układu
  setInterval(function () {
    if (hover || !visible) return;
    var front = nodes.filter(function (n) { return n.depth > 0.6 && n !== auto; });
    auto = front[Math.floor(Math.random() * front.length)] || null;
    setActive(auto);
  }, 2600);

  /* ---------- kursor: pochylenie i obrót ---------- */
  var tilt = 0.48, tiltTarget = 0.48, yaw = 0, yawTarget = 0;
  root.addEventListener('pointermove', function (e) {
    var r = root.getBoundingClientRect();
    var mx = ((e.clientX - r.left) / r.width) * 2 - 1;
    var my = ((e.clientY - r.top) / r.height) * 2 - 1;
    tiltTarget = 0.48 + my * 0.14;
    yawTarget = mx * 0.35;
  });
  root.addEventListener('pointerleave', function () { tiltTarget = 0.48; yawTarget = 0; });

  /* ---------- pętla animacji ---------- */
  var visible = true, last = performance.now();
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    if (visible) { last = performance.now(); requestAnimationFrame(frame); }
  }).observe(root);

  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    var slow = hover ? 0.12 : 1;
    tilt += (tiltTarget - tilt) * 0.06;
    yaw += (yawTarget - yaw) * 0.06;

    RINGS.forEach(function (ring) {
      if (!reduce) ring.rot += ring.speed * dt * slow;
      var ry = ring.r * tilt;
      ring.ellipse.setAttribute('ry', ry.toFixed(1));
      ring.label.setAttribute('y', (C - ry - 8).toFixed(1));
    });

    nodes.forEach(function (n) {
      var ring = RINGS[n.ring];
      var a = n.base + ring.rot + yaw;
      var x = C + ring.r * Math.cos(a);
      var y = C + ring.r * Math.sin(a) * tilt;
      var depth = (Math.sin(a) + 1) / 2;            // 0 = z tyłu, 1 = z przodu
      n.depth = depth;
      var fx = x.toFixed(1), fy = y.toFixed(1);
      n.dot.setAttribute('cx', fx); n.dot.setAttribute('cy', fy);
      n.dot.setAttribute('r', (2.4 + depth * 2.6).toFixed(2));
      n.dot.style.opacity = (0.3 + depth * 0.7).toFixed(2);
      n.pulse.setAttribute('cx', fx); n.pulse.setAttribute('cy', fy);
      n.spoke.setAttribute('x2', fx); n.spoke.setAttribute('y2', fy);
      n.spoke.style.opacity = n === active ? 1 : (0.25 + depth * 0.75).toFixed(2);
      n.btn.style.left = (x / 640 * 100) + '%';
      n.btn.style.top = ((y - 110) / 420 * 100) + "%";
    });

    if (visible) requestAnimationFrame(frame);
  }
})();
