const STORAGE_KEY = 'universal.entries.v1';
const TODAY_KEY = formatDateKey(new Date());

class AppShell extends HTMLElement {
  constructor() {
    super();
    this.state = {
      entries: [],
      route: parseHash(window.location.hash, TODAY_KEY),
    };
    this.editingEntryId = null;
    this.handleHashChange = this.handleHashChange.bind(this);
  }

  connectedCallback() {
    this.loadEntries();
    if (!window.location.hash) {
      window.location.hash = buildHash(this.state.route);
    } else {
      this.state.route = parseHash(window.location.hash, TODAY_KEY);
    }
    this.render();
    window.addEventListener('hashchange', this.handleHashChange);
  }

  disconnectedCallback() {
    window.removeEventListener('hashchange', this.handleHashChange);
  }

  handleHashChange() {
    this.state.route = parseHash(window.location.hash, TODAY_KEY);
    this.editingEntryId = null;
    this.render();
  }

  loadEntries() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.state.entries = JSON.parse(stored);
      } else {
        this.state.entries = seedEntries();
        this.persistEntries();
      }
    } catch (error) {
      console.error('Failed to load entries', error);
      this.state.entries = seedEntries();
    }
  }

  persistEntries() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state.entries));
    } catch (error) {
      console.error('Failed to save entries', error);
    }
  }

  render() {
    const sections = buildSections(this.state.entries, this.state.route);
    const scopeDetails = describeScope(this.state.route, sections, this.state.entries);
    const highlightId = this.state.route.type === 'entry' ? this.state.route.value : null;

    this.innerHTML = `
      <div class="app-frame">
        ${renderHeader(scopeDetails)}
        ${renderNav(scopeDetails)}
        ${renderComposer(this.state.route, this.state.entries)}
        ${renderTimeline(sections, highlightId, this.editingEntryId)}
      </div>
    `;

    this.bindInteractions();
  }

  bindInteractions() {
    const form = this.querySelector('[data-entry-form]');
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const content = (formData.get('content') || '').trim();
        if (!content) return;
        const dateValue = formData.get('date');
        const timeValue = formData.get('time');
        const timestamp = composeTimestamp(dateValue, timeValue);
        const entry = {
          id: createId(),
          content,
          createdAt: new Date(timestamp).toISOString(),
        };
        this.state.entries = [entry, ...this.state.entries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        this.persistEntries();
        form.reset();
        form.elements['date'].value = formatDateKey(new Date(timestamp));
        form.elements['time'].value = formatTimeValue(new Date(timestamp));
        this.editingEntryId = null;
        this.setRoute({ type: 'day', value: formatDateKey(new Date(timestamp)) });
      });
    }

    this.querySelectorAll('[data-scope]').forEach((button) => {
      button.addEventListener('click', () => {
        const scope = button.getAttribute('data-scope');
        let route = null;
        if (scope === 'day') {
          route = { type: 'day', value: TODAY_KEY };
        } else if (scope === 'week') {
          route = { type: 'week', value: weekIdFromDate(new Date()) };
        } else if (scope === 'month') {
          route = { type: 'month', value: monthIdFromDate(new Date()) };
        }
        if (route) this.setRoute(route);
      });
    });

    const todayButton = this.querySelector('[data-action="jump-today"]');
    if (todayButton) {
      todayButton.addEventListener('click', () => {
        this.setRoute({ type: 'day', value: TODAY_KEY });
      });
    }

    this.querySelectorAll('[data-shift]').forEach((button) => {
      button.addEventListener('click', () => {
        const direction = Number(button.getAttribute('data-shift'));
        const nextRoute = shiftRoute(this.state.route, direction, this.state.entries);
        this.setRoute(nextRoute);
      });
    });

    this.querySelectorAll('[data-copy-link]').forEach((button) => {
      button.addEventListener('click', async () => {
        const hash = button.getAttribute('data-copy-link');
        const url = buildAbsoluteUrl(hash);
        const original = button.textContent;
        try {
          await navigator.clipboard.writeText(url);
          button.textContent = 'copied';
          setTimeout(() => {
            button.textContent = original;
          }, 1600);
        } catch (error) {
          console.error('Clipboard failed', error);
        }
      });
    });

    this.querySelectorAll('[data-entry-edit]').forEach((button) => {
      button.addEventListener('click', () => {
        this.editingEntryId = button.getAttribute('data-entry-edit');
        this.render();
      });
    });

    this.querySelectorAll('[data-entry-delete]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.getAttribute('data-entry-delete');
        const ok = window.confirm('Delete this entry?');
        if (!ok) return;
        this.state.entries = this.state.entries.filter((entry) => entry.id !== id);
        this.persistEntries();
        if (this.editingEntryId === id) this.editingEntryId = null;
        this.render();
      });
    });

    this.querySelectorAll('[data-edit-form]').forEach((editForm) => {
      editForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const id = editForm.getAttribute('data-entry-id');
        const formData = new FormData(editForm);
        const content = (formData.get('content') || '').trim();
        if (!content) return;
        const dateValue = formData.get('date');
        const timeValue = formData.get('time');
        const timestamp = composeTimestamp(dateValue, timeValue);
        this.state.entries = this.state.entries
          .map((entry) => (entry.id === id ? { ...entry, content, createdAt: new Date(timestamp).toISOString() } : entry))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        this.persistEntries();
        this.editingEntryId = null;
        this.setRoute({ type: 'day', value: formatDateKey(new Date(timestamp)) });
      });
    });

    this.querySelectorAll('[data-cancel-edit]').forEach((button) => {
      button.addEventListener('click', () => {
        this.editingEntryId = null;
        this.render();
      });
    });
  }

  setRoute(route) {
    const targetHash = buildHash(route);
    if (window.location.hash === targetHash) {
      this.state.route = route;
      this.render();
    } else {
      window.location.hash = targetHash;
    }
  }
}

