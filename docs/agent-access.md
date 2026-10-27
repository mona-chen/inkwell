# Agent access and unified MCP

## Connect

Deploy this code, run `bin/rails db:migrate`, and restart all web/worker processes.
Open **Settings → AI agents** as a site owner. Create a named credential with the
permissions that agent needs. Copy the secret once; the database stores its SHA-256
hash. Credentials expire in 90 days and can be revoked immediately. Existing
Content API tokens cannot authenticate MCP and remain read-only.

Use a remote MCP client that supports Streamable HTTP, the 2025-06-18 or
2025-11-25 protocol, and a configured bearer header:

```json
{
  "url": "https://your-site.example/mcp",
  "headers": { "Authorization": "Bearer ink_agent_YOUR_SECRET" }
}
```

Exact client config syntax varies. Every POST needs `Content-Type: application/json`
and `Accept: application/json, text/event-stream`. Send `MCP-Protocol-Version:
2025-11-25` after initialize. The endpoint returns JSON, uses no protocol sessions,
and does not offer server notifications, SSE GET streams, OAuth discovery, or the
2026 protocol. GET and DELETE return 405. Foreign browser Origins are rejected;
server-side clients can omit Origin. Serve production over HTTPS. Request bodies
are capped at 1 MB; tool schemas impose further bounds. Requests are throttled at
300/minute per IP and 180/minute per credential using Rack::Attack.

Example discovery:

```sh
curl https://your-site.example/mcp \
  -H "Authorization: Bearer $INK_AGENT_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-11-25' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Credential permissions:

| Scope | Allows |
| --- | --- |
| `site:read` | Site identity, drafts, metadata, public custom code, activity, active plugin read tools |
| `content:write` | Create content, save conventional block drafts, edit metadata, restore draft changes |
| `content:publish` | Publish content; additionally required for metadata changes to published content |
| `builder:write` | Patch native Builder shared drafts |
| `plugins:read` | Inspect plugin inventory and public plugin configuration |
| `plugins:deploy` | Stage/activate/disable/roll back live frontend plugin code |
| `settings:write` | Change public custom code, Builder defaults, and declared live plugin settings |

Write scopes do not imply read scopes: grant both where the workflow requires it.
Every call rechecks credential expiry, revocation and the owning user's active
site-management access. Content tools also apply site scoping and Pundit policies.
Tool successes and failures are recorded under Settings → AI agents; argument
hashes, not raw arguments, identify calls. Selected write operations retain before/
after snapshots for safe restoration. Do not put secrets in frontend configuration.

## Build and improve content

1. `inkwell.site`, `inkwell.content_list`, `inkwell.content_read` inspect the site.
2. `inkwell.content_create` creates an unpublished page/post and returns editor and
   authenticated preview URLs. `content_save_draft` saves conventional block arrays.
3. `content_update_metadata` updates title/SEO fields; its description makes their
   immediate effect explicit. Published records require the publish scope too.
4. `content_publish` explicitly promotes a draft with the version returned by read/save.
   Stale versions fail instead of overwriting another editor's work.
5. `content_restore_draft` restores a previous agent draft when no subsequent content
   changes would be lost. Publishing makes normal content revisions where supported.
6. `settings_read` / `settings_update` inspect/edit site CSS, script snippets and Builder
   defaults with a revision check. Script fields accept complete `<script>` tags.

### Native Builder designs

When Ink Builder is active, it contributes `page_builder.workspace_read` and
`page_builder.workspace_patch`, plus `page_builder.workspace_restore` for guarded
restoration of an agent change. These operate on the **existing Builder shared-draft
model** rather than introducing another renderer or storing opaque HTML.

A shared document has `nodes` keyed by stable IDs, `roots` containing IDs, `settings`,
`customCss`, and `customJs`. Each native node has an `id`, native element `type`,
`settings`, styles, and a `children` array of IDs. Read before patching. A patch
contains `path`, `existed`, `before`, and `value` (or `remove: true`), and the current
workspace `revision`. Conflicts reject the whole call. Nodes remain editable. Agent patches reject raw ERB
and allow dynamic field bindings only from the Builder data-source catalog; a
visual-edit permission does not grant server-side Ruby execution. Custom JavaScript,
custom HTML/attributes, and executable URLs additionally require `settings:write`.
Treat code-writing permissions as trusted code access: site scripts execute in the
site origin and must be reviewed before using them in an authenticated browser.

The Builder owns its element definitions. Agents with browser access can inspect
`window.builder.copilotTools.TOOLS`, call `get_capabilities`, and use the existing
history-aware Copilot tools to compose/modify/render in the actual editor. The MCP
workspace transport is a remote shared-document edit, like collaboration, rather
than an entry in a browser's local undo stack. Before/after documents are audited.

**Compilation currently requires an authenticated Builder browser.** Open the
returned editor URL, join the shared workspace (the editor prompts if there is
unsaved conflicting work), save the draft, then inspect its preview. A headless
MCP-only client cannot render/compile a visual draft. MCP publishing refuses an
uncompiled shared document. Builder Save draft now leaves live content untouched;
Publish remains separate. This preserves one canonical renderer and real editability.

## Rails plugins contribute tools

Register definitions on the engine class, outside `on_activate`:

```ruby
register_mcp_tool(
  name: "inspect_catalog",
  scope: "site:read",
  read_only: true,
  description: "Inspect this site's catalog.",
  schema: { type: "object", properties: {}, additionalProperties: false }
) do |context, args|
  # Always scope records to context.site, and enforce domain-specific permissions.
  { products: context.site.products.limit(50).as_json(only: [:id, :name]) }
