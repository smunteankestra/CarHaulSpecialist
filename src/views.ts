import { LEAD_STATUSES, LEAD_STATUS_LABELS, type LeadStatus } from "./leads.ts";
import { conditionLabel } from "./quote.ts";
import { stateName } from "./states.ts";

export const site = {
  name: "Bond Auto Transport",
  legalName: "MGV Advisors LLC DBA Bond Auto Transport",
  url: "https://bondautotransport.com",
  tagline: "A stronger bond for every shipment.",
  phone: "(858) 699-4828",
  email: "operations@bondautotransport.com",
  address: "San Diego, CA 92122",
  hours: "Seven days a week",
  mc: "MC #1647505",
  dot: "DOT #4250470",
};

export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const money = (value: number) => `$${value.toLocaleString()}`;

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatDate(date: Date): string {
  return `${MONTH_NAMES[date.getUTCMonth()] ?? ""}/${String(date.getUTCDate()).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

export const when = (value: number) => {
  const date = new Date(value);
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return `${formatDate(date)}, ${time}`;
};

/** Format an ISO date or timestamp as Month/DD/YYYY without timezone drift. */
export function dateOnly(value: string | number | null): string {
  if (value === null || value === "") return "";
  if (typeof value === "number") return formatDate(new Date(value));
  const [year, month, day] = value.slice(0, 10).split("-");
  const monthName = month ? MONTH_NAMES[Number(month) - 1] : undefined;
  return year && monthName && day ? `${monthName}/${day}/${year}` : value;
}

/** Highlight inoperable vehicles in dispatch views. */
export function conditionTag(condition: string): string {
  const label = conditionLabel(condition);
  return condition === "running" ? esc(label) : `<strong class="condition-alert">${esc(label)}</strong>`;
}

const NAV = [
  { href: "/services/open", label: "Open transport" },
  { href: "/services/enclosed", label: "Enclosed transport" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function layout(options: { title: string; description: string; body: string; canonical?: string }): string {
  const canonicalUrl = options.canonical ? new URL(options.canonical, site.url).toString() : null;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(options.title)}</title>
<meta name="description" content="${esc(options.description)}">
${canonicalUrl ? `<link rel="canonical" href="${esc(canonicalUrl)}">` : ""}
<link rel="stylesheet" href="/styles.css">
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "MovingCompany",
    name: site.name,
    description: options.description,
    telephone: site.phone,
    email: site.email,
    areaServed: "United States",
    url: canonicalUrl ?? site.url,
  })}</script>
</head>
<body>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="/">Bond <span>Auto Transport</span></a>
    <nav class="nav">
      ${NAV.map((item) => `<a href="${item.href}">${esc(item.label)}</a>`).join("")}
    </nav>
    <a class="btn btn-accent header-cta" href="/quote">Get a quote</a>
  </div>
</header>
<main>${options.body}</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <p class="footer-brand">Bond Auto Transport</p>
      <p class="muted">${esc(site.tagline)}</p>
      <p class="muted small">${esc(site.legalName)}</p>
      <p class="muted small">${esc(site.address)} · ${esc(site.mc)} · ${esc(site.dot)}</p>
    </div>
    <div>
      <p class="footer-heading">Services</p>
      <a href="/services/open">Open transport</a>
      <a href="/services/enclosed">Enclosed transport</a>
      <a href="/services/expedited">Expedited pickup</a>
      <a href="/services/door-to-door">Door to door</a>
    </div>
    <div>
      <p class="footer-heading">Company</p>
      <a href="/how-it-works">How it works</a>
      <a href="/pricing">Pricing</a>
      <a href="/faq">FAQ</a>
      <a href="/contact">Contact</a>
    </div>
    <div>
      <p class="footer-heading">Reach dispatch</p>
      <a href="tel:${esc(site.phone.replace(/[^0-9+]/g, ""))}">${esc(site.phone)}</a>
      <a href="mailto:${esc(site.email)}">${esc(site.email)}</a>
      <p class="muted small">${esc(site.hours)}</p>
      <p class="muted small"><a href="/terms">Terms</a> · <a href="/privacy">Privacy</a></p>
    </div>
  </div>
</footer>
<script>
(function () {
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function pad(n) { return String(n).padStart(2, "0"); }
  function iso(date) { return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()); }
  function format(date) { return MONTHS[date.getMonth()] + "/" + pad(date.getDate()) + "/" + date.getFullYear(); }
  function parse(value) {
    var match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(value);
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
  }
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  document.querySelectorAll("[data-date-picker]").forEach(function (root) {
    var input = root.querySelector("input[type=hidden]");
    var trigger = root.querySelector(".date-trigger");
    var valueEl = root.querySelector(".date-value");
    var grid = root.querySelector(".date-grid");
    var title = root.querySelector(".date-title");
    var prev = root.querySelector(".date-prev");
    var next = root.querySelector(".date-next");
    var todayBtn = root.querySelector(".date-today");
    var clearBtn = root.querySelector(".date-clear");
    var allowPast = root.getAttribute("data-allow-past") === "true";
    var selected = parse(input.value);
    if (!allowPast && selected && selected < today) { selected = null; input.value = ""; }
    var view = selected ? new Date(selected.getFullYear(), selected.getMonth(), 1) : new Date(today.getFullYear(), today.getMonth(), 1);

    function updateLabel() {
      valueEl.textContent = selected ? format(selected) : "Select a date";
    }

    function render() {
      title.textContent = MONTHS[view.getMonth()] + " " + view.getFullYear();
      grid.innerHTML = "";
      var start = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
      var days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      for (var i = 0; i < start; i++) {
        var blank = document.createElement("span");
        blank.className = "date-day is-empty";
        grid.appendChild(blank);
      }
      for (var d = 1; d <= days; d++) {
        (function (day) {
          var date = new Date(view.getFullYear(), view.getMonth(), day);
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "date-day";
          btn.textContent = String(day);
          if (!allowPast && date < today) {
            btn.disabled = true;
            btn.classList.add("is-past");
          }
          if (selected && iso(date) === iso(selected)) btn.classList.add("is-selected");
          if (iso(date) === iso(today)) btn.classList.add("is-today");
          btn.addEventListener("click", function () {
            selected = date;
            input.value = iso(date);
            updateLabel();
            close();
            trigger.focus();
          });
          grid.appendChild(btn);
        })(d);
      }
      var previousLast = new Date(view.getFullYear(), view.getMonth(), 0);
      prev.disabled = !allowPast && previousLast < today;
    }

    function positionPopover() {
      var rect = root.getBoundingClientRect();
      var container = root.closest(".hero-card, .card, .modal-card");
      var bounds = container
        ? container.getBoundingClientRect()
        : { left: 0, right: window.innerWidth, width: window.innerWidth, top: 0, bottom: window.innerHeight };
      var width = Math.max(220, Math.min(300, bounds.width - 56));
      root.style.setProperty("--date-popover-width", width + "px");
      var alignRight = rect.left + width > bounds.right - 12;
      var alignLeft = rect.right - width < bounds.left + 12;
      root.classList.toggle("align-right", alignRight && !alignLeft);
      var alignTop = rect.bottom + 6 + 340 > bounds.bottom - 12 && rect.top - 6 - 340 > bounds.top + 12;
      root.classList.toggle("align-top", alignTop);
    }

    function open() {
      positionPopover();
      root.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      render();
    }
    function close() {
      root.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    }

    trigger.addEventListener("click", function () {
      if (root.classList.contains("is-open")) close();
      else open();
    });
    prev.addEventListener("click", function () {
      view.setMonth(view.getMonth() - 1);
      render();
    });
    next.addEventListener("click", function () {
      view.setMonth(view.getMonth() + 1);
      render();
    });
    todayBtn.addEventListener("click", function () {
      selected = new Date(today);
      input.value = iso(today);
      updateLabel();
      close();
      trigger.focus();
    });
    clearBtn.addEventListener("click", function () {
      selected = null;
      input.value = "";
      updateLabel();
      close();
      trigger.focus();
    });
    document.addEventListener("click", function (event) {
      if (!root.contains(event.target)) close();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") close();
    });
    window.addEventListener("resize", positionPopover);
    updateLabel();
  });
})();
</script>
<div class="chat-widget" id="chat-widget" hidden>
  <button class="chat-toggle" type="button" aria-label="Open chat" aria-expanded="false">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>
    Chat with us
  </button>
  <div class="chat-panel" role="dialog" aria-label="Chat with Bond Auto Transport" hidden>
    <div class="chat-head">
      <div><strong>Chat with dispatch</strong><span class="chat-sub">We reply as soon as we can.</span></div>
      <button class="chat-close" type="button" aria-label="Close chat">×</button>
    </div>
    <form class="chat-form">
      <label>Name<input name="name" required maxlength="100" autocomplete="name"></label>
      <label>Email or phone<input name="contact" maxlength="200" autocomplete="email"></label>
      <label>Message<textarea name="message" rows="3" required maxlength="2000"></textarea></label>
      <input class="chat-honeypot" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <button class="btn btn-accent btn-block" type="submit">Send message</button>
      <p class="chat-status" role="status"></p>
    </form>
  </div>
</div>
<script>
(function () {
  if (location.pathname.startsWith("/admin")) return;
  var widget = document.getElementById("chat-widget");
  if (!widget) return;
  widget.hidden = false;
  var toggle = widget.querySelector(".chat-toggle");
  var panel = widget.querySelector(".chat-panel");
  var close = widget.querySelector(".chat-close");
  var form = widget.querySelector(".chat-form");
  var status = widget.querySelector(".chat-status");
  function open() { panel.hidden = false; toggle.setAttribute("aria-expanded", "true"); }
  function closePanel() { panel.hidden = true; toggle.setAttribute("aria-expanded", "false"); }
  toggle.addEventListener("click", function () { if (panel.hidden) open(); else closePanel(); });
  close.addEventListener("click", closePanel);
  document.addEventListener("keydown", function (event) { if (event.key === "Escape") closePanel(); });
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    var data = Object.fromEntries(new FormData(form).entries());
    status.textContent = "Sending…";
    try {
      var response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.assign({}, data, { page: location.pathname })),
      });
      var result = await response.json();
      if (result.ok) {
        status.textContent = "Thanks — dispatch will reply shortly.";
        form.reset();
      } else {
        status.textContent = result.error || "Could not send. Please call us.";
      }
    } catch (error) {
      status.textContent = "Could not send. Please call us.";
    }
  });
})();
</script>
<script>
(function () {
  function formatPhone(value) {
    if (value.trim().startsWith("+")) return value;
    var digits = value.replace(/\\D/g, "");
    if (digits.length === 11 && digits.charAt(0) === "1") digits = digits.slice(1);
    digits = digits.slice(0, 10);
    if (digits.length === 0) return "";
    if (digits.length <= 3) return "(" + digits;
    if (digits.length <= 6) return "(" + digits.slice(0, 3) + ") " + digits.slice(3);
    return "(" + digits.slice(0, 3) + ") " + digits.slice(3, 6) + "-" + digits.slice(6);
  }
  var selector = 'input[name="phone"], input[name="origin_phone"], input[name="dest_phone"], input[name="customer_phone"], input[name="carrier_phone"], input[name="carrier_company_phone"], input[autocomplete="tel"]';
  document.querySelectorAll(selector).forEach(function (input) {
    input.addEventListener("input", function () {
      if (input.value.trim().startsWith("+")) return;
      var caret = input.selectionStart;
      var digitsBefore = (input.value.slice(0, caret).match(/\\d/g) || []).length;
      var formatted = formatPhone(input.value);
      if (formatted === input.value) return;
      input.value = formatted;
      var position = 0;
      var count = 0;
      if (digitsBefore > 0) {
        for (var i = 0; i < formatted.length; i++) {
          if (/\\d/.test(formatted.charAt(i))) {
            count++;
            if (count === digitsBefore) {
              position = i + 1;
              break;
            }
          }
        }
      }
      input.setSelectionRange(position, position);
    });
    input.addEventListener("blur", function () {
      var formatted = formatPhone(input.value);
      if (formatted !== input.value) input.value = formatted;
    });
  });
})();
</script>
<script>
(function () {
  var selects = document.querySelectorAll('select[name="transport_type"], select[name="condition"]');
  if (!selects.length) return;

  function closeAll() {
    Array.prototype.forEach.call(document.querySelectorAll(".pretty-select.is-open"), function (wrapper) {
      wrapper.classList.remove("is-open");
      var list = wrapper.querySelector(".pretty-select-list");
      var trigger = wrapper.querySelector(".pretty-select-trigger");
      if (list) list.hidden = true;
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    });
  }

  Array.prototype.forEach.call(selects, function (select) {
    var wrapper = document.createElement("div");
    wrapper.className = "pretty-select";
    var trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "pretty-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", select.name === "condition" ? "Vehicle condition" : "Transport");
    var value = document.createElement("span");
    value.className = "pretty-select-value";
    var chevron = document.createElement("span");
    chevron.className = "pretty-select-chevron";
    chevron.setAttribute("aria-hidden", "true");
    trigger.appendChild(value);
    trigger.appendChild(chevron);

    var list = document.createElement("ul");
    list.className = "pretty-select-list";
    list.setAttribute("role", "listbox");
    list.hidden = true;

    function update() {
      var option = select.options[select.selectedIndex] || select.options[0];
      value.textContent = option ? option.text : "";
      Array.prototype.forEach.call(list.children, function (item) {
        var selected = item.getAttribute("data-value") === select.value;
        item.classList.toggle("is-selected", selected);
        item.setAttribute("aria-selected", selected ? "true" : "false");
      });
    }

    function close() {
      list.hidden = true;
      wrapper.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    }

    function open() {
      closeAll();
      list.hidden = false;
      wrapper.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      var selected = list.querySelector(".is-selected") || list.firstElementChild;
      if (selected) selected.focus();
    }

    Array.prototype.forEach.call(select.options, function (option) {
      var item = document.createElement("li");
      item.className = "pretty-select-option";
      item.setAttribute("role", "option");
      item.setAttribute("data-value", option.value);
      item.tabIndex = -1;
      item.textContent = option.text;
      item.addEventListener("click", function () {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        update();
        close();
        trigger.focus();
      });
      list.appendChild(item);
    });

    trigger.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (list.hidden) open(); else close();
    });
    trigger.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (list.hidden) open();
      } else if (event.key === "Escape") {
        close();
      }
    });
    list.addEventListener("keydown", function (event) {
      var items = Array.prototype.slice.call(list.children);
      var index = items.indexOf(document.activeElement);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        var next = items[Math.min(items.length - 1, index + 1)];
        if (next) next.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        var prev = items[Math.max(0, index - 1)];
        if (prev) prev.focus();
      } else if (event.key === "Enter" && document.activeElement !== trigger) {
        event.preventDefault();
        document.activeElement.click();
      } else if (event.key === "Escape") {
        close();
        trigger.focus();
      }
    });
    document.addEventListener("click", function (event) {
      if (!wrapper.contains(event.target)) close();
    });

    select.parentNode.insertBefore(wrapper, select.nextSibling);
    select.classList.add("pretty-select-native");
    select.setAttribute("tabindex", "-1");
    wrapper.appendChild(trigger);
    wrapper.appendChild(list);
    update();
  });
})();
</script>
<script>
(function () {
  Array.prototype.forEach.call(document.querySelectorAll(".photo-input"), function (input) {
    var upload = input.closest(".photo-upload");
    var preview = upload ? upload.querySelector(".photo-preview") : null;
    if (!preview) return;
    var count = upload.querySelector(".photo-count");
    var error = upload.querySelector(".photo-error");
    var urls = [];

    function isSupported(file) {
      var type = file.type.toLowerCase();
      var name = file.name.toLowerCase();
      return (
        type === "image/jpeg" ||
        type === "image/png" ||
        type === "image/webp" ||
        type === "image/heic" ||
        type === "image/heif" ||
        name.endsWith(".jpg") ||
        name.endsWith(".jpeg") ||
        name.endsWith(".png") ||
        name.endsWith(".webp") ||
        name.endsWith(".heic") ||
        name.endsWith(".heif")
      );
    }

    function isHeic(file) {
      var type = file.type.toLowerCase();
      var name = file.name.toLowerCase();
      return type === "image/heic" || type === "image/heif" || name.endsWith(".heic") || name.endsWith(".heif");
    }

    function render(files) {
      urls.forEach(function (url) { URL.revokeObjectURL(url); });
      urls = [];
      preview.innerHTML = "";
      files.forEach(function (file) {
        var tile = document.createElement("div");
        tile.className = "photo-thumb";
        tile.title = file.name;
        if (!isHeic(file) && file.type.indexOf("image/") === 0) {
          var img = document.createElement("img");
          var url = URL.createObjectURL(file);
          urls.push(url);
          img.src = url;
          img.alt = file.name;
          img.loading = "lazy";
          tile.appendChild(img);
        } else {
          var fallback = document.createElement("span");
          fallback.className = "photo-thumb-fallback";
          fallback.textContent = isHeic(file) ? "HEIC" : "IMG";
          tile.appendChild(fallback);
        }
        preview.appendChild(tile);
      });
      preview.hidden = files.length === 0;
      if (count) {
        count.hidden = files.length === 0;
        count.textContent = files.length + " of 5 photos selected";
      }
    }

    input.addEventListener("change", function () {
      var selected = Array.prototype.slice.call(input.files || []);
      var valid = [];
      var errors = [];
      selected.forEach(function (file) {
        if (!isSupported(file)) {
          errors.push(file.name + " is not a JPEG, PNG, WebP or HEIC image.");
        } else if (file.size > 10 * 1024 * 1024) {
          errors.push(file.name + " is larger than 10 MB.");
        } else {
          valid.push(file);
        }
      });
      if (valid.length > 5) {
        errors.push("You can upload up to 5 photos. Only the first 5 will be used.");
        valid = valid.slice(0, 5);
      }
      if (valid.length !== selected.length) {
        try {
          var transfer = new DataTransfer();
          valid.forEach(function (file) { transfer.items.add(file); });
          input.files = transfer.files;
        } catch (e) {
          // Older browser: keep the selection and let the server validate.
        }
      }
      if (error) {
        error.hidden = errors.length === 0;
        error.textContent = errors.join(" ");
      }
      render(valid);
    });
  });
})();
</script>
</body>
</html>`;
}

