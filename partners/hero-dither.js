/* Hero, wariant B: animacja chipu (Blender, Antmicro 17) jako tło z ditheringiem.

   Potok na każdą klatkę ekranu:
   wideo -> płótno w niskiej rozdzielczości -> jasność -> wygładzenie w czasie (przenikanie klatek,
   płynny ruch i brak migotania) -> spadek jasności od chipu (głębia) -> dither Bayera 8x8
   na 4 poziomach (tło + 3 jasności kropek) -> kropki w kolorze --color-foreground.
   Kursor delikatnie przesuwa obraz (paralaksa). Rysowane tylko, gdy hero jest widoczne. */
(function () {
  var root = document.querySelector('[data-hero-dither]');
  if (!root) return;
  var video = root.querySelector('video');
  var canvas = root.querySelector('canvas');
  var ctx = canvas.getContext('2d', { willReadFrequently: true });
  var src = document.createElement('canvas');
  var sctx = src.getContext('2d', { willReadFrequently: true });

  /* ---- parametry wyglądu ---- */
  // rozmiar kropki: na ekranach Retina 1,5 px CSS (= 3 fizyczne piksele, ostre), na zwykłych 2 px
  var PX = (window.devicePixelRatio || 1) >= 2 ? 1.5 : 2;
  var FOCUS_X = 0.70;         // gdzie na ekranie stoi chip (ułamek szerokości / wysokości)
  var FOCUS_Y = 0.54;
  var ZOOM = 1.0;            // dodatkowe przybliżenie ponad minimum potrzebne do pokrycia okna
  var LO = 0.03, HI = 0.62;   // poziomy jasności przed ditherem (kontrast)
  var GAMMA = 0.95;           // <1 rozjaśnia półtony
  var LEVELS = 6;             // tło + 5 jasności kropek = półtony zamiast "jest/nie ma"
  var SHARPEN = 0.9;          // maska wyostrzająca przed ditherem (więcej szczegółów)
  var BLEND = 0.35;           // ile nowej klatki wchodzi do bufora (mniej = gładszy ruch)
  var FALLOFF = 0.28;         // jak mocno jasność opada od chipu na zewnątrz (głębia)
  var PARALLAX = 0;           // przesunięcie za kursorem (wyłączone na życzenie; np. 0.035 włącza)
  var SPEED = 0.75;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var B = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
           3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];
  var BAYER = B.map(function (v) { return (v + 0.5) / 64; });

  // kolor tuszu z tokenu strony (oklch -> rgb przez płótno)
  var ink = [234, 234, 234];
  function readInk() {
    var probe = document.createElement('canvas').getContext('2d');
    probe.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-foreground').trim() || '#eaeaea';
    probe.fillRect(0, 0, 1, 1);
    var d = probe.getImageData(0, 0, 1, 1).data;
    ink = [d[0], d[1], d[2]];
  }
  // kolor akcentu dla świecących ścieżek (niebieski Antmicro)
  var accent = [0, 132, 255];
  (function () {
    var probe = document.createElement('canvas').getContext('2d');
    probe.fillStyle = 'oklch(66% .19 252)';
    probe.fillRect(0, 0, 1, 1);
    var d = probe.getImageData(0, 0, 1, 1).data;
    accent = [d[0], d[1], d[2]];
  })();
  function tintOn() { return document.documentElement.dataset.tint !== 'mono'; }
  readInk();
  new MutationObserver(readInk).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  /* ---- zanikanie ditherem (zamiast gładkiej maski CSS) ----
     Jasność jest mnożona przez rampę, więc w stronę tekstu kropki się przerzedzają. */
  function smooth(a, b, t) { t = (t - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function isNarrow() { return window.innerWidth < 768; }
  // Zanik eliptyczny wokół chipu (zamiast prostokątnych ramp): granica idzie po łuku.
  // d = odległość od środka chipu w jednostkach elipsy; 0..IN pełna jasność, OUT = zero.
  // Niebieskie ścieżki mają większą elipsę, więc wystają dalej niż szary rysunek.
  // promienie osobno w każdą stronę: z lewej ciasno (tekst), z prawej szeroko, u dołu krótko (linia sekcji)
  // dark*: strefa przyciemnienia tonów (szczegóły zostają, tylko ciemniej); in/out*: pełne zanikanie na skraju
  // Jedno płynne przyciemnienie od chipu na zewnątrz, bez ucinania do zera:
  // in = gdzie zaczyna ciemnieć, out = gdzie osiąga minimum, min = jasność za tekstem (ledwo widoczna)
  var FADE = { cx: 0.70, cy: 0.50, rxL: 0.32, rxR: 0.70, ryT: 0.72, ryB: 0.85,
               inG: 0.16, outG: 0.82, minG: 0.10,
               inB: 0.45, outB: 1.25, minB: 0.32 };
  var FADE_M = { cx: 0.55, cy: 0.86, rxL: 0.80, rxR: 0.80, ryT: 0.42, ryB: 0.60,
                 inG: 0.35, outG: 1.0, minG: 0.10, inB: 0.45, outB: 1.15, minB: 0.2 };  // telefon: chip pod tekstem

  /* ---- bufory ---- */
  var w = 0, h = 0, out = null, buf = null, tbuf = null, fall = null, fadeG = null, fadeB = null, fresh = true;
  function resize() {
    var r = root.getBoundingClientRect();
    w = Math.max(1, Math.ceil(r.width / PX));
    h = Math.max(1, Math.ceil(r.height / PX));
    canvas.width = src.width = w;
    canvas.height = src.height = h;
    out = ctx.createImageData(w, h);
    buf = new Float32Array(w * h);
    tbuf = new Float32Array(w * h);     // wygładzona "turkusowość" piksela (świecące ścieżki)
    // mapa spadku jasności: eliptycznie od chipu na zewnątrz
    fall = new Float32Array(w * h);
    fadeG = new Float32Array(w * h);
    fadeB = new Float32Array(w * h);
    var F = isNarrow() ? FADE_M : FADE;
    for (var yy = 0; yy < h; yy++) {
      for (var xx = 0; xx < w; xx++) {
        var ux = xx / w - F.cx, uy = yy / h - F.cy;
        var ex = ux / (ux < 0 ? F.rxL : F.rxR), ey = uy / (uy < 0 ? F.ryT : F.ryB);
        var ed = Math.sqrt(ex * ex + ey * ey);
        // desktop: wszystko gaśnie ditherem ku dolnej linii sekcji, żeby obraz się na niej nie urywał
        var bottom = isNarrow() ? 1 : 1 - smooth(0.88, 1.0, yy / h);
        fadeG[yy * w + xx] = (F.minG + (1 - F.minG) * (1 - smooth(F.inG, F.outG, ed))) * bottom;
        fadeB[yy * w + xx] = (F.minB + (1 - F.minB) * (1 - smooth(F.inB, F.outB, ed))) * bottom;
      }
    }
    var cx = w * FOCUS_X, cy = h * FOCUS_Y, rx = w * 0.55, ry = h * 0.95;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var dx = (x - cx) / rx, dy = (y - cy) / ry;
        var d = Math.min(1, Math.sqrt(dx * dx + dy * dy));
        fall[y * w + x] = 1 - FALLOFF * d * d;
      }
    }
    fresh = true;
  }
  resize();
  new ResizeObserver(resize).observe(root);

  /* ---- paralaksa ---- */
  var px = 0, py = 0, tx = 0, ty = 0;
  window.addEventListener('pointermove', function (e) {
    tx = (e.clientX / window.innerWidth - 0.5) * 2;
    ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  function draw() {
    if (video.readyState < 2 || !buf) return;
    px += (tx - px) * 0.04;
    py += (ty - py) * 0.04;
    var vw = video.videoWidth, vh = video.videoHeight;
    // skala tak, żeby wideo przesunięte do punktu FOCUS i tak pokrywało całe okno (bez pustych pasów)
    var s = Math.max(2 * Math.max(FOCUS_X, 1 - FOCUS_X) * w / vw, 2 * Math.max(FOCUS_Y, 1 - FOCUS_Y) * h / vh) * ZOOM;
    var dw = vw * s, dh = vh * s;
    var ox = w * FOCUS_X - dw / 2 - px * w * PARALLAX;
    var oy = h * FOCUS_Y - dh / 2 - py * h * PARALLAX;
    sctx.drawImage(video, ox, oy, dw, dh);
    var p = sctx.getImageData(0, 0, w, h).data;
    var o = out.data;
    var k = fresh ? 1 : BLEND;
    fresh = false;
    var L1 = LEVELS - 1;
    var useTint = tintOn();
    // 1) bufory: jasność i "turkusowość", wygładzone w czasie
    for (var q = 0, n = w * h; q < n; q++) {
      var ii = q << 2, r = p[ii], g = p[ii + 1], b = p[ii + 2];
      var lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
      buf[q] += (lum - buf[q]) * k;
      // świecące ścieżki w oryginale są turkusowe: zielony i niebieski wyraźnie nad czerwonym
      var tt = ((g + b) * 0.5 - r) / 255;
      tt = tt <= 0.06 ? 0 : tt >= 0.22 ? 1 : (tt - 0.06) / 0.16;
      tbuf[q] += (tt - tbuf[q]) * k;
    }
    // 2) wyostrzenie (laplasjan z 4 sąsiadów) + dither
    for (var y = 0; y < h; y++) {
      var by = (y & 7) << 3;
      var up = y > 0 ? -w : 0, dn = y < h - 1 ? w : 0;
      for (var x = 0; x < w; x++) {
        var j = y * w + x, i = j << 2;
        var lf = x > 0 ? -1 : 0, rt = x < w - 1 ? 1 : 0;
        var l = buf[j];
        l += SHARPEN * (4 * l - buf[j + lf] - buf[j + rt] - buf[j + up] - buf[j + dn]);
        var t = tbuf[j];
        var v = (l - LO) / (HI - LO);
        v = v <= 0 ? 0 : v >= 1 ? 1 : Math.pow(v, GAMMA);
        var blue = useTint && t > BAYER[((x + 3) & 7) | (((y + 5) & 7) << 3)];
        v *= fall[j] * (blue ? fadeB[j] : fadeG[j]);             // głębia + eliptyczny zanik ditherem
        var sc = v * L1, base = sc | 0;
        var lvl = base + ((sc - base) > BAYER[by | (x & 7)] ? 1 : 0);
        var c = blue ? accent : ink;
        o[i] = c[0]; o[i + 1] = c[1]; o[i + 2] = c[2];
        o[i + 3] = (lvl / L1) * 255;
      }
    }
    ctx.putImageData(out, 0, 0);
  }

  /* ---- pętla ---- */
  function isOn() { return document.documentElement.dataset.hero === 'dither'; }
  var visible = true, raf = 0;
  function loop() {
    raf = 0;
    if (!visible || !isOn()) return;
    draw();
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (reduce) { video.pause(); draw(); return; }
    video.playbackRate = SPEED;
    var pr = video.play();
    if (pr && pr.catch) pr.catch(function () {});
    if (!raf) raf = requestAnimationFrame(loop);
  }
  new IntersectionObserver(function (e) {
    visible = e[0].isIntersecting && isOn();
    if (visible) start(); else video.pause();
  }).observe(root);
  new MutationObserver(function () {
    visible = isOn();
    if (visible) start(); else video.pause();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-hero'] });

  video.addEventListener('loadeddata', function () {
    if (reduce) video.currentTime = 12;
    draw();
    if (isOn()) { visible = true; start(); }
  });
  video.addEventListener('seeked', function () { fresh = true; draw(); });
  // pętla wideo: bez rozmazania przy skoku z końca na początek
  video.addEventListener('timeupdate', function () { if (video.currentTime < 0.1) fresh = true; });
  // zabezpieczenie: część przeglądarek blokuje autoodtwarzanie do pierwszej interakcji
  ['pointerdown', 'keydown', 'scroll'].forEach(function (ev) {
    window.addEventListener(ev, function once() {
      if (isOn() && video.paused && !reduce) { visible = true; start(); }
      window.removeEventListener(ev, once);
    }, { passive: true });
  });
  if (video.readyState >= 2 && isOn()) start();
  video.addEventListener('play', function () { if (!isOn()) video.pause(); });
})();
