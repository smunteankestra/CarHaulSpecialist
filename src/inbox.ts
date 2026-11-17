/** Admin-only live inbox: bell, notification list and alert sounds. */
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
    <button class="inbox-test" type="button" data-sound-test>Test Notification Sound</button>
    <ul class="inbox-list" data-inbox-list></ul>
  </div>
</div>


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
  if (!bell) return;

  var CURSOR_KEY = "inbox_cursor";
  var stored = Number(localStorage.getItem(CURSOR_KEY));
  var cursor = Number.isFinite(stored) && stored > 0 ? stored : Date.now() - 60000;
  var storedBooked = Number(localStorage.getItem("inbox_booked"));
  var bookedCursor = Number.isFinite(storedBooked) && storedBooked > 0 ? storedBooked : Date.now() - 60000;
  var ITEMS_KEY = "inbox_items";
  var BOOKED_KEY = "inbox_booked";
  var MAX_ITEMS = 50;
  var items = [];
  try {
    var storedItems = JSON.parse(localStorage.getItem(ITEMS_KEY) || "[]");
    if (Object.prototype.toString.call(storedItems) === "[object Array]") items = storedItems;
  } catch (error) {
    items = [];
  }
  var audio = null;
  var source = null;

  function saveItems() {
    try {
      localStorage.setItem(ITEMS_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
    } catch (error) {}
  }

  function unreadCount() {
    return items.filter(function (item) { return !item.read; }).length;
  }

  /** Adds a notification once; an existing one keeps its read state. */
  function remember(item) {
    var key = item.kind + "-" + item.id;
    var existing = items.find(function (entry) { return entry.kind + "-" + entry.id === key; });
    if (existing) return false;
    items.unshift(Object.assign({ read: false }, item));
    items = items.slice(0, MAX_ITEMS);
    saveItems();
    return true;
  }

  function saveCursor(value) {
    cursor = value;
    try { localStorage.setItem(CURSOR_KEY, String(value)); } catch (error) {}
  }

  function saveBookedCursor(value) {
    bookedCursor = value;
    try { localStorage.setItem(BOOKED_KEY, String(value)); } catch (error) {}
  }

  function money(value) { return "$" + Number(value || 0).toLocaleString(); }

  function paintSoundHint() {
    var hint = document.querySelector("[data-inbox-sound]");
    if (!hint) return;
    var blocked = !audio || audio.state !== "running";
    hint.hidden = !blocked;
  }

  function paint() {
    var unread = unreadCount();
    countEl.textContent = String(unread);
    countEl.hidden = unread === 0;
    bell.classList.toggle("has-alerts", unread > 0);
    document.title = unread
      ? "(" + unread + ") " + document.title.replace(/^\\(\\d+\\)\\s*/, "")
      : document.title.replace(/^\\(\\d+\\)\\s*/, "");

    list.innerHTML = items.length
      ? items
          .map(function (item) {
            var label =
              item.kind === "reminder"
                ? (item.window === "24h" ? "Delivery in 24h" : "Delivery in 2h") + " — " + item.number
                : item.kind === "booked"
                  ? "Booked by customer — " + item.number
                  : "New quote " + item.number;
            var sub =
              item.kind === "reminder"
                ? (item.customer_name || "") + " · due " + new Date(item.delivery_eta).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                : (item.customer_name || "") + " · " + item.origin_zip + " → " + item.dest_zip;
            var amount = item.kind === "reminder" ? "" : money(item.price);
            return (
              '<li><a class="' + (item.read ? "" : "is-unread") + '" data-inbox-item="' + item.kind + "-" + item.id + '" href="/admin/orders?q=' + encodeURIComponent(item.number) + '#order-' + item.id + '">' +
              '<span class="inbox-dot" aria-hidden="true"></span>' +
              "<strong>" + label + "</strong><span>" + sub + "</span><em>" + amount + "</em></a></li>"
            );
          })
          .join("")
      : '<li class="inbox-empty">Nothing yet.</li>';
  }

  /** Opening a notification keeps it in the list; it just stops being bold. */
  document.addEventListener("click", function (event) {
    var link = event.target.closest ? event.target.closest("[data-inbox-item]") : null;
    if (!link) return;
    var key = link.getAttribute("data-inbox-item");
    items = items.map(function (item) {
      if (item.kind + "-" + item.id === key) item.read = true;
      return item;
    });
    saveItems();
    paint();
  });

  /** Quote alerts use the till; delivery reminders use the truck horn. */
  function alertSound(kind) {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      var element = new Audio(kind === "reminder" ? "/sounds/truck-horn.mp3" : "/sounds/cash-register.mp3");
      element.volume = 0.9;
      var started = element.play();
      if (started && started.catch) started.catch(function () {});
    } catch (error) {}
  }



  /** A customer finished the booking form: that is worth a sound. */
  function receiveBooked(list, next) {
    if (next) saveBookedCursor(next);
    var added = 0;
    list.forEach(function (item) {
      if (
        remember({
          kind: "booked",
          id: item.id,
          number: item.number,
          customer_name: item.customer_name,
          origin_zip: item.origin_zip,
          dest_zip: item.dest_zip,
          price: item.price,
        })
      ) {
        added += 1;
      }
    });
    if (added) alertSound("quote");
    paint();
    if (added) openPanel();
  }

  function receive(quotes, next) {
    if (next) saveCursor(next);
    var added = 0;
    quotes.forEach(function (quote) {
      if (remember({ kind: "quote", id: quote.id, number: quote.number, customer_name: quote.customer_name, origin_zip: quote.origin_zip, dest_zip: quote.dest_zip, price: quote.price })) added += 1;
    });
    if (!added) return;
    alertSound("quote");
    paint();
    openPanel();
  }

  function connect() {
    if (source) source.close();
    source = new EventSource("/admin/api/stream?since=" + encodeURIComponent(String(cursor)) + "&booked=" + encodeURIComponent(String(bookedCursor)));
    source.onmessage = function (event) {
      try {
        var payload = JSON.parse(event.data);
        if (payload.quotes && payload.quotes.length) receive(payload.quotes, payload.cursor);
        if (payload.reminders && payload.reminders.length) receiveReminders(payload.reminders);
        if (payload.booked && payload.booked.length) receiveBooked(payload.booked, payload.bookedCursor);
      } catch (error) {}
    };
    source.onerror = function () {
      source.close();
      source = null;
      setTimeout(connect, 3000);
    };
  }

  function openPanel() {
    if (!panel) return;
    panel.hidden = false;
    bell.setAttribute("aria-expanded", "true");
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
  // A hidden tab has no business polling: it burns the D1 read quota for nothing.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (source) {
        source.close();
        source = null;
      }
      return;
    }
    if (!source) connect();
  });

  var soundTest = document.querySelector("[data-sound-test]");
  if (soundTest) {
    soundTest.addEventListener("click", function () {
      unlockAudio();
      alertSound("quote");
    });
  }

  var soundBtn = document.querySelector("[data-inbox-sound]");
  if (soundBtn) {
    soundBtn.addEventListener("click", function () {
      unlockAudio();
      alertSound("quote");
    });
  }

  // Exposed so other admin actions (marking an invoice paid) can play the same sound.
  window.__playAlert = alertSound;

  paint();
  paintSoundHint();
  connect();
})();
</script>`;
}