export interface QuoteFormValues {
  name?: string;
  email?: string;
  phone?: string;
  origin_zip?: string;
  dest_zip?: string;
  transport_type?: string;
  vehicle_year?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  condition?: string;
  available_date?: string;
  notes?: string;
}

export function datePicker(name: string, value: string, allowPast = false): string {
  const label = value ? dateOnly(value) : "Select a date";
  return `<div class="date-picker" data-date-picker data-allow-past="${allowPast ? "true" : "false"}">
  <input type="hidden" name="${esc(name)}" value="${esc(value)}">
  <button type="button" class="date-trigger" aria-haspopup="dialog" aria-expanded="false">
    <span class="date-value">${esc(label)}</span>
    <svg class="date-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>
  </button>
  <div class="date-popover" role="dialog" aria-label="Choose a date">
    <div class="date-head">
      <button type="button" class="date-nav date-prev" aria-label="Previous month">‹</button>
      <strong class="date-title"></strong>
      <button type="button" class="date-nav date-next" aria-label="Next month">›</button>
    </div>
    <div class="date-weekdays">${["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => `<span>${day}</span>`).join("")}</div>
    <div class="date-grid"></div>
    <div class="date-foot">
      <button type="button" class="date-today">Today</button>
      <button type="button" class="date-clear">Clear</button>
    </div>
  </div>
</div>`;
}