customElements.define('app-shell', AppShell);

function seedEntries() {
  const base = new Date();
  const examples = [
    {
      content: 'Sketched the first pass of Universal — a single flowing log of life that feels calmer than social feeds.',
      offsetHours: -2,
    },
    {
      content: 'Listed the must-haves: text-only, speedy composer, URLs for every slice of time.',
      offsetHours: -6,
    },
    {
      content: 'Walked through last week to see how the entries read in a linear stack.',
      offsetDays: -2,
      offsetHours: -1,
    },
  ];
  return examples.map((item) => {
    const date = new Date(base);
    if (item.offsetDays) date.setDate(date.getDate() + item.offsetDays);
    if (item.offsetHours) date.setHours(date.getHours() + item.offsetHours);
    return {
      id: createId(),
      content: item.content,
      createdAt: date.toISOString(),
    };
  });
}

function buildSections(entries, route) {
  const grouped = groupEntriesByDate(entries);
  if (route.type === 'entry') {
    const entry = entries.find((item) => item.id === route.value);
    if (!entry) {
      return [makeSection(grouped, TODAY_KEY)];
    }
    const dateKey = formatDateKey(new Date(entry.createdAt));
    return [makeSection(grouped, dateKey)];
  }

  if (route.type === 'day') {
    return [makeSection(grouped, route.value)];
  }

  if (route.type === 'week') {
    const start = startOfWeek(parseWeekId(route.value));
    return Array.from({ length: 7 }).map((_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return makeSection(grouped, formatDateKey(day));
    });
  }

  if (route.type === 'month') {
    const { year, month } = parseMonthId(route.value);
    const totalDays = daysInMonth(year, month);
    const sections = [];
    for (let day = 1; day <= totalDays; day += 1) {
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      sections.push(makeSection(grouped, dateKey));
    }
    return sections;
  }

  return Object.keys(grouped)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((key) => makeSection(grouped, key));
}

function makeSection(grouped, dateKey) {
  const entries = grouped[dateKey] || [];
  return {
    dateKey,
    entries,
    isEmpty: entries.length === 0,
  };
}

function renderHeader(scopeDetails) {
  return `
    <header class="app-header">
      <div>
        <p class="scope-pill">
          <span>${scopeDetails.scopeLabel}</span>
          <strong>${scopeDetails.scopeValue}</strong>
        </p>
        <h1 class="app-title">Universal</h1>
      </div>
      <div class="range-controls">
        <button data-shift="-1" aria-label="Previous">←</button>
        <button data-action="jump-today" aria-label="Jump to today">today</button>
        <button data-shift="1" aria-label="Next">→</button>
      </div>
    </header>
  `;
}

