/*
 * Old-browser safety net, loaded as a classic script before the app's module (the CSP
 * allows no inline script, hence a file). Deliberately ES5: it must parse everywhere.
 *
 *  - Array.prototype.at (Safari < 15.4, Chrome < 92) is polyfilled: the app uses it.
 *  - When the app never started — no ES modules (nomodule browsers), or the bundle's
 *    syntax is too new and the module fails to parse — #app stays empty; a short Czech
 *    message replaces the blank page. Module scripts run before DOMContentLoaded.
 */
(function () {
  'use strict';
  if (!Array.prototype.at) {
    Object.defineProperty(Array.prototype, 'at', {
      configurable: true,
      writable: true,
      value: function (index) {
        var n = Math.trunc ? Math.trunc(index) || 0 : parseInt(index, 10) || 0;
        if (n < 0) n += this.length;
        return n < 0 || n >= this.length ? undefined : this[n];
      },
    });
  }

  function check() {
    var app = document.getElementById('app');
    if (!app || app.children.length > 0) return;
    var box = document.createElement('div');
    box.style.maxWidth = '32em';
    box.style.margin = '3em auto';
    box.style.padding = '0 1em';
    box.style.color = '#eee';
    box.style.font = '18px/1.5 sans-serif';
    var title = document.createElement('h1');
    title.appendChild(document.createTextNode('Zvířecí šachy'));
    var text = document.createElement('p');
    text.appendChild(
      document.createTextNode(
        'Hru se v tomhle prohlížeči nepodařilo spustit — je možná moc starý. Zkus stránku ' +
          'načíst znovu, prohlížeč aktualizovat, nebo hru otevři v jiném prohlížeči ' +
          '(Chrome, Firefox, Safari, Edge) či na jiném zařízení.'
      )
    );
    box.appendChild(title);
    box.appendChild(text);
    document.body.style.background = '#2b2b2b';
    app.appendChild(box);
  }

  if (document.addEventListener) document.addEventListener('DOMContentLoaded', check);
})();