export function quoteForm(values: QuoteFormValues = {}, error?: string): string {
  const v = (key: keyof QuoteFormValues) => esc(values[key] ?? "");
  const condition = values.condition || "running";
  return `<form class="quote-form" method="post" action="/quote" enctype="multipart/form-data">
  ${error ? `<p class="form-error">${esc(error)}</p>` : ""}
  <div class="field-row">
    <label class="field">
      <span>Pickup ZIP *</span>
      <input name="origin_zip" inputmode="numeric" maxlength="5" required value="${v("origin_zip")}" placeholder="e.g. 33101">
    </label>
    <label class="field">
      <span>Delivery ZIP *</span>
      <input name="dest_zip" inputmode="numeric" maxlength="5" required value="${v("dest_zip")}" placeholder="e.g. 10001">
    </label>
  </div>

  <div class="field-row">
    <label class="field">
      <span>Vehicle year</span>
      <input name="vehicle_year" maxlength="4" value="${v("vehicle_year")}" placeholder="2019">
    </label>
    <label class="field">
      <span>Make</span>
      <input name="vehicle_make" value="${v("vehicle_make")}" placeholder="Toyota">
    </label>
    <label class="field">
      <span>Model</span>
      <input name="vehicle_model" value="${v("vehicle_model")}" placeholder="Camry">
    </label>
  </div>

  <div class="field-row">
    <div class="field">
      <span>Transport</span>
      <select name="transport_type" aria-label="Transport">
        <option value="open"${values.transport_type !== "enclosed" ? " selected" : ""}>Open trailer</option>
        <option value="enclosed"${values.transport_type === "enclosed" ? " selected" : ""}>Enclosed trailer</option>
      </select>
    </div>
    <div class="field">
      <span>Vehicle condition</span>
      <select name="condition" aria-label="Vehicle condition">
        <option value="running"${condition === "running" ? " selected" : ""}>Run and drive</option>
        <option value="inoperable_steer_roll"${condition === "inoperable_steer_roll" || condition === "non-running" ? " selected" : ""}>Inoperable (steer and roll)</option>
        <option value="inoperable_no_steer"${condition === "inoperable_no_steer" ? " selected" : ""}>Inoperable (doesn't steer/roll/no keys)</option>
      </select>
    </div>
    <div class="field">
      <span>Pickup date</span>
      ${datePicker("available_date", values.available_date ?? "")}
    </div>
  </div>

  <div class="field-row">
    <label class="field">
      <span>Your name *</span>
      <input name="name" required value="${v("name")}" autocomplete="name">
    </label>
    <label class="field">
      <span>Email *</span>
      <input name="email" type="email" required value="${v("email")}" autocomplete="email">
    </label>
    <label class="field">
      <span>Phone *</span>
      <input name="phone" required value="${v("phone")}" autocomplete="tel" placeholder="(305) 555-0134">
    </label>
  </div>

  <label class="field">
    <span>Anything we should know?</span>
    <textarea name="notes" rows="3" placeholder="Modifications, tight access, second vehicle…">${v("notes")}</textarea>
  </label>

  <div class="field">
    <span>Vehicle photos (optional)</span>
    <div class="photo-upload">
      <label class="photo-drop">
        <input class="photo-input" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple>
        <span class="photo-plus" aria-hidden="true">+</span>
        <strong>Add vehicle photos</strong>
        <span class="photo-sub">Optional · up to 5 photos · JPEG, PNG, WebP or HEIC · 10 MB each</span>
      </label>
      <div class="photo-preview" hidden></div>
      <p class="photo-count muted small" hidden></p>
      <p class="photo-error form-error" role="alert" hidden></p>
    </div>
  </div>

  <button class="btn btn-accent btn-block" type="submit">See my price</button>
  <p class="form-note">No card needed. We quote from your route, then a dispatcher confirms the pickup window.</p>
</form>`;
}

