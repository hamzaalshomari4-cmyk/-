/* Aurora auth pages — password visibility toggle + form guard.
   These forms are UI only: nothing is sent anywhere yet. */
(function () {
  'use strict';

  var EYE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';

  var EYE_OFF =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.7 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.8 17.8 0 0 1-3.2 4.2M6.2 6.2A17.6 17.6 0 0 0 2 12s3.5 7 10 7a10.7 10.7 0 0 0 4.6-1M9.9 9.9a3 3 0 0 0 4.2 4.2"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>';

  /* -------------------------------------------------- password visibility */
  document.querySelectorAll('[data-toggle]').forEach(function (button) {
    button.addEventListener('click', function () {
      var input = document.getElementById(button.getAttribute('data-toggle'));
      if (!input) return;

      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.innerHTML = show ? EYE_OFF : EYE;
      button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      input.focus({ preventScroll: true });
    });
  });

  /* ------------------------------------------------------------ form guard */
  document.querySelectorAll('form').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var button = form.querySelector('.submit');
      if (!button) return;

      var original = button.textContent;
      button.textContent = 'Not connected yet';
      button.disabled = true;

      setTimeout(function () {
        button.textContent = original;
        button.disabled = false;
      }, 1600);
    });
  });
})();
