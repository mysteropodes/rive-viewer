# Rive Viewer

**Live demo → [mysteropodes.github.io/rive-viewer](https://mysteropodes.github.io/rive-viewer/)**

A web-based viewer for [Rive](https://rive.app) animation files (`.riv`), built with React + Vite.
Drop any `.riv` file and explore its artboards, interact with state machines, inspect ViewModels, and export frames.

---

## Features

- **Drag & drop / file picker** — load any `.riv` file directly from your computer, no upload required
- **Artboard browser** — lists every artboard in the file; click to switch instantly
- **Rive Renderer (WebGL2)** — uses `@rive-app/react-webgl2` for full compatibility including Lua scripts and ViewModel-driven animations
- **autoBind** — the default ViewModel instance is automatically bound on load so in-file button interactions work out of the box
- **State machine boolean controls** — toggle SM boolean inputs from the sidebar
- **Background & tint controls** — choose a background color (including transparent) and apply a hue/saturation tint overlay
- **React code panel** — shows ready-to-copy React snippets for `useRive`, ViewModel hooks, color API, and Text Value Runs
- **PNG export** — capture the current frame as a transparent PNG
- **PNG sequence export** — record an animation as a ZIP of PNG frames with alpha, at a chosen resolution (up to 4K) and frame rate (24 / 30 / 60 fps)

---

## Usage

Open the live page, then drop a `.riv` file onto the viewer or click to browse.
No account, no server, no file is ever uploaded — everything runs locally in your browser.

---

## Tech stack

| Package | Role |
|---|---|
| `@rive-app/react-webgl2` | Rive WebGL2 renderer (React wrapper) |
| `react` + `vite` | UI framework & build tool |
| `jszip` | ZIP generation for PNG sequence export |

---

## Local development

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

---

## Deployment

The project is automatically deployed to GitHub Pages on every push to `main` via the workflow in `.github/workflows/deploy.yml`.

---

## License

MIT
