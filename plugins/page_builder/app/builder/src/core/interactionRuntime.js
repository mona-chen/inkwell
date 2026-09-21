// Interaction runtime. Shipped with the canvas widget runtime so it also lands in published
// output, and delegated on the document so elements added later are covered automatically.
//
// Everything it does is driven by `data-ink-interactions` (authored element data) and
// `data-ink-state` (the variant an element is in). There is no per-site scripting here: the
// same runtime serves a pricing switch, a mega menu, or a disclosure widget on any site.
//
// Keep this string free of ERB-sensitive tokens ({{ }}, <% %>): the saved page HTML is later
// rendered as a live template.
export const INTERACTION_RUNTIME = String.raw`(function () {
  if (window.__inkInteractions) return;
  window.__inkInteractions = true;

  function closest(el, sel) {
    while (el && el.nodeType === 1) { if (el.matches(sel)) return el; el = el.parentNode; }
    return null;
  }
  function hostOf(el) { return closest(el, '[data-ink-interactions]'); }
  function paused() { return document.body.classList.contains('ink-builder-design'); }
  function records(host) {
    try {
      var parsed = JSON.parse(host.getAttribute('data-ink-interactions') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) { return []; }
  }
  function resolveTarget(host, record) {
    switch (record.target) {
      case 'parent': return closest(host.parentElement, '.ink-element, .ink-imported-element') || host.parentElement;
      case 'next': return host.nextElementSibling;
      case 'previous': return host.previousElementSibling;
      case 'query': try { return host.ownerDocument.querySelector(record.selector); } catch (error) { return null; }
      case 'children': return host.firstElementChild;
      default: return host;
    }
  }

  // A state group is the set of elements that share one state vocabulary (data-ink-state-group).
  // Exclusive groups behave like an accordion: only one member may carry the state at a time.
  function members(host) {
    var group = host.getAttribute('data-ink-state-group');
    if (!group) return [host];
    return Array.prototype.slice.call(host.ownerDocument.querySelectorAll('[data-ink-state-group="' + CSS.escape(group) + '"]'));
  }
  function applyState(host, state, toggle, exclusive) {
    var current = host.getAttribute('data-ink-state');
    var next = toggle && current === state ? null : state;
    if (exclusive) members(host).forEach(function (member) { if (member !== host) member.removeAttribute('data-ink-state'); });
    if (next) host.setAttribute('data-ink-state', next); else host.removeAttribute('data-ink-state');
    host.dispatchEvent(new CustomEvent('ink:statechange', { bubbles: true, detail: { state: host.getAttribute('data-ink-state') } }));
  }
  function setHidden(target, hidden) {
    if (!target) return;
    target.hidden = hidden;
    if (hidden) target.setAttribute('data-ink-hidden-by-interaction', ''); else target.removeAttribute('data-ink-hidden-by-interaction');
  }
  function playMotion(target) {
    if (!target) return;
    target.style.animation = 'none';
    void target.offsetWidth;
    target.style.animation = '';
  }

  function run(host, record) {
    var target = resolveTarget(host, record);
    if (!target) return;
    var fire = function () {
      if (record.action === 'toggleState' || record.action === 'setState') {
        applyState(target, record.state, record.action === 'toggleState', record.exclusive === true);
      } else if (record.action === 'toggleClass') {
        target.classList.toggle(record.className);
      } else if (record.action === 'show') {
        setHidden(target, false);
      } else if (record.action === 'hide') {
        setHidden(target, true);
      } else if (record.action === 'scrollTo') {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (record.action === 'playMotion') {
        playMotion(target);
      }
    };
    if (record.delay) setTimeout(fire, record.delay); else fire();
  }

  function handle(event, name) {
    if (paused()) return;
    var host = hostOf(event.target);
    if (!host) return;
    records(host).forEach(function (record) { if (record.on === name) run(host, record); });
  }

  document.addEventListener('click', function (event) { handle(event, 'click'); }, true);
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target && event.target.tagName === 'BUTTON') return;
    handle(event, 'click');
  }, true);
  document.addEventListener('mouseover', function (event) {
    if (event.relatedTarget && event.target.contains(event.relatedTarget)) return;
    handle(event, 'hover');
  }, true);

  // The enter event fires once when the host first crosses into the viewport.
  function observe() {
    if (paused() || typeof IntersectionObserver !== 'function') return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        records(entry.target).forEach(function (record) { if (record.on === 'enter') run(entry.target, record); });
      });
    }, { threshold: 0.25 });
    return observer;
  }
  var observer = observe();
  function scan() {
    if (!observer || paused()) return;
    document.querySelectorAll('[data-ink-interactions]').forEach(function (host) {
      if (host.dataset.inkInteractionObserved) return;
      var needsEnter = records(host).some(function (record) { return record.on === 'enter'; });
      if (!needsEnter) return;
      host.dataset.inkInteractionObserved = '1';
      observer.observe(host);
    });
  }
  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });

  function fireLoad() {
    if (paused()) return;
    document.querySelectorAll('[data-ink-interactions]').forEach(function (host) {
      records(host).forEach(function (record) { if (record.on === 'load') run(host, record); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fireLoad);
  else fireLoad();
})();`;