end
```

It appears as `<plugin_slug>.inspect_catalog` at the same `/mcp` endpoint. Core
adds the namespace, validates JSON Schema, checks token scope, executes in the
site/user context and records the action transactionally. Schemas use JSON Schema
2020-12; remote `$ref` resolution is disabled. Handlers must return a JSON object,
remain bounded, and enforce their own domain policies. External side effects must
use after-commit jobs/outbox semantics; a database transaction cannot undo an email
or a third-party API request.

Only globally active plugins enabled for this tenant contribute tools. Discovery is
recomputed for every request, so deactivation removes discovery **and direct calls**
in every process, with no tool-registry cache or separate MCP service. Ink Builder
and SEO Toolkit provide working examples. Refresh tools/list after changing plugin
activation; this stateless server does not emit list_changed notifications.

New engine code/registrations still require deployment/restart. The extension point
is an in-process plugin contract, not an arbitrary remote MCP-server proxy.

## Agents deploying live frontend plugins

Agents with `plugins:deploy` can submit an immutable manifest through
`inkwell.plugin_stage`:

```json
{
  "slug": "announcement",
  "manifest": {
    "name": "Announcement",
    "version": "1.0.0",
    "css": ".announcement { color: #6750ff; }",
    "javascript": "console.log(plugin.settings.message);",
    "settings": {
      "message": { "type": "string", "default": "Hello", "description": "Public announcement" }
    }
  }
}
```

Then call `inkwell.plugin_activate` with the staged `release_id` and the current
`expected_active_release_id` (`null` initially). Staging alone never runs code.
Activation updates a database pointer; every process serves the new release on its
next full public page response without restarting. Already-open pages need reload;
this is not code hot replacement in visitor sessions. Code stays out of admin,
authentication, and Builder previews. Browser integrations must handle their own
client-side route changes. Production CSP still applies to external destinations.

JavaScript runs in an IIFE with `plugin.slug` and `plugin.settings`. Settings support
string, boolean, and number types and are public, not secret storage. Active packages
automatically contribute `live.<slug>.settings_read` and `settings_update` tools.
Packages cannot register executable Ruby handlers; typed settings are the supported
declarative tool adapter. Releases do not accept file paths, Ruby, shell commands,
dependencies, or migrations.

To roll back, activate an older release ID with the current expected ID. To disable,
activate `null`. Owners can also choose/disable releases in Settings → AI agents,
even after revoking an agent credential. All releases remain available for rollback.

**Full Rails plugins** can be authored by a coding agent in the repository, tested,
reviewed and shipped through the normal build/deploy pipeline. New gems, Ruby
classes, routes and migrations require a release and rolling process restart; there
is deliberately no remote `eval`, shell tool, or production file writer in MCP.
