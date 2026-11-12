/** Admin-only live inbox: bell, toasts and a chime for new quotes. */
export function adminInboxUi(): string {
  return `
<div class="inbox" data-inbox>
  <button class="inbox-bell" type="button" data-inbox-bell aria-label="New quote alerts" aria-expanded="false">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
    <span class="inbox-count" data-inbox-count hidden>0</span>
  </button>
  <div class="inbox-panel" data-inbox-panel hidden>
    <div class="inbox-panel-head">
      <strong>New quotes</strong>
      <button class="inbox-clear" type="button" data-inbox-clear>Mark all seen</button>
    </div>
    <p class="inbox-note" data-inbox-note role="status" hidden></p>
    <button class="inbox-sound" type="button" data-inbox-sound hidden>Sound is off — tap to enable alerts</button>
    <ul class="inbox-list" data-inbox-list></ul>
  </div>
</div>
<div class="toast-stack" data-toast-stack aria-live="polite"></div>

<script>
(function () {
  if (location.pathname.indexOf("/admin") !== 0) return;
  if (location.pathname.indexOf("/admin/login") === 0) {
    var shell = document.querySelector("[data-inbox]");
    if (shell) shell.remove();
    return;
  }
  var bell = document.querySelector("[data-inbox-bell]");
  var countEl = document.querySelector("[data-inbox-count]");
  var panel = document.querySelector("[data-inbox-panel]");
  var list = document.querySelector("[data-inbox-list]");
  var clearBtn = document.querySelector("[data-inbox-clear]");
  var stack = document.querySelector("[data-toast-stack]");
  if (!bell || !stack) return;

  var CURSOR_KEY = "inbox_cursor";
  var stored = Number(localStorage.getItem(CURSOR_KEY));
  var cursor = Number.isFinite(stored) && stored > 0 ? stored : Date.now() - 60000;
  var unseen = [];
  var audio = null;
  var source = null;

  function saveCursor(value) {
    cursor = value;
    try { localStorage.setItem(CURSOR_KEY, String(value)); } catch (error) {}
  }

  function money(value) { return "$" + Number(value || 0).toLocaleString(); }

  function paintSoundHint() {
    var hint = document.querySelector("[data-inbox-sound]");
    if (!hint) return;
    var blocked = !audio || audio.state !== "running";
    hint.hidden = !blocked;
  }

  function paint() {
    countEl.textContent = String(unseen.length);
    countEl.hidden = unseen.length === 0;
    bell.classList.toggle("has-alerts", unseen.length > 0);
    document.title = unseen.length ? "(" + unseen.length + ") " + document.title.replace(/^\\(\\d+\\)\\s*/, "") : document.title.replace(/^\\(\\d+\\)\\s*/, "");
    list.innerHTML = unseen.length
      ? unseen.map(function (q) {
          return '<li><a href="/admin/orders?status=quoted#order-' + q.id + '"><strong>' + q.number + '</strong><span>' + (q.customer_name || "") + ' · ' + q.origin_zip + " → " + q.dest_zip + '</span><em>' + money(q.price) + '</em></a></li>';
        }).join("")
      : '<li class="inbox-empty">Nothing new right now.</li>';
  }

  function chime() {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      // three rising notes over ~1s so it is unmistakable in a background tab
      [[880, 0], [1174.7, 0.34], [1567.98, 0.68]].forEach(function (pair) {
        var freq = pair[0];
        var offset = pair[1];
        var osc = audio.createOscillator();
        var gain = audio.createGain();
        var start = audio.currentTime + offset;
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.22, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start(start);
        osc.stop(start + 0.45);
      });
    } catch (error) {}
  }

  function toast(quote) {
    var el = document.createElement("div");
    el.className = "toast";
    el.innerHTML =
      '<div class="toast-body"><p class="toast-title">New quote ' + quote.number + '</p>' +
      '<p class="toast-sub">' + (quote.customer_name || "") + " · " + quote.origin_zip + " → " + quote.dest_zip + " · " + money(quote.price) + "</p>" +
      '<a class="toast-link" href="/admin/orders?status=quoted#order-' + quote.id + '">Open order</a></div>' +
      '<button class="toast-close" type="button" aria-label="Dismiss">×</button>';
    el.querySelector(".toast-close").addEventListener("click", function () { el.remove(); });
    stack.appendChild(el);
  }

  function receive(quotes, next) {
    var fresh = quotes.filter(function (quote) {
      return !unseen.some(function (item) { return item.id === quote.id; });
    });
    if (next) saveCursor(next);
    if (!fresh.length) return;
    unseen = fresh.concat(unseen).slice(0, 20);
    fresh.slice().reverse().forEach(toast);
    chime();
    paint();
  }

  function connect() {
    if (source) source.close();
    source = new EventSource("/admin/api/stream?since=" + encodeURIComponent(String(cursor)));
    source.onmessage = function (event) {
      try {
        var payload = JSON.parse(event.data);
        if (payload.quotes && payload.quotes.length) receive(payload.quotes, payload.cursor);
      } catch (error) {}
    };
    source.onerror = function () {
      source.close();
      source = null;
      setTimeout(connect, 3000);
    };
  }

  bell.addEventListener("click", function () {
    var open = !panel.hidden;
    panel.hidden = open;
    bell.setAttribute("aria-expanded", open ? "false" : "true");
  });

  // Deliberately inert: the button only answers with a joke.
  clearBtn.addEventListener("click", function () {
    var note = document.querySelector("[data-inbox-note]");
    if (!note) return;
    note.textContent = "Tat normal? sii cu tine? be oleaca de apa!!!";
    note.hidden = false;
  });

  document.addEventListener("click", function (event) {
    if (panel.hidden) return;
    if (event.target.closest && event.target.closest(".inbox")) return;
    panel.hidden = true;
    bell.setAttribute("aria-expanded", "false");
  });

  // Browsers only allow sound after an interaction, so unlock on any of them.
  function unlockAudio() {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      // a silent tick proves the context is running
      var osc = audio.createOscillator();
      var gain = audio.createGain();
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + 0.02);
    } catch (error) {}
    paintSoundHint();
  }
  ["pointerdown", "keydown", "touchstart", "click"].forEach(function (type) {
    document.addEventListener(type, unlockAudio, { passive: true });
  });

  // Stay connected while the tab is in the background: that is exactly when
  // dispatch needs the alert. Only reconnect if the stream died.
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && !source) connect();
  });

  var soundBtn = document.querySelector("[data-inbox-sound]");
  if (soundBtn) {
    soundBtn.addEventListener("click", function () {
      unlockAudio();
      chime();
    });
  }

  paint();
  paintSoundHint();
  connect();
})();
</script>`;
}
