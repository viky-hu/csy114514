# Window Modules

- Keep window-specific UI under its own folder.
- Move shared window helpers to `app/windows/shared` only after two or more windows need them.
- Use client components only for browser APIs, DOM measurement, local interaction state, or animation effects.