export function homePage(): string {
  return layout({
    title: "Bond Auto Transport — vehicle transport with a real dispatch desk",
    description:
      "Instant vehicle shipping estimates for open and enclosed transport. Nationwide pickup, vetted carriers, and a dispatch team you can actually reach.",
    canonical: "/",
    body: `
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="eyebrow">Nationwide vehicle transport</p>
      <h1>Move a car without the runaround.</h1>
      <p class="lede">Get a real price from your route in under a minute, then a dispatcher confirms the pickup window. Open or enclosed, running or not, one car or a whole lot.</p>
      <ul class="ticks">
        <li>Instant estimate, no card required</li>
        <li>Vetted carriers with active insurance</li>
        <li>One dispatcher owns your order start to finish</li>
      </ul>
    </div>
    <div class="hero-card">
      <h2>Get your price</h2>
      ${quoteForm()}
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap trust-row">
    <div><strong>${esc(site.mc)}</strong><span>Broker authority</span></div>
    <div><strong>${esc(site.dot)}</strong><span>Registered carrier network</span></div>
    <div><strong>48 states</strong><span>Pickup coverage</span></div>
    <div><strong>7 days</strong><span>Dispatch availability</span></div>
  </div>
</section>

<section class="wrap section">
  <h2 class="section-title">Three steps, no phone tag</h2>
  <ol class="steps">
    <li><span class="step-num">1</span><h3>Tell us the route</h3><p>Two ZIPs and the vehicle. That is enough to price it.</p></li>
    <li><span class="step-num">2</span><h3>Confirm the window</h3><p>A dispatcher calls or emails within one business hour with the pickup window and the carrier.</p></li>
    <li><span class="step-num">3</span><h3>Track it to the door</h3><p>You get the carrier, the driver contact and status updates until it is delivered.</p></li>
  </ol>
</section>

<section class="wrap section">
  <h2 class="section-title">What we move</h2>
  <div class="cards">
    <a class="card" href="/services/open"><h3>Open transport</h3><p>The default for daily drivers and dealer inventory. Best price per mile.</p></a>
    <a class="card" href="/services/enclosed"><h3>Enclosed transport</h3><p>Hard-sided trailers for classics, exotics and anything you would not park outside.</p></a>
    <a class="card" href="/services/expedited"><h3>Expedited pickup</h3><p>When the vehicle has to move this week and waiting for a full load is not an option.</p></a>
    <a class="card" href="/services/door-to-door"><h3>Door to door</h3><p>Residential pickup and delivery where the truck can legally reach.</p></a>
  </div>
</section>

<section class="wrap section">
  <h2 class="section-title">Why people call us back</h2>
  <div class="cards">
    <div class="card"><h3>Dispatchers, not a queue</h3><p>You get a name and a direct line. The same person owns your order until delivery.</p></div>
    <div class="card"><h3>Carriers we can vouch for</h3><p>Active MC authority, current insurance, and a track record on the lane before we assign.</p></div>
    <div class="card"><h3>No surprise line items</h3><p>The quote breaks down base rate, condition fee and deposit. Nothing appears later.</p></div>
  </div>
</section>
`,
  });
}

