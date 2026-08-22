<h1 align="center">🖼️ Poster Size</h1>

<p align="center">
  Choose how big the posters/cards are on <b>Discover</b> and <b>Library</b>.<br>
  A plugin for <a href="https://github.com/REVENGE977/stremio-enhanced">Stremio Enhanced</a>, 100% local (nothing is sent or synced).
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-7B5BF5" alt="Version">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-7B5BF5" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/plugin-Stremio%20Enhanced-191970" alt="Stremio Enhanced">
</p>

## Features

- **S / M / L / XL size control** added to the filter row on Discover and Library.
- The grid's column count adjusts automatically to fit the chosen poster width and your window size.
- Your choice is **remembered** across sessions.

## Installation

1. Download `poster-size.plugin.js` from this repo.
2. In **Stremio Enhanced** → **Settings**, scroll down and click **OPEN PLUGINS FOLDER**.
3. Copy the file into that folder.
4. Enable the plugin in the Settings list, then reload (`Ctrl+R`) or restart the app.

## How it works

The plugin overrides the grid's `grid-template-columns` with an inline style based on your chosen minimum poster width - no server, no account changes. Your preference is stored **locally only**, in `localStorage`, under the key `stremio-enhanced-poster-size`.

## License

[MIT](LICENSE)
