# Mobile map checks

Run with Playwright installed in the environment:

    NODE_PATH=/path/to/node_modules CHROME_PATH=/path/to/chrome node verification/mobile.cjs

Defaults to a local Python server and widths 320, 390, 1280. Set URL to test
production and WIDTHS to narrow a run. Covers nine temple selections, immediate
story/planet visibility, dialog bounds, focus cycling and return, full-text
scrolling, tour through Finish, disclosure Escape, attribution, page overflow,
runtime errors, and absence of invalid d.tile.openstreetmap.org requests.
Screenshots are written beside the script for visual inspection.

The existing OSM basemap, camera values, effects, audio and tour timing are
unchanged. This patch only removes the invalid fourth OSM subdomain.