function transitEstimate(distance: number): string {
  if (distance < 300) return "1–2 days";
  if (distance < 800) return "2–4 days";
  if (distance < 1500) return "3–5 days";
  return "5–7 days";
}

export function quotePage(options: {
  values: QuoteFormValues;
  leadId?: number;
  orderToken?: string;
  result?: {
    origin: string;
    destination: string;
    distance: number;
    transport: string;
    total: number;
    deposit: number;
    breakdown: string;
    estimated: boolean;
  };
  error?: string;
}): string {
  const result = options.result;

  if (result) {
    const hidden = [
      options.leadId ? `<input type="hidden" name="lead_id" value="${options.leadId}">` : "",
      options.orderToken ? `<input type="hidden" name="order_token" value="${esc(options.orderToken)}">` : "",
      ...([
        "name",
        "email",
        "phone",
        "origin_zip",
        "dest_zip",
        "transport_type",
        "vehicle_year",
        "vehicle_make",
        "vehicle_model",
        "condition",
        "available_date",
        "notes",
      ] as const).map((key) => `<input type="hidden" name="${key}" value="${esc(options.values[key] ?? "")}">`),
    ].join("");
    const vehicle =
      [options.values.vehicle_year, options.values.vehicle_make, options.values.vehicle_model]
        .filter(Boolean)
        .join(" ") || "Vehicle";

    return layout({
      title: "Your quote — Bond Auto Transport",
      description: `Your ${result.transport.toLowerCase()} quote from ${result.origin} to ${result.destination}.`,
      canonical: "/quote",
      body: `
<section class="wrap section">
  <div class="summary-grid">
    <div class="summary-main">
      <p class="eyebrow">Your quote</p>
      <h1 class="page-title">Your price is ready.</h1>

      <div class="summary-notice">
        <strong>No payment is required to book.</strong>
        <p>A dispatcher reviews every quote and confirms the carrier and pickup window before anything is charged.</p>
      </div>

      <div class="summary-meta">
        <span>Service type<strong>Door to door</strong></span>
        <span>Insurance<strong>Carrier cargo included</strong></span>
        <span>Transport<strong>${esc(result.transport)}</strong></span>
      </div>

      <div class="summary-price-card">
        <div class="summary-price-head">
          <p class="eyebrow">Your quoted price</p>
          <span class="badge badge-confirmed">No card required</span>
        </div>
        <p class="summary-price">${money(result.total)}</p>
        <p class="muted small">${esc(result.origin)} → ${esc(result.destination)} · ${result.distance.toLocaleString()} miles</p>
        <ul class="breakdown">
          <li><span>Base rate</span><span>$${esc(result.breakdown)}</span></li>
          <li><span>Deposit to reserve</span><span>${money(result.deposit)}</span></li>
          <li><span>Due now</span><span>$0</span></li>
        </ul>
        <form method="post" action="/book">
          ${hidden}
          <button class="btn btn-accent btn-block" type="submit">Continue to booking</button>
        </form>
        <p class="muted small">No card is charged now. Dispatch confirms the carrier and pickup window first.</p>
      </div>

      <div class="summary-help">
        <p><strong>Not sure about the exact date?</strong> You can change the pickup date when you book or when dispatch calls.</p>
        <p class="muted">Or call dispatch at <a href="tel:${esc(site.phone.replace(/[^0-9+]/g, ""))}">${esc(site.phone)}</a> — seven days a week.</p>
      </div>

      <div class="summary-trust">
        <div><strong>Licensed &amp; bonded</strong><span>MC and DOT authority on file</span></div>
        <div><strong>Vetted carriers</strong><span>Active insurance checked before assignment</span></div>
        <div><strong>No hidden line items</strong><span>The quote shows the base rate and deposit</span></div>
      </div>

      <div class="summary-next">
        <h2 class="section-title">What happens next</h2>
        <ol class="steps">
          <li><span class="step-num">1</span><h3>Confirm the details</h3><p>Add both addresses and a contact at each end.</p></li>
          <li><span class="step-num">2</span><h3>Dispatch finds the carrier</h3><p>We confirm the pickup window and the carrier before anything is charged.</p></li>
          <li><span class="step-num">3</span><h3>Track it to the door</h3><p>You get the carrier, the driver contact and status updates until delivery.</p></li>
        </ol>
      </div>
    </div>

    <aside class="summary-side">
      <h2 class="summary-side-title">Details</h2>

      <div class="summary-card">
        <h3>Booking summary</h3>
        <dl class="summary-rows">
          <div><dt>Distance</dt><dd>${result.distance.toLocaleString()} miles</dd></div>
          <div><dt>Pickup</dt><dd>${esc(options.values.origin_zip ?? "")} · ${esc(result.origin)}</dd></div>
          <div><dt>Delivery</dt><dd>${esc(options.values.dest_zip ?? "")} · ${esc(result.destination)}</dd></div>
          <div><dt>Transport</dt><dd>${esc(result.transport)}</dd></div>
          <div><dt>Pickup date</dt><dd>${options.values.available_date ? esc(dateOnly(options.values.available_date)) : "Flexible"}</dd></div>
          <div><dt>Transit estimate</dt><dd>${transitEstimate(result.distance)}</dd></div>
        </dl>
      </div>

      <div class="summary-card">
        <h3>Vehicle</h3>
        <dl class="summary-rows">
          <div><dt>Vehicle</dt><dd>${esc(vehicle)}</dd></div>
          <div><dt>Condition</dt><dd>${conditionTag(options.values.condition ?? "running")}</dd></div>
        </dl>
      </div>

      <div class="summary-card">
        <h3>Price details</h3>
        <div class="summary-due">
          <div><span class="muted small">Due now</span><strong>$0</strong></div>
          <p class="muted small">You won't pay until dispatch confirms the carrier and pickup window.</p>
        </div>
        <dl class="summary-rows">
          <div><dt>Total due</dt><dd><strong>${money(result.total)}</strong></dd></div>
          <div><dt>Deposit to reserve</dt><dd>${money(result.deposit)}</dd></div>
        </dl>
      </div>
    </aside>
  </div>
</section>`,
    });
  }

  return layout({
    title: "Get a vehicle shipping quote — Bond Auto Transport",
    description: "Instant open and enclosed vehicle transport pricing from your pickup and delivery ZIP codes.",
    canonical: "/quote",
    body: `
<section class="wrap section">
  <h1 class="page-title">Get your price</h1>
  <div class="quote-layout">
    <div>${quoteForm(options.values, options.error)}</div>
    <aside class="quote-side">
      <div class="price-card price-card-empty">
        <p class="eyebrow">How pricing works</p>
        <ul class="breakdown">
          <li><span>Open trailer</span><span>from $0.95 / mile</span></li>
          <li><span>Enclosed trailer</span><span>from $1.35 / mile</span></li>
          <li><span>Inoperable (steer and roll)</span><span>+ $150</span></li>
          <li><span>Inoperable (no steer/roll/keys)</span><span>+ $250</span></li>
          <li><span>Minimum</span><span>from $125 open · $175 enclosed</span></li>
        </ul>
        <p class="muted small">Local minimums step up with distance. Prices are per vehicle, door to door, before any optional services.</p>
      </div>
    </aside>
  </div>
</section>`,
  });
}

