/* Kontakt: kopiowanie adresu e-mail i formularz.
   PROTOTYP: formularz niczego nie wysyła, po walidacji pokazuje tylko stan "wysłano". */
(function () {
  // eksport do Figmy: zamienniki masek CSS, bez animacji
  if (new URLSearchParams(location.search).get('figma') === '1') document.documentElement.classList.add('figma-export');

  var copy = document.querySelector('[data-copy]');
  if (copy) {
    copy.addEventListener('click', function () {
      var done = function () {
        copy.classList.add('is-copied');
        setTimeout(function () { copy.classList.remove('is-copied'); }, 1600);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(copy.dataset.copy).then(done, done);
      else done();
    });
  }

  var form = document.querySelector('.contact-form');
  if (!form) return;

  /* ---- temat: prefill z adresu (?topic=partnership|services|general) + dopasowany nagłówek ---- */
  var TITLES = { general: 'Send us a message', partnership: 'Become a partner', services: 'Work with us' };
  var HINTS = {
    general: '',
    partnership: 'Tell us about your company and the kind of partnership you have in mind.',
    services: 'Tell us about your project, timeline and the technologies involved.',
  };
  var titleEl = form.querySelector('[data-form-title]');
  var msg = form.querySelector('[name=message]');
  function applyTopic(v) {
    if (!TITLES[v]) v = 'general';
    var r = form.querySelector('input[name=topic][value="' + v + '"]');
    if (r) r.checked = true;
    titleEl.textContent = TITLES[v];
    msg.placeholder = HINTS[v];
  }
  applyTopic(new URLSearchParams(location.search).get('topic'));
  form.querySelectorAll('input[name=topic]').forEach(function (r) {
    r.addEventListener('change', function () { applyTopic(r.value); });
  });
  var doneBox = form.querySelector('.contact-form__done');
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function check(input) {
    var v = input.value.trim();
    var ok = !input.required || (v !== '' && (input.type !== 'email' || emailRe.test(v)));
    input.closest('.field').classList.toggle('is-invalid', !ok);
    return ok;
  }

  form.querySelectorAll('.field__input').forEach(function (input) {
    input.addEventListener('blur', function () { if (input.value) check(input); });
    input.addEventListener('input', function () {
      if (input.closest('.field').classList.contains('is-invalid')) check(input);
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var inputs = [].slice.call(form.querySelectorAll('.field__input'));
    var bad = inputs.filter(function (i) { return !check(i); });
    if (bad.length) { bad[0].focus(); return; }
    doneBox.hidden = false;
    doneBox.querySelector('button').focus();
  });

  form.querySelector('.contact-form__again').addEventListener('click', function () {
    form.reset();
    applyTopic(new URLSearchParams(location.search).get('topic'));
    doneBox.hidden = true;
    form.querySelector('.field__input').focus();
  });
})();
