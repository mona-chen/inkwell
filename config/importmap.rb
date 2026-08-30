pin "application"
pin "@hotwired/turbo-rails", to: "turbo.min.js"
pin "@hotwired/stimulus", to: "stimulus.min.js"
pin "@hotwired/stimulus-loading", to: "stimulus-loading.js"
pin "controllers/refresh_controller", to: "refresh_controller.js"
pin "controllers/appearance_controller", to: "appearance_controller.js"
pin "controllers/dropdown_controller", to: "dropdown_controller.js"
pin "controllers/block_editor_controller", to: "block_editor_controller.js"
pin "controllers/rich_text_controller", to: "rich_text_controller.js"
pin "controllers/image_block_controller", to: "image_block_controller.js"
pin "controllers/choice_field_controller", to: "choice_field_controller.js"
pin "controllers/media_picker_controller", to: "media_picker_controller.js"
pin "controllers/media_item_controller", to: "media_item_controller.js"
pin "controllers/media_picker_item_controller", to: "media_picker_item_controller.js"
pin "controllers/menu_builder_controller", to: "menu_builder_controller.js"
pin "controllers/auto_submit_controller", to: "auto_submit_controller.js"
pin "controllers/hello_controller", to: "hello_controller.js"
pin_all_from "app/javascript/controllers", under: "controllers"

# Sortable.js — the one drag/drop + animation library the editor and menu builder both lean
# on, pulled straight from a CDN via importmap so there's no node build step required to run
# the app (matches Rails' import-map-first philosophy; swap to a bundler later if the JS
# surface grows past what importmap comfortably handles).
pin "sortablejs", to: "https://ga.jspm.io/npm:sortablejs@1.15.2/modular/sortable.esm.js"

# TipTap WYSIWYG — pre-bundled with esbuild into a single ESM file (vendor/javascript/tiptap.js)
# so importmap doesn't need to pin its ~20 internal module specifiers.
pin "tiptap", to: "tiptap.js"
