# GitHub theme installation and automatic updates

Deploy the changes, run `bin/rails db:migrate`, restart the web/queue processes,
and open **Site design → Theme packages → Install from GitHub** as a platform
administrator. Installation executes trusted Rails templates just like ZIP theme
installation, so ordinary tenant managers cannot connect repositories.

Enter `https://github.com/owner/repository` (or `owner/repository`) and the branch,
which defaults to `main`. The repository root must contain a valid `theme.json`
package or a plain static `index.html` website. For a bundled app, commit its
compiled public assets and declare routes / SPA fallback in the theme manifest.
Use the SPA checkbox for plain static bundles without a manifest.

No `git clone`, Git hooks, arbitrary shell commands, npm installs, or bundle installs
run in the background updater. Repositories requiring dependencies/builds must use
CI to publish ready-to-serve output. The installer can retain packages needing a
build, but readiness checks prevent activation until those outputs/dependencies exist.
Rails gems require the normal application release and restart.

## Private repositories

Set **`INKWELL_GITHUB_TOKEN`** in the deployment environment to a fine-grained token
with Contents read access to the intended repositories. It is used only by the
platform-admin installer, never stored in source records, sent to browsers, or sent
to archive redirect hosts. Public repositories can work without a token, subject to
GitHub's lower unauthenticated API limits. Do not embed credentials in repository URLs.

## Automatic deploys

Two independent opt-ins:

- **Automatic update checks**: the Solid Queue recurring scheduler checks enabled
  connections every five minutes, resolves the selected branch to a commit SHA,
  and installs changed commits as new immutable theme releases.
- **Automatic activation**: a valid release can become the site's active theme.
  Without this, updates install for preview/review and leave the current site alone.

The updater downloads the archive for the resolved SHA, so branch movement during
installation cannot change the code being installed. ZIP path/symlink/size checks
are the same as for manual package imports. Metadata and downloads are restricted
to GitHub's API/archive hosts. The live theme changes only after installation and
readiness checks succeed. Failures appear beside the connection; older releases
remain intact. New public page requests use the new release; existing pages need a
reload, and immutable old asset paths remain available for cached pages.

These are scheduled checks, not an instantaneous push webhook. The production
Solid Queue worker **and recurring scheduler** must run (`bin/jobs` or the existing
Puma supervisor setup). **Check for updates** also queues a manual sync.

A manual theme switch suspends automatic activation rather than overriding the
owner's selection on the next commit. To resume, save the repository preferences
with automatic activation checked; that explicitly authorizes replacement of the
currently selected theme. Revoking/deactivating/demoting the last authorizing platform
admin stops its installs; another platform admin can take responsibility by saving
the connection preferences. Pausing update checks also stops already-queued automatic
checks when they execute; manual checks remain available.

## Preview, activation and rollback

Each connection lists its installed commits with Preview and Activate / roll back
actions. Activating a historical release switches the active-theme pointer and
pauses automatic activation. Saving preferences can explicitly re-enable it later.
No old release files are removed automatically. The main theme library shows the
latest connected release and the currently active release; older releases remain
available in the connection's release history.

## Storage and multiple servers

Theme packages currently live in `app/themes`, as with ZIP installations. **Persist
that directory and share it between web and worker processes / replicas** (preserving
bundled themes too). A worker installing on its own ephemeral filesystem does not
publish files to another server. Use a shared persistent theme volume or a deployment
pipeline that distributes the installed files to every serving instance. Database
metadata alone is insufficient. Updates can rehydrate a missing current release,
but persistent shared storage is required for uninterrupted production serving.
