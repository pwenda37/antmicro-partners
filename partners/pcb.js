/* Hero, wariant C: płytka PCB w prawdziwym rzucie izometrycznym (bez perspektywy CSS).

   Wszystko jest rysowane we współrzędnych płytki (x, y, z) i rzutowane jedną macierzą afiniczną:
   - rzeczy płaskie (płyta, siatka, ścieżki, impulsy, napisy) siedzą w <g transform="matrix(...)">,
   - bryły (układy, rdzeń, elementy SMD) mają wierzch podniesiony pionowo w górę ekranu,
     a widoczne ściany (lewa i przednia) są wielokątami z rzutu narożników,
   więc wszystkie pionowe krawędzie są równoległe i nic się nie krzywi.
   Partnerzy to układy wpięte ścieżkami w chip Antmicro; impulsy płyną do chipu.
   Hover podświetla ścieżki układu, klik otwiera panel partnera (window.partnersOpen). */
(function () {
  var root = document.querySelector('[data-hero-pcb]');
  if (!root) return;
  var svg = root.querySelector('svg');
  var data = JSON.parse(document.getElementById('partners-data').textContent);
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- rzut: obrót o ROT w płaszczyźnie, pochylenie TILT ---- */
  var ROT = 32 * Math.PI / 180, TILT = 40 * Math.PI / 180;   // TILT mniejszy = widok bardziej z góry
  var A = Math.cos(ROT), C = Math.sin(ROT);
  var B = -Math.sin(ROT) * Math.cos(TILT), D = Math.cos(ROT) * Math.cos(TILT);
  var ZS = Math.sin(TILT);                          // ile ekranu na jednostkę wysokości
  function proj(x, y, z) { return [A * x + C * y, B * x + D * y - z * ZS]; }
  function plane(z) { return 'matrix(' + [A, B, C, D, 0, -z * ZS].map(function (v) { return v.toFixed(5); }).join(' ') + ')'; }

  var BW = 760, BH = 520;                           // płytka
  var CX = 380, CY = 260, CORE = 64;                // chip Antmicro
  var W = 112, H = 52;                              // układ partnera
  var HP = 11, HC = 16;                             // wysokość układów partnerów / rdzenia

  var LAYOUT = [
    ['NVIDIA', 150, 50, -46], ['NXP', 500, 40, -46], ['Lattice Semiconductor', 630, 150, -16], ['Microchip', 630, 330, 16],
    ['Renesas', 500, 430, 46], ['SiFive', 150, 440, 46], ['Zephyr Project', 18, 330, 16], ['RISC-V International', 18, 150, -16],
  ];
  var SHORT = { 'Lattice Semiconductor': 'LATTICE', 'Zephyr Project': 'ZEPHYR', 'RISC-V International': 'RISC-V' };

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    (parent || svg).appendChild(e);
    return e;
  }
  function pts(list) { return list.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }

  // kadr: rzut płytki z zapasem na stos warstw i wysokości
  var c4 = [proj(0, 0, 0), proj(BW, 0, 0), proj(0, BH, 0), proj(BW, BH, 0)];
  var xs = c4.map(function (p) { return p[0]; }), ys = c4.map(function (p) { return p[1]; });
  var minX = Math.min.apply(null, xs) - 30, maxX = Math.max.apply(null, xs) + 30;
  var minY = Math.min.apply(null, ys) - 60, maxY = Math.max.apply(null, ys) + 70;
  svg.setAttribute('viewBox', [minX, minY, maxX - minX, maxY - minY].map(Math.round).join(' '));
  root.style.aspectRatio = Math.round(maxX - minX) + ' / ' + Math.round(maxY - minY);   // kontener = proporcje kadru

  /* ---- bryła: ściana lewa (-x) i przednia (+y) od z0 do z1, wierzch w grupie płaszczyzny z1 ---- */
  function box(parent, x, y, w, h, z1, topClass, rx, z0) {
    z0 = z0 || 0;
    var b = [proj(x, y, z0), proj(x, y + h, z0), proj(x + w, y + h, z0)];
    var t = [proj(x, y, z1), proj(x, y + h, z1), proj(x + w, y + h, z1)];
    el('polygon', { class: 'pcb-face-l', points: pts([t[0], t[1], b[1], b[0]]) }, parent);
    el('polygon', { class: 'pcb-face-f', points: pts([t[1], t[2], b[2], b[1]]) }, parent);
    var top = el('g', { transform: plane(z1) }, parent);
    el('rect', { class: topClass, x: x, y: y, width: w, height: h, rx: rx || 0 }, top);
    return top;                                     // grupa wierzchu: dalej rysujemy w (x, y)
  }

  /* ---- otoczenie: podłoga z siatką, kable, wymiary (pod płytką) ---- */
  var FLOOR = -70;                                  // wysokość podłogi pod płytką
  var mid = proj(BW / 2, BH / 2, FLOOR);
  var defs = el('defs', {});
  var rg = el('radialGradient', { id: 'pcbFloorFade', gradientUnits: 'userSpaceOnUse', cx: mid[0], cy: mid[1], r: 760 }, defs);
  el('stop', { offset: '0', 'stop-color': '#fff', 'stop-opacity': '1' }, rg);
  el('stop', { offset: '.55', 'stop-color': '#fff', 'stop-opacity': '.55' }, rg);
  el('stop', { offset: '1', 'stop-color': '#fff', 'stop-opacity': '0' }, rg);
  var mk = el('mask', { id: 'pcbFloorMask', maskUnits: 'userSpaceOnUse', x: -3000, y: -3000, width: 6000, height: 6000 }, defs);
  el('rect', { x: -3000, y: -3000, width: 6000, height: 6000, fill: 'url(#pcbFloorFade)' }, mk);
  var gEnv = el('g', { mask: 'url(#pcbFloorMask)' });
  // podłoga: siatka w płaszczyźnie FLOOR, co 40 jednostek, co piąta linia mocniejsza
  var floor = el('g', { transform: plane(FLOOR) }, gEnv);
  for (var fx = -720; fx <= BW + 720; fx += 40) {
    el('line', { class: (fx % 200 === 0) ? 'pcb-floor pcb-floor--major' : 'pcb-floor', x1: fx, y1: -560, x2: fx, y2: BH + 560 }, floor);
  }
  for (var fy = -560; fy <= BH + 560; fy += 40) {
    el('line', { class: (fy % 200 === 0) ? 'pcb-floor pcb-floor--major' : 'pcb-floor', x1: -720, y1: fy, x2: BW + 720, y2: fy }, floor);
  }
  // cień płytki na podłodze
  el('rect', { class: 'pcb-shadow', x: -10, y: 16, width: BW + 20, height: BH + 20, rx: 18 }, floor);

  // kable: z gniazda na krawędzi płytki łukiem w dół na podłogę i dalej poza kadr
  function cable(points) {
    var d = points.map(function (p, i) { var q = proj(p[0], p[1], p[2]); return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' ');
    el('path', { class: 'pcb-cable-out', d: d }, gEnv);
    el('path', { class: 'pcb-cable', d: d }, gEnv);
  }
  function arc(x0, y0, dirX, dirY, len) {
    // z wysokości gniazda (z=8) łagodnie w dół do podłogi, potem prosto po podłodze
    var pts = [];
    for (var k = 0; k <= 10; k++) {
      var t = k / 10, d = t * 90;
      pts.push([x0 + dirX * d, y0 + dirY * d, 8 + (FLOOR - 8) * (t * t)]);
    }
    pts.push([x0 + dirX * (90 + len), y0 + dirY * (90 + len) + 60, FLOOR]);
    return pts;
  }
  // kable: z gniazda łukiem w dół na podłogę, potem skręt "za" płytkę (w górę ekranu), gdzie jest wolne tło
  function route(x0, y0, dirX) {
    var pts = [];
    for (var k = 0; k <= 10; k++) {
      var t = k / 10;
      pts.push([x0 + dirX * t * 70, y0, 8 + (FLOOR - 8) * (t * t)]);
    }
    var bx = x0 + dirX * 70;
    for (var m = 1; m <= 8; m++) {                  // łagodny łuk na podłodze
      var a = (m / 8) * Math.PI / 2;
      pts.push([bx + dirX * Math.sin(a) * 50, y0 - (1 - Math.cos(a)) * 50, FLOOR]);
    }
    pts.push([bx + dirX * 50, y0 - (dirX < 0 ? 260 : 900), FLOOR]);   // lewy kabel krótszy: kończy się przed tekstem
    return pts;
  }
  cable(route(6, 264, -1));                         // USB-C: w lewo, potem za płytkę
  cable(route(752, 254, 1));                        // RJ45: w prawo, potem za płytkę

  /* ---- stos warstw pod płytką (jak karty w Kenningu) ---- */
  [-44, -26].forEach(function (z) { box(svg, 0, 0, BW, BH, z, 'pcb-stack', 12, z - 4); });
  // płyta z grubością
  var flat = box(svg, 0, 0, BW, BH, 0, 'pcb-board', 12, -10);

  // linie wymiarowe (jak na rysunku technicznym) przy dwóch widocznych krawędziach + znaczniki narożników
  var gDim = el('g', { transform: plane(0) });
  function dim(x1, y1, x2, y2, ox, oy, text) {
    var a1 = [x1 + ox, y1 + oy], a2 = [x2 + ox, y2 + oy];
    el('line', { class: 'pcb-dim', x1: x1 + ox * 0.3, y1: y1 + oy * 0.3, x2: a1[0] + ox * 0.25, y2: a1[1] + oy * 0.25 }, gDim);
    el('line', { class: 'pcb-dim', x1: x2 + ox * 0.3, y1: y2 + oy * 0.3, x2: a2[0] + ox * 0.25, y2: a2[1] + oy * 0.25 }, gDim);
    el('line', { class: 'pcb-dim pcb-dim--main', x1: a1[0], y1: a1[1], x2: a2[0], y2: a2[1] }, gDim);
    [a1, a2].forEach(function (p, i) {
      var dx = (a2[0] - a1[0]), dy = (a2[1] - a1[1]), L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, s = i ? -1 : 1;
      el('path', { class: 'pcb-dim-arrow', d: 'M' + p[0] + ' ' + p[1] + ' l' + (s * ux * 9 - uy * 3.5) + ' ' + (s * uy * 9 + ux * 3.5) + ' l' + (uy * 7) + ' ' + (-ux * 7) + ' z' }, gDim);
    });
    var tx = (a1[0] + a2[0]) / 2 + ox * 0.55, ty = (a1[1] + a2[1]) / 2 + oy * 0.55;
    var tl = el('text', { class: 'pcb-dim-txt', x: tx, y: ty, transform: (x1 === x2) ? 'rotate(-90 ' + tx + ' ' + ty + ')' : '' }, gDim);
    tl.textContent = text;
  }
  dim(0, 0, 0, BH, -34, 0, '80.0 mm');
  dim(0, BH, BW, BH, 0, 34, '120.0 mm');
  [[0, 0], [BW, 0], [0, BH], [BW, BH]].forEach(function (p) {
    var sx = p[0] ? 1 : -1, sy = p[1] ? 1 : -1, cx = p[0] + sx * 18, cy = p[1] + sy * 18;
    el('path', { class: 'pcb-dim', d: 'M' + (cx - 7) + ' ' + cy + ' H' + (cx + 7) + ' M' + cx + ' ' + (cy - 7) + ' V' + (cy + 7) }, gDim);
    el('circle', { class: 'pcb-dim', cx: cx, cy: cy, r: 3.5 }, gDim);
  });

  // siatka płytki
  for (var gx = 20; gx < BW; gx += 40) el('line', { class: 'pcb-grid', x1: gx, y1: 0, x2: gx, y2: BH }, flat);
  for (var gy = 20; gy < BH; gy += 40) el('line', { class: 'pcb-grid', x1: 0, y1: gy, x2: BW, y2: gy }, flat);

  // tło routingu: pod wszystkimi elementami
  var gBg = el('g', { transform: plane(0) });
  var anchors = [];                                 // punkty padów elementów -> cienkie ścieżki do przelotek
  var vias = [];

  /* ---- drobne elementy: przelotki, otwory, sitodruk (płasko) + bryłki SMD ---- */
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  var gParts = el('g', {});
  var silk = [];
  function label(x, y, text) { silk.push([x, y, text]); }
  function smd(x, y, vertical, name) {
    var w = vertical ? 7 : 16, h = vertical ? 16 : 7;
    var top = box(gParts, x, y, w, h, 4, 'pcb-smd', 1);
    if (vertical) {
      el('rect', { class: 'pcb-pad', x: x, y: y, width: w, height: 4 }, top);
      el('rect', { class: 'pcb-pad', x: x, y: y + h - 4, width: w, height: 4 }, top);
    } else {
      el('rect', { class: 'pcb-pad', x: x, y: y, width: 4, height: h }, top);
      el('rect', { class: 'pcb-pad', x: x + w - 4, y: y, width: 4, height: h }, top);
    }
    label(x, y - 4, name);
    anchors.push(vertical ? [x + w / 2, y + h] : [x + w, y + h / 2]);
  }
  function ic(x, y, name) {
    for (var i = 0; i < 4; i++) {
      el('rect', { class: 'pcb-pin', x: x + 3 + i * 6, y: y - 3, width: 3, height: 3 }, flat);
      el('rect', { class: 'pcb-pin', x: x + 3 + i * 6, y: y + 16, width: 3, height: 3 }, flat);
    }
    var top = box(gParts, x, y, 26, 16, 6, 'pcb-smd', 1);
    el('circle', { class: 'pcb-pad', cx: x + 4, cy: y + 4, r: 1.3 }, top);
    label(x, y - 6, name);
    anchors.push([x + 26, y + 8]);
  }
  // strefy wolne od układów i ścieżek podzielone na sloty 46x36; każdy slot = najwyżej jeden element
  // (element ~26x16 + opis nad nim + przelotka obok), więc nic na siebie nie nachodzi
  var ZONES = [[284, 18, 470, 126], [284, 392, 470, 462], [38, 34, 132, 124], [640, 18, 746, 124], [38, 420, 132, 500], [640, 420, 746, 500]];
  var nr = 11, nc = 5, nu = 2;
  var SW = 46, SH = 36;
  ZONES.forEach(function (z) {
    for (var sy = z[1] + 10; sy + SH - 10 <= z[3]; sy += SH) {
      for (var sx = z[0]; sx + SW <= z[2]; sx += SW) {
        var kind = rnd();
        if (kind < 0.18) continue;                  // część slotów pusta: oddech
        var x = sx + 2, y = sy;
        if (kind < 0.55) smd(x, y, false, 'R' + nr++);
        else if (kind < 0.72) smd(x + 4, y - 2, true, 'C' + nc++);
        else ic(x, y, 'U' + nu++);
        // przelotka w slocie + cienka ścieżka od padu elementu
        var vx = sx + SW - 8, vy = sy + 22;
        vias.push([vx, vy]);
        var an = anchors[anchors.length - 1];
        el('path', { class: 'pcb-thin', d: 'M' + an[0] + ' ' + an[1] + ' H' + (vx - 4) + ' V' + vy + ' H' + vx }, gBg);
      }
    }
  });
  // złącze szpilkowe
  label(300, 492, 'J3');
  for (var hh = 0; hh < 12; hh++) {
    var pinTop = box(gParts, 318 + hh * 12, 480, 9, 9, 7, 'pcb-smd', 0);
    el('circle', { class: 'pcb-pad', cx: 322.5 + hh * 12, cy: 484.5, r: 2 }, pinTop);
  }
  // szyny zasilania wzdłuż krawędzi (szersze ścieżki)
  [['M34 9 H726'], ['M9 34 V226 M9 302 V486'], ['M34 511 H726'], ['M751 34 V200 M751 334 V486']].forEach(function (d) {
    el('path', { class: 'pcb-rail', d: d[0] }, gBg);
  });
  // J3: każdy pin ścieżką do dolnej szyny
  for (var jp = 0; jp < 12; jp++) {
    el('path', { class: 'pcb-thin', d: 'M' + (322.5 + jp * 12) + ' 489 V511' }, gBg);
  }

  /* ---- większe elementy: RJ45, USB-C, kwarc, cewka ---- */
  function bigPart(x, y, w, h, z, name, cls) {
    var t = box(gParts, x, y, w, h, z, cls || 'pcb-big', 2);
    label(x, y - 5, name);
    return t;
  }
  // RJ45 przy prawej krawędzi (za ścieżkami Lattice/Microchip), z otworem gniazda
  var rj = bigPart(706, 212, 46, 84, 22, 'J1');
  el('rect', { class: 'pcb-port', x: 716, y: 232, width: 30, height: 44, rx: 2 }, rj);
  el('rect', { class: 'pcb-led-port', x: 711, y: 218, width: 8, height: 5 }, rj);
  el('rect', { class: 'pcb-led-port', x: 711, y: 285, width: 8, height: 5 }, rj);
  // USB-C przy lewej krawędzi
  var usb = bigPart(6, 238, 30, 52, 9, 'J2', 'pcb-metal');
  el('rect', { class: 'pcb-port', x: 13, y: 250, width: 16, height: 28, rx: 7 }, usb);
  // kwarc nad rdzeniem
  var xt = bigPart(346, 148, 40, 16, 6, 'Y1', 'pcb-metal');
  el('rect', { class: 'pcb-pad', x: 346, y: 148, width: 5, height: 16 }, xt);
  el('rect', { class: 'pcb-pad', x: 381, y: 148, width: 5, height: 16 }, xt);
  el('path', { class: 'pcb-thin', d: 'M366 164 V196' }, gBg);
  // cewka przy NXP
  var coil = bigPart(470, 132, 26, 26, 12, 'L1');
  el('circle', { class: 'pcb-coil', cx: 483, cy: 145, r: 8 }, coil);
  el('path', { class: 'pcb-thin', d: 'M496 145 H520 V110' }, gBg);

  /* ---- diody LED (mrugają) ---- */
  var leds = [];
  for (var li = 0; li < 5; li++) {
    var lx = 146 + li * 20, ly = 18;
    var lt = box(gParts, lx, ly, 9, 5, 3, 'pcb-led', 1);
    leds.push(lt.firstChild);
    el('path', { class: 'pcb-thin', d: 'M' + (lx + 4.5) + ' 23 V30 H' + (lx + 14) }, gBg);
  }
  label(146, 14, 'D1-D5');

  // otwory montażowe
  [[18, 18], [742, 18], [18, 502], [742, 502]].forEach(function (p) {
    el('circle', { class: 'pcb-hole', cx: p[0], cy: p[1], r: 8 }, flat);
    el('circle', { class: 'pcb-hole-in', cx: p[0], cy: p[1], r: 4 }, flat);
  });
  vias.forEach(function (v) { el('circle', { class: 'pcb-via', cx: v[0], cy: v[1], r: 2.4 }, gBg); });
  silk.forEach(function (s) { el('text', { class: 'pcb-silk', x: s[0], y: s[1] }, flat).textContent = s[2]; });

  /* ---- ścieżki i impulsy (płasko, na płycie) ---- */
  var gTraces = el('g', { transform: plane(0) });
  var gCorePins = el('g', { transform: plane(0) });
  var gPulses = el('g', { transform: plane(0) });
  var gChips = el('g', {});
  var traces = [];

  LAYOUT.forEach(function (item) {
    var idx = data.findIndex(function (p) { return p.name === item[0]; });
    if (idx < 0) return;
    var x = item[1], y = item[2];
    var mx = x + W / 2, my = y + H / 2;
    var above = my < CY, left = mx < CX;
    var chipTraces = [];
    [-12, 0, 12].forEach(function (off) {
      var sx = mx + off, sy = above ? y + H : y;
      var ty = CY + item[3] + off * 0.67;
      var ex = left ? CX - CORE : CX + CORE;
      var path = el('path', { class: 'pcb-trace', d: 'M' + sx + ' ' + sy + ' V' + ty + ' H' + ex }, gTraces);
      // pin rdzenia na końcu ścieżki: widać, że ścieżka wchodzi w chip
      el('rect', { class: 'pcb-pin', x: left ? ex - 8 : ex, y: ty - 2, width: 8, height: 4 }, gCorePins);
      var t = { path: path, len: 0 };
      chipTraces.push(t);
      traces.push(t);
    });

    var g = el('g', { class: 'pcb-chip', tabindex: '0', role: 'button', 'aria-label': data[idx].name + '. Show more' }, gChips);
    // piny na płycie, wychodzące spod obudowy
    var pins = el('g', { transform: plane(0) }, g);
    for (var i = 0; i < 8; i++) {
      el('rect', { class: 'pcb-pin', x: x + 10 + i * 12.5, y: y - 6, width: 5, height: 6 }, pins);
      el('rect', { class: 'pcb-pin', x: x + 10 + i * 12.5, y: y + H, width: 5, height: 6 }, pins);
    }
    var top = box(g, x, y, W, H, HP, 'pcb-pkg', 2);
    el('circle', { class: 'pcb-pad', cx: x + 8, cy: y + 8, r: 2 }, top);
    el('text', { class: 'pcb-lbl', x: mx, y: my + 1 }, top).textContent = SHORT[item[0]] || item[0].toUpperCase();
    el('text', { class: 'pcb-sub', x: mx, y: my + 14 }, top).textContent = (data[idx].category || '').toUpperCase();

    function lit(on) { chipTraces.forEach(function (t) { t.hover = on; t.path.classList.toggle('is-lit', on || t.active); }); }
    g.addEventListener('mouseenter', function () { lit(true); });
    g.addEventListener('mouseleave', function () { lit(false); });
    g.addEventListener('focus', function () { lit(true); });
    g.addEventListener('blur', function () { lit(false); });
    g.addEventListener('click', function () { if (window.partnersOpen) window.partnersOpen(idx); });
    g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); g.dispatchEvent(new Event('click')); } });
  });

  /* ---- chip Antmicro ---- */
  el('rect', { class: 'pcb-glow', x: CX - CORE - 16, y: CY - CORE - 16, width: CORE * 2 + 32, height: CORE * 2 + 32, rx: 14 }, el('g', { transform: plane(0) }));
  var coreTop = box(svg, CX - CORE, CY - CORE, CORE * 2, CORE * 2, HC, 'pcb-core', 4);
  var coreFace = coreTop.firstChild;
  el('rect', { class: 'pcb-die', x: CX - CORE + 12, y: CY - CORE + 12, width: CORE * 2 - 24, height: CORE * 2 - 24, rx: 3 }, coreTop);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) {
    for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++) {
      el('rect', { class: 'pcb-die-cell', x: CX + q[0] * 40 - 9 + a * 6, y: CY + q[1] * 40 - 9 + b * 6, width: 4, height: 4 }, coreTop);
    }
  });
  function hex(r) {
    var p = [];
    for (var k = 0; k < 6; k++) { var a = Math.PI / 6 + k * Math.PI / 3; p.push([CX + r * Math.cos(a), CY + r * Math.sin(a)]); }
    return pts(p);
  }
  el('polygon', { class: 'pcb-hex', points: hex(26) }, coreTop);
  el('polygon', { class: 'pcb-hex-in', points: hex(12) }, coreTop);
  el('text', { class: 'pcb-sub', x: CX, y: CY + 46 }, coreTop).textContent = 'ANTMICRO';

  traces.forEach(function (t) { t.len = t.path.getTotalLength(); });

  /* ---- impulsy ---- */
  var pulses = [];
  function spawn() {
    var free = traces.filter(function (t) { return !t.active; });
    if (!free.length) return;
    var t = free[Math.floor(Math.random() * free.length)];
    t.active = true;
    t.path.classList.add('is-lit');
    var glow = el('circle', { class: 'pcb-pulse-glow', r: 9 }, gPulses);
    var dot = el('circle', { class: 'pcb-pulse', r: 3.2 }, gPulses);
    pulses.push({ t: t, dot: dot, glow: glow, p: 0, speed: 0.22 + Math.random() * 0.12 });
  }

  var visible = false, last = performance.now(), acc = 0;
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    acc += dt;
    if (acc > 0.55) { acc = 0; if (pulses.length < 5) spawn(); }
    for (var i = pulses.length - 1; i >= 0; i--) {
      var q = pulses[i];
      q.p += dt * q.speed * (300 / q.t.len);
      if (q.p >= 1) {
        q.dot.remove(); q.glow.remove();
        q.t.active = false;
        // impuls dotarł do rdzenia: krótki błysk rdzenia i losowa dioda
        coreFace.classList.add('is-flash');
        setTimeout(function () { coreFace.classList.remove('is-flash'); }, 160);
        var led = leds[Math.floor(Math.random() * leds.length)];
        led.classList.add('is-on');
        setTimeout(function () { led.classList.remove('is-on'); }, 420);
        if (!q.t.hover) q.t.path.classList.remove('is-lit');
        pulses.splice(i, 1);
        continue;
      }
      var pt = q.t.path.getPointAtLength(q.p * q.t.len);
      q.dot.setAttribute('cx', pt.x.toFixed(1)); q.dot.setAttribute('cy', pt.y.toFixed(1));
      q.glow.setAttribute('cx', pt.x.toFixed(1)); q.glow.setAttribute('cy', pt.y.toFixed(1));
    }
    if (visible) requestAnimationFrame(frame);
  }
  function isOn() { return document.documentElement.dataset.hero === 'pcb'; }
  var inView = true;
  function update() {
    var was = visible;
    visible = inView && isOn() && !reduce;
    if (visible && !was) { last = performance.now(); requestAnimationFrame(frame); }
  }
  new IntersectionObserver(function (e) { inView = e[0].isIntersecting; update(); }).observe(root);
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['data-hero'] });
  update();
})();