const SERVICE_PAGES: Record<string, { title: string; intro: string; points: string[] }> = {
  open: {
    title: "Open vehicle transport",
    intro:
      "A multi-car open trailer is how most vehicles move in the United States. It is the cheapest per mile and the right answer for daily drivers, dealer trades and fleet moves.",
    points: [
      "Best price per mile of any trailer type",
      "Shared loads, so pickup depends on the route filling",
      "Dust and road spray are normal; the vehicle arrives as it left",
      "Covered for the vehicle's actual cash value by the carrier's insurance",
    ],
  },
  enclosed: {
    title: "Enclosed vehicle transport",
    intro:
      "Hard-sided trailers for cars that should not see weather, gravel or a parking lot overnight: classics, exotics, low-mileage collector cars and anything with paint you care about.",
    points: [
      "Fully enclosed, single or multi-car trailers",
      "Soft straps and wheel baskets rather than chains",
      "Higher per-mile cost, tighter scheduling",
      "Ideal for auction wins, museum moves and private collections",
    ],
  },
  expedited: {
    title: "Expedited vehicle pickup",
    intro:
      "When the car has to move now, we look for a truck already heading your way instead of waiting for a full load to assemble.",
    points: [
      "Priority placement on the next available truck",
      "Typical pickup inside 24 to 48 hours on major lanes",
      "Higher cost than standard dispatch",
      "Best for auction deadlines, lease returns and relocations",
    ],
  },
  "door-to-door": {
    title: "Door-to-door transport",
    intro:
      "Pickup and delivery at the addresses you give us, where a full-size truck can legally stop. If the street is too tight, we agree a nearby meeting point before dispatch.",
    points: [
      "Residential and commercial addresses",
      "Access notes captured at booking",
      "Meeting-point fallback for narrow streets and low branches",
      "Same driver from pickup to delivery where the route allows",
    ],
  },
};

export function servicePage(slug: string): string | null {
  const page = SERVICE_PAGES[slug];
  if (!page) return null;
  return layout({
    title: `${page.title} — Bond Auto Transport`,
    description: page.intro.slice(0, 155),
    canonical: `/services/${slug}`,
    body: `
<section class="wrap section">
  <p class="eyebrow">Service</p>
  <h1 class="page-title">${esc(page.title)}</h1>
  <p class="lede narrow">${esc(page.intro)}</p>
  <ul class="ticks">
    ${page.points.map((point) => `<li>${esc(point)}</li>`).join("")}
  </ul>
  <div class="cta-row">
    <a class="btn btn-accent" href="/quote">Get a price for this route</a>
    <a class="btn btn-ghost" href="tel:${esc(site.phone.replace(/[^0-9+]/g, ""))}">Call dispatch</a>
  </div>
</section>`,
  });
}

export function howItWorksPage(): string {
  return layout({
    title: "How vehicle shipping works — Bond Auto Transport",
    description: "What happens between your quote and your car arriving: dispatch, carrier assignment, pickup inspection and delivery.",
    canonical: "/how-it-works",
    body: `
<section class="wrap section">
  <h1 class="page-title">How it works</h1>
  <ol class="steps steps-wide">
    <li><span class="step-num">1</span><h3>Quote</h3><p>Two ZIPs and the vehicle. The price comes from distance, trailer type and condition.</p></li>
    <li><span class="step-num">2</span><h3>Book</h3><p>You confirm the price and pay a deposit. That reserves the slot and starts dispatch.</p></li>
    <li><span class="step-num">3</span><h3>Assign</h3><p>We match the order to a carrier with authority, insurance and history on your lane.</p></li>
    <li><span class="step-num">4</span><h3>Pick up</h3><p>The driver inspects the vehicle with you and signs the bill of lading. Photographs go on the record.</p></li>
    <li><span class="step-num">5</span><h3>Deliver</h3><p>Same inspection at the destination, then the balance is settled. Damage claims are handled from the record, not from memory.</p></li>
  </ol>
</section>`,
  });
}

export function pricingPage(): string {
  return layout({
    title: "Vehicle transport pricing — Bond Auto Transport",
    description: "How vehicle shipping is priced: distance, trailer type, condition and season, with the fees we charge and why.",
    canonical: "/pricing",
    body: `
<section class="wrap section">
  <h1 class="page-title">How your price is built</h1>
  <p class="lede narrow">Four things move the number: distance, trailer type, whether the vehicle runs, and how busy the lane is.</p>
  <table class="table">
    <thead><tr><th>Line</th><th>Open</th><th>Enclosed</th></tr></thead>
    <tbody>
      <tr><td>Rate per mile</td><td>from $0.95</td><td>from $1.35</td></tr>
      <tr><td>Minimum charge</td><td>$125 local, $450 long-haul</td><td>$175 local, $650 long-haul</td></tr>
      <tr><td>Inoperable (steer and roll)</td><td>+ $150</td><td>+ $150</td></tr>
      <tr><td>Inoperable (doesn't steer/roll/no keys)</td><td>+ $250</td><td>+ $250</td></tr>
      <tr><td>Oversize or lifted</td><td>+ $200</td><td>+ $200</td></tr>
      <tr><td>Deposit to book</td><td>20%</td><td>20%</td></tr>
    </tbody>
  </table>
  <p class="muted small">The minimum steps up at 25, 75, 150 and 300 miles, so a short local move is not priced like a cross-country haul. Rates are planning figures. A dispatcher confirms the final price against the actual lane and dates before you pay anything.</p>
</section>`,
  });
}

