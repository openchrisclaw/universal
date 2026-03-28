# Universal — Minimal Text Feed Prototype

Prototype of the "Universal" idea: a calm, text-only stream of personal updates organised by time. No frameworks, just vanilla HTML, CSS, and JavaScript (with light Web Components, no shadow DOM) plus `localStorage` for persistence.

## Features

- **Linear timeline** that defaults to today but lets you step through day, week, or month scopes.
- **URL routes for every slice of time**: `#/day/YYYY-MM-DD`, `#/week/YYYY-Www`, `#/month/YYYY-MM`, and individual entries at `#/entry/<id>`.
- **Quick composer** for short text updates with date/time controls; entries persist locally.
- **Shareable links** for each entry and each time scope (buttons copy canonical URLs to the clipboard).
- **Minimal monochrome UI** with subtle lines/spacing and gently animated hover states.
- **No social features** beyond copying links; the app runs fully client-side.

## Structure

```
universal/
├── index.html   # Root shell that loads styles + app script
├── styles.css   # Minimal greyscale design system
└── app.js       # All behaviour + Web Components
```

## Running It

Serve the folder with any static file server (or just open `index.html` in a browser). Because it uses `localStorage`, serving over `http://localhost` avoids browser security warnings.

Example with the built-in Python server:

```bash
cd universal
python -m http.server 4173
```

Then visit `http://localhost:4173/`.

## Extending

- Hook up a real backend by swapping the storage helpers in `app.js`.
- Add filters or search by extending `buildSections`.
- Introduce subtle animations by extending the existing CSS transitions.

The code sticks to the Notion brief: text-only, shareable URLs per entry/day/week/month, local storage persistence, and Web Components without shadow DOM. Let me know what else you’d like added.
