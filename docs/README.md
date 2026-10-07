# GitHub Pages Deployment

This folder contains the static landing page for the Contact Driver Analytics project.

## Setup

GitHub Pages is configured to serve from the `main` branch, `/docs` folder.

1. Go to **Settings > Pages** in the GitHub repository
2. Set **Source** to "Deploy from a branch"
3. Set **Branch** to `main` and **Folder** to `/docs`
4. Click **Save**

The page will be available at: `https://<github-org>.github.io/sfguide-contact-driver-analytics/`

## Files

| File | Purpose |
|---|---|
| `index.html` | Self-contained landing page (inline CSS, inline JS, no external dependencies) |
| `.nojekyll` | Prevents Jekyll processing (ensures files starting with `_` are served) |
| `README.md` | This file |

## Notes

- The landing page is fully self-contained — no build step, no CDN, no external runtime dependencies
- Light/dark mode adapts automatically to the viewer's system preference
- Responsive layout works from 320px to 1440px+
