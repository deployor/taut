# `app/`

The Taut app, runs in the main world alongside the Slack frontend. Responsible
for:

- Communicating with the backend via the `window.TautBridge` object
- Loading and managing Taut plugins
  - Accepting new plugin code from the backend
  - Instantiating and initializing plugins
  - Loading, reloading, and unloading plugins as the config changes
- Adding a Taut settings tab to Slack preferences
- Webpack module interception and React component patching

Environment: Bundled by esbuild, main world (Chromium, alongside Slack
frontend), TypeScript ESM with JSX

- `main.ts`: Entrypoint, bundled and executed in the main world. Imports
  `bootstrap.ts`.
- `bootstrap.ts`: Wires up the backend, config store, and starts plugins.
- `pluginManager.ts`: Contains the `PluginManager` class and `TautAPI`.
- `configStore.ts`: In-memory store for config.jsonc and user.css with change
  notifications.
- `settings.tsx`: Adds a "Taut" tab to Slack's Preferences dialog.
- `cdn.ts`: Loads Monaco editor and jsonc-parser from CDN at runtime.
- `css.ts`: Utilities for injecting and removing CSS styles.
- `helpers.ts`: Shared utilities for the Taut app.
- `env.d.ts`: Ambient module declarations.
- `slack/`: Utilities for interfacing with Slack's internals.
  - `webpack.ts`: Webpack utilities for finding Slack's internal modules.
  - `react.tsx`: React utilities, including `patchComponent` for replacing Slack
    components at runtime.
  - `childWindows.ts`: Tracks the child windows Slack renders into (huddles,
    canvas pop-outs) so Taut's styles can be mirrored into them.
