# Site-wide custom CSS

After deploying this version, open Settings → Custom CSS (`/admin/settings?section=custom_css`) on the desired site. Paste CSS without style tags and choose Save changes. The setting is stored per site in the database; no capture, publish, asset build, or restart is needed after saving it. Clear the field and save to remove the overrides.

For the floating Framer badge:

```css
#__framer-badge-container,
#__framer-badge {
  display: none !important;
}
```

The rule continues to apply if the original runtime inserts the badge later. It does not remove runtime scripts or other Framer content.

The renderer includes saved CSS on public pages, imported originals, bundled/static frontend routes, and private Builder previews. Admin/authentication screens and the Builder editor are excluded. CSS is limited to 64 KB, escaped so it cannot close its style element to introduce HTML, and emitted with a CSP nonce when configured. These are CSS overrides, not a JavaScript injection setting.

The implementation is local until committed, pushed, and deployed to the production application. Saving CSS in a local development database does not modify production settings.

## Custom scripts

Open **Settings → Custom Scripts** on the deployed site. Head scripts are appended to
`<head>`; footer scripts are appended before `</body>`. Include complete `<script>`
tags, including `src` and `defer` for external integrations when appropriate. Each
field allows 64 KB. Save empty fields to remove the snippets.

These are trusted administrator snippets with access to the public page. They apply
to themed pages, preserved imports, and bundled frontend pages, but not admin,
authentication, or Builder previews. When the application uses CSP nonces, injected
script elements receive the response nonce; external hosts still need to be allowed
by the production CSP. Snippets load on full page responses; integrations using
client-side navigation should handle route changes themselves.