const FAQS = [
  ["How long does pickup take?", "On busy lanes, usually two to five business days after booking. Expedited service targets 24 to 48 hours."],
  ["Is my car insured while it is on the truck?", "Yes. The carrier's cargo insurance covers the vehicle up to its actual cash value, and we check that the policy is current before assigning."],
  ["Can you ship a car that does not run?", "Yes, with a winch fee. Tell us at quote time so the truck arrives prepared."],
  ["Do you ship multiple vehicles?", "Yes. Add the second vehicle in the notes and dispatch will price the pair together."],
  ["What if the truck cannot reach my street?", "We agree a nearby meeting point before pickup. Large trucks need room to turn and load."],
  ["When is the balance due?", "On delivery, after the inspection. The deposit is what reserves the slot."],
];

export function faqPage(): string {
  return layout({
    title: "Vehicle transport FAQ — Bond Auto Transport",
    description: "Answers on pickup times, insurance, non-running vehicles, multiple cars and payment.",
    canonical: "/faq",
    body: `
<section class="wrap section">
  <h1 class="page-title">Questions we get every day</h1>
  <dl class="faq">
    ${FAQS.map(([question, answer]) => `<div><dt>${esc(question)}</dt><dd>${esc(answer)}</dd></div>`).join("")}
  </dl>
</section>`,
  });
}

export function contactPage(): string {
  return layout({
    title: "Contact dispatch — Bond Auto Transport",
    description: "Call, email or message the dispatch desk. We answer seven days a week.",
    canonical: "/contact",
    body: `
<section class="wrap section">
  <h1 class="page-title">Talk to dispatch</h1>
  <div class="cards">
    <div class="card"><h3>Phone</h3><p><a href="tel:${esc(site.phone.replace(/[^0-9+]/g, ""))}">${esc(site.phone)}</a></p><p class="muted small">${esc(site.hours)}</p></div>
    <div class="card"><h3>Email</h3><p><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></p><p class="muted small">We reply within one business hour.</p></div>
    <div class="card"><h3>Quote first</h3><p><a href="/quote">Get an instant price</a></p><p class="muted small">Fastest route to a booking.</p></div>
    <div class="card"><h3>Company</h3><p>${esc(site.legalName)}</p><p class="muted small">${esc(site.address)} · ${esc(site.mc)} · ${esc(site.dot)}</p></div>
  </div>
</section>`,
  });
}

