# Embed the 2026 report in Weebly

The interactive report has a separate entry point with no application header or navigation:

- Development: `http://localhost:3000/report-2026.html`
- Development embed preview: `http://localhost:3000/report-embed-preview.html`
- After deployment: `https://lfac-pt.github.io/bms-report/report-2026.html`

The existing application is unchanged at `/#/results/2026`.

## Use the repository's hosting

1. Deploy the updated application through the existing GitHub Pages workflow.
2. In Weebly, drag **Embed Code** onto the page and select **Edit Custom HTML**.
3. Paste the complete contents of [`weebly-embed-2026.html`](weebly-embed-2026.html).
4. Publish the Weebly page and verify the maps, charts, expanded lists, and phone layout.

The snippet includes an iframe, its automatic-height helper, and a link to open the report separately. The production URL is available only after these changes are deployed. Some embeds do not render in the Weebly editor; verify the published page.

Weebly documentation: https://www.weebly.com/app/help/us/en/topics/create-widgets-embed-code-and-add-external-content

## Export a fixed copy for independent hosting

Run:

```sh
npm run export:report
```

This builds `dist-report/` and packages it into `output/interactive-report-2026/report-2026-standalone.zip`.

- Upload the **contents** of `dist-report/` to an HTTPS static host, preserving the folder structure. It may be hosted at the domain root or in a subfolder.
- The report opens at `index.html`; no application server, database, or API key is required.
- Open the included `weebly-embed.html`, replace `https://YOUR-REPORT-HOST` with that folder's public URL, and paste the complete snippet into Weebly.
- Serve the files over HTTP(S). Opening `index.html` directly from disk will not support the data fetches.
- The copied data, images, credits, and code are fixed at build time. They are refreshed only when the export is rebuilt and replaced. Keep a copy of the ZIP if an immutable annual archive is needed.
- Map background tiles are requested from OpenStreetMap and require internet access. Species and municipality links open the full BMS application in a new tab; they are not archived detail pages.

The normal GitHub Pages build reads the deployed application's current data; use the independent export if the published annual report must remain a fixed snapshot.

## How the iframe behaves

- The report reuses the same components and mainland-only calculations as the full application.
- `ResizeObserver` measures the report content. The iframe and parent helper exchange messages to grow and shrink the frame when content or width changes.
- The parent validates both the sender window and the report URL's origin. Heights and scroll requests are bounded.
- In-report highlight links scroll the outer page to the relevant section. Species and municipality links open the full application separately.
- The helper supports multiple `iframe[data-bms-report]` elements without duplicate installation.
- Do not add iframe `sandbox` restrictions that disable scripts, same-origin behavior, or new-tab links.
- If custom scripts are blocked or removed, the iframe remains scrollable at its initial height, and the separate report link remains available.

## Acceptance check on Tagis's published page

1. Confirm the report opens without the BMS application header.
2. Expand and collapse the ICNF table; the iframe should follow both changes in height.
3. Select a weekly abundance bar and play the Vanessa map.
4. Use a highlight link to jump within the report.
5. Open a species or municipality link; the Tagis page should remain open.
6. Check the layout at phone and desktop widths and confirm there is no horizontal page overflow.