function renderNav(scopeDetails) {
  const shareRoute = scopeDetails.shareRoute || { type: 'day', value: TODAY_KEY };
  const activeScope = scopeDetails.scopeType === 'entry' ? 'day' : scopeDetails.scopeType;
  return `
    <nav class="time-nav">
      ${['day', 'week', 'month'].map((scope) => `
        <button data-scope="${scope}" class="${activeScope === scope ? 'active' : ''}">
          ${scope}
        </button>
      `).join('')}
      <button data-copy-link="${buildHash(shareRoute)}">share ${scopeDetails.scopeType}</button>
    </nav>
  `;
}

function renderComposer(route, entries) {
  let baseDate = new Date();
  if (route.type === 'day') {
    baseDate = parseISODate(route.value);
  } else if (route.type === 'entry') {
    const entry = entries.find((item) => item.id === route.value);
    if (entry) baseDate = new Date(entry.createdAt);
  } else if (route.type === 'week') {
    baseDate = startOfWeek(parseWeekId(route.value));
  } else if (route.type === 'month') {
    const { year, month } = parseMonthId(route.value);
    baseDate = new Date(year, month - 1, 1);
  }
  const dateValue = formatDateKey(baseDate);
  const timeValue = formatTimeValue(new Date());
  return `
    <section class="entry-composer" aria-label="Add a new entry">
      <form data-entry-form>
        <textarea name="content" placeholder="What’s the note?" required></textarea>
        <footer>
          <div class="controls">
            <input type="date" name="date" value="${dateValue}" required />
            <input type="time" name="time" value="${timeValue}" required />
          </div>
          <button type="submit">add entry</button>
        </footer>
      </form>
    </section>
  `;
}

function renderTimeline(sections, highlightId, editingId) {
  const content = sections.map((section) => renderDaySection(section, highlightId, editingId)).join('');
  return `<section class="timeline" aria-live="polite">${content}</section>`;
}

function renderDaySection(section, highlightId, editingId) {
  const date = new Date(section.dateKey);
  const label = formatDayLabel(date);
  const hash = buildHash({ type: 'day', value: section.dateKey });
  return `
    <article class="day-section" id="day-${section.dateKey}">
      <div class="day-header">
        <h2>${label}</h2>
        <button data-copy-link="${hash}">share day</button>
      </div>
      ${section.isEmpty ? renderEmptyDay(section.dateKey) : section.entries.map((entry) => renderEntry(entry, highlightId, editingId)).join('')}
    </article>
  `;
}

function renderEmptyDay(dateKey) {
  return `<div class="empty-day">No entries for ${formatShortDate(dateKey)} yet.</div>`;
}

function renderEntry(entry, highlightId, editingId) {
  if (entry.id === editingId) {
    return renderEntryEditor(entry);
  }
  const hash = buildHash({ type: 'entry', value: entry.id });
  const isHighlight = entry.id === highlightId;
  return `
    <div class="entry-card ${isHighlight ? 'highlight' : ''}" id="entry-${entry.id}">
      <p>${escapeHtml(entry.content)}</p>
      <div class="entry-meta">
        <span>${formatTimeDisplay(new Date(entry.createdAt))}</span>
        <div class="entry-controls">
          <button data-entry-edit="${entry.id}">edit</button>
          <button data-entry-delete="${entry.id}">delete</button>
          <button data-copy-link="${hash}">share</button>
        </div>
      </div>
    </div>
  `;
}

function renderEntryEditor(entry) {
  const dateValue = formatDateKey(new Date(entry.createdAt));
  const timeValue = formatTimeValue(new Date(entry.createdAt));
  return `
    <div class="entry-card editing" id="entry-${entry.id}">
      <form data-edit-form data-entry-id="${entry.id}">
        <textarea name="content" required>${escapeHtml(entry.content)}</textarea>
        <div class="edit-controls">
          <div class="edit-datetime">
            <input type="date" name="date" value="${dateValue}" required />
            <input type="time" name="time" value="${timeValue}" required />
          </div>
          <div class="edit-buttons">
            <button type="submit">save</button>
            <button type="button" data-cancel-edit>cancel</button>
          </div>
        </div>
      </form>
    </div>
  `;
}