export function legalPage(kind: "terms" | "privacy"): string {
  const isTerms = kind === "terms";
  return layout({
    title: `${isTerms ? "Terms of service" : "Privacy policy"} — Bond Auto Transport`,
    description: isTerms ? "Terms covering quotes, bookings, deposits and claims." : "What we collect, why, and how to have it removed.",
    canonical: `/${kind}`,
    body: `
<section class="wrap section prose">
  <h1 class="page-title">${isTerms ? "Terms of service" : "Privacy policy"}</h1>
  <p class="muted small">Operated by ${esc(site.legalName)}, ${esc(site.address)}. ${esc(site.mc)} · ${esc(site.dot)}. ${esc(site.phone)} · ${esc(site.email)}.</p>
  <p class="muted small">Placeholder draft. This must be reviewed by your counsel before launch.</p>
  ${isTerms
        ? `<h2>Quotes</h2><p>Quotes are estimates based on the route and vehicle described. A dispatcher confirms the final price before booking.</p>
         <h2>Bookings and deposits</h2><p>A deposit reserves capacity on a carrier's route. The balance is due on delivery after inspection.</p>
         <h2>Claims</h2><p>Condition is recorded on the bill of lading at pickup and delivery. Claims are assessed against that record and the carrier's insurance.</p>`
        : `<h2>What we collect</h2><p>Contact details, the addresses and vehicle information you provide, and the quote and order records that follow.</p>
         <h2>Why</h2><p>To price and dispatch your shipment, to contact you about it, and to keep the record required for insurance and tax.</p>
         <h2>Removal</h2><p>Email <a href="mailto:${esc(site.email)}">${esc(site.email)}</a> to request a copy or deletion of your data, subject to records we must retain.</p>`
      }
</section>`,
  });
}

export function notFoundPage(): string {
  return layout({
    title: "Page not found — Bond Auto Transport",
    description: "That page does not exist.",
    body: `<section class="wrap section"><h1 class="page-title">That page moved.</h1><p class="lede narrow">Try the quote form, or call dispatch on ${esc(site.phone)}.</p><a class="btn btn-accent" href="/quote">Get a price</a></section>`,
  });
}

export interface LeadRow {
  id: number;
  name: string;
  email: string;
  phone: string;
  origin_zip: string;
  origin_city: string | null;
  origin_state: string | null;
  dest_zip: string;
  dest_city: string | null;
  dest_state: string | null;
  transport_type: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  condition: string;
  available_date: string | null;
  distance_miles: number | null;
  price_estimate: number | null;
  price_is_estimate: number;
  broker_fee: number | null;
  carrier_fee: number | null;
  notes: string | null;
  status: string;
  created_at: number;
}

export interface LeadPhotoRow {
  id: number;
  lead_id: number;
  photo_key: string;
  created_at: number;
}

export function adminLoginPage(error?: string): string {
  return layout({
    title: "Dispatch login — Bond Auto Transport",
    description: "Staff sign in.",
    body: `
<section class="wrap section narrow-wrap">
  <h1 class="page-title">Dispatch login</h1>
  <form class="quote-form" method="post" action="/admin/login">
    ${error ? `<p class="form-error">${esc(error)}</p>` : ""}
    <label class="field"><span>Email</span><input name="email" type="email" required autocomplete="username"></label>
    <label class="field"><span>Password</span><input name="password" type="password" required autocomplete="current-password"></label>
    <button class="btn btn-accent btn-block" type="submit">Sign in</button>
  </form>
</section>`,
  });
}

function leadStatusBadge(status: string): string {
  const label = LEAD_STATUS_LABELS[status as LeadStatus] ?? status;
  return `<span class="badge badge-${esc(status)}">${esc(label)}</span>`;
}

function placeLabel(city: string | null, state: string | null, zip: string): string {
  const label = [city, state ? stateName(state) : null].filter(Boolean).join(", ");
  return label ? `${esc(label)} ${esc(zip)}` : esc(zip);
}

function leadModal(lead: LeadRow, photos: LeadPhotoRow[]): string {
  const vehicle = [lead.vehicle_year, lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(" ") || "—";
  const row = (label: string, value: string) =>
    `<tr><th>${esc(label)}</th><td>${value || '<span class="muted">—</span>'}</td></tr>`;

  return `<div class="modal" id="quote-${lead.id}">
  <a class="modal-backdrop" href="#quotes" aria-label="Close"></a>
  <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="quote-${lead.id}-title">
    <div class="modal-head">
      <div>
        <p class="eyebrow">Quote request</p>
        <h2 id="quote-${lead.id}-title">#${lead.id} · ${esc(lead.name)} ${leadStatusBadge(lead.status)}</h2>
        <p class="muted small">Received ${when(lead.created_at)}</p>
      </div>
      <a class="modal-close" href="#quotes" aria-label="Close">×</a>
    </div>

    <table class="table detail-table"><tbody>
      ${row("Customer", `${esc(lead.name)}<br><span class="muted small">${esc(lead.email)} · ${esc(lead.phone)}</span>`)}
      ${row("Route", `${placeLabel(lead.origin_city, lead.origin_state, lead.origin_zip)} → ${placeLabel(lead.dest_city, lead.dest_state, lead.dest_zip)}`)}
      ${row("Vehicle", `${esc(vehicle)}<br><span class="muted small">${esc(lead.transport_type)} trailer · ${conditionTag(lead.condition)}</span>`)}
      ${row("Pickup date", esc(dateOnly(lead.available_date)))}
      ${row("Distance", lead.distance_miles ? `${lead.distance_miles.toLocaleString()} miles` : "")}
      ${row("Customer notes", esc(lead.notes ?? ""))}
    </tbody></table>

    <h3 class="section-title mt">Pricing</h3>
    <form class="quote-form" method="post" action="/admin/leads/${lead.id}/fees">
      <div class="field-row">
        <label class="field"><span>Quoted price</span><input type="text" readonly value="${lead.price_estimate ? money(lead.price_estimate) : "—"}"></label>
        <label class="field"><span>Broker fee</span><input name="broker_fee" type="number" min="0" step="1" value="${lead.broker_fee ?? ""}" placeholder="0"></label>
        <label class="field"><span>Carrier fee</span><input name="carrier_fee" type="number" min="0" step="1" value="${lead.carrier_fee ?? ""}" placeholder="0"></label>
      </div>
      <button class="btn btn-accent btn-inline" type="submit">Save fees</button>
    </form>

    ${photos.length
      ? `<h3 class="section-title mt">Vehicle photos</h3>
    <div class="photo-grid">${photos
        .map(
          (photo) =>
            `<a href="/admin/photos/${photo.id}" target="_blank" rel="noopener"><img class="lead-photo" src="/admin/photos/${photo.id}" alt="Vehicle photo for quote #${lead.id}" loading="lazy"></a>`,
        )
        .join("")}</div>`
      : ""}

    <h3 class="section-title mt">Change status</h3>
    <form method="post" action="/admin/leads/${lead.id}/status" class="status-actions">
      ${LEAD_STATUSES.map(
        (value) => `<button class="chip${lead.status === value ? " active" : ""}" type="submit" name="status" value="${value}">${esc(LEAD_STATUS_LABELS[value])}</button>`,
      ).join("")}
    </form>
    <p class="form-note">Status changes are saved on the quote request.</p>
  </div>
</div>`;
}

export function adminPage(leads: LeadRow[], email: string, isAdmin = false, photos: LeadPhotoRow[] = []): string {
  const photosByLead = new Map<number, LeadPhotoRow[]>();
  for (const photo of photos) {
    const list = photosByLead.get(photo.lead_id);
    if (list) list.push(photo);
    else photosByLead.set(photo.lead_id, [photo]);
  }

  const rows = leads
    .map((lead) => {
      const photoCount = photosByLead.get(lead.id)?.length ?? 0;
      return `<tr>
      <td><a class="row-link" href="#quote-${lead.id}">${lead.id}</a></td>
      <td>${esc(lead.name)}<br><span class="muted small">${esc(lead.email)} · ${esc(lead.phone)}</span>${photoCount ? `<br><span class="muted small">${photoCount} photo${photoCount === 1 ? "" : "s"}</span>` : ""
        }</td>
      <td>${esc(lead.origin_zip)} → ${esc(lead.dest_zip)}<br><span class="muted small">${esc(lead.transport_type)} · ${conditionTag(lead.condition)}</span></td>
      <td>${lead.distance_miles ? `${lead.distance_miles.toLocaleString()} mi` : "—"}</td>
      <td>${lead.price_estimate ? money(lead.price_estimate) : "—"}${lead.broker_fee !== null || lead.carrier_fee !== null
          ? `<br><span class="muted small">Broker ${lead.broker_fee !== null ? money(lead.broker_fee) : "—"} · Carrier ${lead.carrier_fee !== null ? money(lead.carrier_fee) : "—"}</span>`
          : ""
        }</td>
      <td>${leadStatusBadge(lead.status)}</td>
      <td class="muted small">${when(lead.created_at)}</td>
    </tr>`;
    })
    .join("");

  return layout({
    title: "Quotes — Bond Auto Transport",
    description: "Dispatch console.",
    body: `
<section class="wrap section" id="quotes">
  <div class="admin-head">
    <div><p class="eyebrow">Dispatch</p><h1 class="page-title">Quote requests</h1>
      <nav class="admin-nav"><a href="/admin/orders">Orders</a>${isAdmin ? '<a href="/admin/users">Staff</a>' : ""}<a href="/admin/account">Account</a></nav>
    </div>
    <div class="admin-user"><span class="muted small">${esc(email)}</span><form method="post" action="/admin/logout"><button class="btn btn-ghost" type="submit">Sign out</button></form></div>
  </div>
  ${leads.length === 0 ? `<p class="muted">No requests yet.</p>` : `<table class="table rows-clickable"><thead><tr><th>#</th><th>Customer</th><th>Route</th><th>Miles</th><th>Quote</th><th>Status</th><th>Received</th></tr></thead><tbody>${rows}</tbody></table>`}
  ${leads.map((lead) => leadModal(lead, photosByLead.get(lead.id) ?? [])).join("")}
</section>`,
  });
}
