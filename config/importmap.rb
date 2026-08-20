pin "application"
pin "@hotwired/turbo-rails", to: "turbo.min.js"
pin "@hotwired/stimulus", to: "stimulus.min.js"
pin "@hotwired/stimulus-loading", to: "stimulus-loading.js"
pin_all_from "app/javascript/controllers", under: "controllers"

# Sortable.js — the one drag/drop + animation library the editor and menu builder both lean
# on, pulled straight from a CDN via importmap so there's no node build step required to run
# the app (matches Rails' import-map-first philosophy; swap to a bundler later if the JS
# surface grows past what importmap comfortably handles).
pin "sortablejs", to: "https://ga.jspm.io/npm:sortablejs@1.15.2/modular/sortable.esm.js"

# TipTap WYSIWYG — pre-bundled with esbuild into a single ESM file (vendor/javascript/tiptap.js)
# so importmap doesn't need to pin its ~20 internal module specifiers.
pin "tiptap", to: "tiptap.js"