function describeScope(route, sections, entries) {
  if (route.type === 'day') {
    return {
      scopeType: 'day',
      scopeLabel: 'DAY',
      scopeValue: formatScopeDate(route.value),
      shareRoute: route,
    };
  }
  if (route.type === 'week') {
    const weekStart = startOfWeek(parseWeekId(route.value));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return {
      scopeType: 'week',
      scopeLabel: 'WEEK',
      scopeValue: `${formatScopeDate(formatDateKey(weekStart))} – ${formatScopeDate(formatDateKey(weekEnd))}`,
      shareRoute: route,
    };
  }
  if (route.type === 'month') {
    const { year, month } = parseMonthId(route.value);
    return {
      scopeType: 'month',
      scopeLabel: 'MONTH',
      scopeValue: `${monthName(month)} ${year}`,
      shareRoute: route,
    };
  }
  if (route.type === 'entry') {
    const entry = entries.find((item) => item.id === route.value);
    return {
      scopeType: 'entry',
      scopeLabel: 'ENTRY',
      scopeValue: entry ? formatScopeDate(formatDateKey(new Date(entry.createdAt))) : 'ENTRY',
      shareRoute: route,
    };
  }
  return {
    scopeType: 'day',
    scopeLabel: 'DAY',
    scopeValue: formatScopeDate(TODAY_KEY),
    shareRoute: { type: 'day', value: TODAY_KEY },
  };
}

function groupEntriesByDate(entries) {
  return entries.reduce((acc, entry) => {
    const key = formatDateKey(new Date(entry.createdAt));
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    acc[key].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return acc;
  }, {});
}

function shiftRoute(route, delta, entries) {
  if (route.type === 'week') {
    const start = parseWeekId(route.value);
    start.setDate(start.getDate() + delta * 7);
    return { type: 'week', value: weekIdFromDate(start) };
  }
  if (route.type === 'month') {
    const { year, month } = parseMonthId(route.value);
    const next = new Date(year, month - 1 + delta, 1);
    return { type: 'month', value: monthIdFromDate(next) };
  }
  if (route.type === 'entry') {
    const entry = entries.find((item) => item.id === route.value);
    const fallback = entry ? new Date(entry.createdAt) : new Date();
    fallback.setDate(fallback.getDate() + delta);
    return { type: 'day', value: formatDateKey(fallback) };
  }
  const date = parseISODate(route.value);
  date.setDate(date.getDate() + delta);
  return { type: 'day', value: formatDateKey(date) };
}

function parseHash(hash, fallbackDay) {
  if (!hash || hash === '#/' || hash === '#') {
    return { type: 'day', value: fallbackDay };
  }
  const parts = hash.replace('#/', '').split('/');
  const [type, value] = parts;
  if (type === 'week' || type === 'month' || type === 'entry' || type === 'day') {
    return { type, value: value || fallbackDay };
  }
  return { type: 'day', value: fallbackDay };
}

function buildHash(route) {
  if (!route) return '#';
  return `#/${route.type}/${route.value}`;
}

function buildAbsoluteUrl(hash) {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${hash}`;
}

function formatDateKey(date) {
  if (!(date instanceof Date)) date = new Date(date);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseISODate(iso) {
  const date = new Date(iso);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatShortDate(key) {
  const date = new Date(key);
  return `${date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()} ${String(date.getDate()).padStart(2, '0')}`;
}

function formatScopeDate(key) {
  const date = new Date(key);
  return `${date.toLocaleDateString(undefined, { month: 'short' })} ${date.getDate()}, ${date.getFullYear()}`;
}

function formatDayLabel(date) {
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
}

function formatTimeDisplay(date) {
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatTimeValue(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function composeTimestamp(dateValue, timeValue) {
  const date = dateValue || formatDateKey(new Date());
  const time = timeValue || formatTimeValue(new Date());
  return `${date}T${time}:00`;
}

function createId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `entry-${Math.random().toString(36).slice(2, 10)}`;
}

function weekIdFromDate(date) {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function parseWeekId(weekId) {
  const [yearStr, weekStr] = weekId.split('-W');
  const year = Number(yearStr);
  const week = Number(weekStr) || 1;
  const january4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = january4.getUTCDay() || 7;
  const monday = new Date(january4);
  monday.setUTCDate(january4.getUTCDate() + 1 - dayOfWeek);
  monday.setUTCDate(monday.getUTCDate() + (week - 1) * 7);
  return new Date(monday);
}

function startOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = result.getDate() - day + (day === 0 ? -6 : 1);
  result.setDate(diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function monthIdFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function parseMonthId(monthId) {
  const [yearStr, monthStr] = monthId.split('-');
  return { year: Number(yearStr), month: Number(monthStr) };
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function monthName(month) {
  const date = new Date(2000, month - 1, 1);
  return date.toLocaleDateString(undefined, { month: 'long' }).toUpperCase();
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
