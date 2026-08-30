# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_08_30_153000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "action_mailbox_inbound_emails", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "message_checksum", null: false
    t.string "message_id", null: false
    t.integer "status", default: 0, null: false
    t.datetime "updated_at", null: false
    t.index ["message_id", "message_checksum"], name: "index_action_mailbox_inbound_emails_uniqueness", unique: true
  end

  create_table "action_text_rich_texts", force: :cascade do |t|
    t.text "body"
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.bigint "record_id", null: false
    t.string "record_type", null: false
    t.datetime "updated_at", null: false
    t.index ["record_type", "record_id", "name"], name: "index_action_text_rich_texts_uniqueness", unique: true
  end

  create_table "active_storage_attachments", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.bigint "record_id", null: false
    t.string "record_type", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.string "content_type"
    t.datetime "created_at", null: false
    t.string "filename", null: false
    t.string "key", null: false
    t.text "metadata"
    t.string "service_name", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "comments", force: :cascade do |t|
    t.string "ancestry"
    t.text "body", null: false
    t.datetime "created_at", null: false
    t.string "guest_email"
    t.string "guest_name"
    t.bigint "post_id", null: false
    t.string "status", default: "pending", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id"
    t.index ["ancestry"], name: "index_comments_on_ancestry"
    t.index ["post_id"], name: "index_comments_on_post_id"
    t.index ["status"], name: "index_comments_on_status"
    t.index ["user_id"], name: "index_comments_on_user_id"
  end

  create_table "contact_form_messages", force: :cascade do |t|
    t.text "body", null: false
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.string "name", null: false
    t.boolean "read", default: false, null: false
    t.bigint "site_id", null: false
    t.datetime "updated_at", null: false
    t.index ["site_id"], name: "index_contact_form_messages_on_site_id"
  end

  create_table "installed_plugins", force: :cascade do |t|
    t.boolean "active", default: false, null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.jsonb "settings", default: {}, null: false
    t.string "slug", null: false
    t.datetime "updated_at", null: false
    t.string "version"
    t.index ["slug"], name: "index_installed_plugins_on_slug", unique: true
  end

  create_table "media_items", force: :cascade do |t|
    t.string "alt_text"
    t.string "caption"
    t.datetime "created_at", null: false
    t.bigint "site_id", null: false
    t.datetime "updated_at", null: false
    t.bigint "uploaded_by_id", null: false
    t.index ["site_id"], name: "index_media_items_on_site_id"
    t.index ["uploaded_by_id"], name: "index_media_items_on_uploaded_by_id"
  end

  create_table "menu_items", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "label", null: false
    t.bigint "linkable_id"
    t.string "linkable_type"
    t.bigint "menu_id", null: false
    t.bigint "parent_id"
    t.integer "position", default: 0, null: false
    t.datetime "updated_at", null: false
    t.string "url"
    t.index ["linkable_type", "linkable_id"], name: "index_menu_items_on_linkable"
    t.index ["menu_id", "position"], name: "index_menu_items_on_menu_id_and_position"
    t.index ["menu_id"], name: "index_menu_items_on_menu_id"
    t.index ["parent_id"], name: "index_menu_items_on_parent_id"
  end

  create_table "menus", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "location", null: false
    t.string "name", null: false
    t.bigint "site_id", null: false
    t.datetime "updated_at", null: false
    t.index ["site_id", "location"], name: "index_menus_on_site_id_and_location", unique: true
    t.index ["site_id"], name: "index_menus_on_site_id"
  end

  create_table "newsletter_subscribers", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.bigint "site_id", null: false
    t.string "status", default: "pending", null: false
    t.datetime "updated_at", null: false
    t.index ["site_id", "email"], name: "index_newsletter_subscribers_on_site_id_and_email", unique: true
    t.index ["site_id"], name: "index_newsletter_subscribers_on_site_id"
  end

  create_table "options", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "key", null: false
    t.bigint "site_id", null: false
    t.datetime "updated_at", null: false
    t.jsonb "value", default: {}, null: false
    t.index ["site_id", "key"], name: "index_options_on_site_id_and_key", unique: true
    t.index ["site_id"], name: "index_options_on_site_id"
  end

  create_table "pages", force: :cascade do |t|
    t.bigint "author_id", null: false
    t.jsonb "content", default: [], null: false
    t.datetime "created_at", null: false
    t.jsonb "draft_content"
    t.boolean "hide_title", default: false, null: false
    t.string "live_render_mode", default: "native", null: false
    t.integer "menu_order", default: 0, null: false
    t.jsonb "meta", default: {}, null: false
    t.boolean "nofollow", default: false
    t.boolean "noindex", default: false
    t.text "og_description"
    t.string "og_image_url"
    t.string "og_title"
    t.text "original_import_html"
    t.string "original_import_url"
    t.bigint "parent_id"
    t.text "seo_description"
    t.string "seo_focus_keyword"
    t.string "seo_slug_override"
    t.string "seo_title"
    t.bigint "site_id", null: false
    t.string "slug", null: false
    t.string "status", default: "draft", null: false
    t.string "template", default: "default", null: false
    t.string "title", null: false
    t.string "twitter_card_type", default: "summary_large_image"
    t.datetime "updated_at", null: false
    t.index ["author_id"], name: "index_pages_on_author_id"
    t.index ["live_render_mode"], name: "index_pages_on_live_render_mode"
    t.index ["parent_id"], name: "index_pages_on_parent_id"
    t.index ["site_id", "slug"], name: "index_pages_on_site_id_and_slug", unique: true
    t.index ["site_id"], name: "index_pages_on_site_id"
  end

  create_table "post_revisions", force: :cascade do |t|
    t.jsonb "content_snapshot", default: [], null: false
    t.datetime "created_at", null: false
    t.bigint "post_id", null: false
    t.string "title_snapshot", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["post_id"], name: "index_post_revisions_on_post_id"
    t.index ["user_id"], name: "index_post_revisions_on_user_id"
  end

  create_table "post_terms", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "term_id", null: false
    t.bigint "termable_id", null: false
    t.string "termable_type", null: false
    t.datetime "updated_at", null: false
    t.index ["term_id", "termable_type", "termable_id"], name: "index_post_terms_uniqueness", unique: true
    t.index ["term_id"], name: "index_post_terms_on_term_id"
    t.index ["termable_type", "termable_id"], name: "index_post_terms_on_termable"
  end

  create_table "posts", force: :cascade do |t|
    t.bigint "author_id", null: false
    t.jsonb "content", default: [], null: false
    t.datetime "created_at", null: false
    t.jsonb "draft_content"
    t.text "excerpt"
    t.string "featured_image_alt"
    t.bigint "featured_image_id"
    t.jsonb "meta", default: {}, null: false
    t.boolean "nofollow", default: false
    t.boolean "noindex", default: false
    t.text "og_description"
    t.string "og_image_url"
    t.string "og_title"
    t.datetime "published_at"
    t.datetime "scheduled_for"
    t.text "seo_description"
    t.string "seo_focus_keyword"
    t.string "seo_slug_override"
    t.string "seo_title"
    t.bigint "site_id", null: false
    t.string "slug", null: false
    t.string "status", default: "draft", null: false
    t.string "title", null: false
    t.string "twitter_card_type", default: "summary_large_image"
    t.datetime "updated_at", null: false
    t.index ["author_id"], name: "index_posts_on_author_id"
    t.index ["content"], name: "index_posts_on_content", using: :gin
    t.index ["featured_image_id"], name: "index_posts_on_featured_image_id"
    t.index ["published_at"], name: "index_posts_on_published_at"
    t.index ["site_id", "slug"], name: "index_posts_on_site_id_and_slug", unique: true
    t.index ["site_id"], name: "index_posts_on_site_id"
    t.index ["status"], name: "index_posts_on_status"
  end

  create_table "roles", force: :cascade do |t|
    t.jsonb "capabilities", default: [], null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_roles_on_name", unique: true
  end

  create_table "sites", force: :cascade do |t|
    t.string "active_theme", default: "default", null: false
    t.datetime "created_at", null: false
    t.string "domain", null: false
    t.string "name", null: false
    t.datetime "updated_at", null: false
    t.index ["domain"], name: "index_sites_on_domain", unique: true
  end

  create_table "solid_queue_blocked_executions", force: :cascade do |t|
    t.string "concurrency_key", null: false
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.index ["concurrency_key", "priority", "job_id"], name: "index_solid_queue_blocked_executions_for_release"
    t.index ["expires_at", "concurrency_key"], name: "index_solid_queue_blocked_executions_for_maintenance"
    t.index ["job_id"], name: "index_solid_queue_blocked_executions_on_job_id", unique: true
  end

  create_table "solid_queue_claimed_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.bigint "process_id"
    t.index ["job_id"], name: "index_solid_queue_claimed_executions_on_job_id", unique: true
    t.index ["process_id", "job_id"], name: "index_solid_queue_claimed_executions_on_process_id_and_job_id"
  end

  create_table "solid_queue_failed_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "error"
    t.bigint "job_id", null: false
    t.index ["job_id"], name: "index_solid_queue_failed_executions_on_job_id", unique: true
  end

  create_table "solid_queue_jobs", force: :cascade do |t|
    t.string "active_job_id"
    t.text "arguments"
    t.string "class_name", null: false
    t.string "concurrency_key"
    t.datetime "created_at", null: false
    t.datetime "finished_at"
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.datetime "scheduled_at"
    t.datetime "updated_at", null: false
    t.index ["active_job_id"], name: "index_solid_queue_jobs_on_active_job_id"
    t.index ["class_name"], name: "index_solid_queue_jobs_on_class_name"
    t.index ["finished_at"], name: "index_solid_queue_jobs_on_finished_at"
    t.index ["queue_name", "finished_at"], name: "index_solid_queue_jobs_for_filtering"
    t.index ["scheduled_at", "finished_at"], name: "index_solid_queue_jobs_for_alerting"
  end

  create_table "solid_queue_pauses", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "queue_name", null: false
    t.index ["queue_name"], name: "index_solid_queue_pauses_on_queue_name", unique: true
  end

  create_table "solid_queue_processes", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "hostname"
    t.string "kind", null: false
    t.datetime "last_heartbeat_at", null: false
    t.text "metadata"
    t.string "name", null: false
    t.integer "pid", null: false
    t.bigint "supervisor_id"
    t.index ["last_heartbeat_at"], name: "index_solid_queue_processes_on_last_heartbeat_at"
    t.index ["name", "supervisor_id"], name: "index_solid_queue_processes_on_name_and_supervisor_id", unique: true
    t.index ["supervisor_id"], name: "index_solid_queue_processes_on_supervisor_id"
  end

  create_table "solid_queue_ready_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.index ["job_id"], name: "index_solid_queue_ready_executions_on_job_id", unique: true
    t.index ["priority", "job_id"], name: "index_solid_queue_poll_all"
    t.index ["queue_name", "priority", "job_id"], name: "index_solid_queue_poll_by_queue"
  end

  create_table "solid_queue_recurring_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.datetime "run_at", null: false
    t.string "task_key", null: false
    t.index ["job_id"], name: "index_solid_queue_recurring_executions_on_job_id", unique: true
    t.index ["task_key", "run_at"], name: "index_solid_queue_recurring_executions_on_task_key_and_run_at", unique: true
  end

  create_table "solid_queue_recurring_tasks", force: :cascade do |t|
    t.text "arguments"
    t.string "class_name"
    t.string "command", limit: 2048
    t.datetime "created_at", null: false
    t.text "description"
    t.string "key", null: false
    t.integer "priority", default: 0
    t.string "queue_name"
    t.string "schedule", null: false
    t.boolean "static", default: true, null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_solid_queue_recurring_tasks_on_key", unique: true
    t.index ["static"], name: "index_solid_queue_recurring_tasks_on_static"
  end

  create_table "solid_queue_scheduled_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.datetime "scheduled_at", null: false
    t.index ["job_id"], name: "index_solid_queue_scheduled_executions_on_job_id", unique: true
    t.index ["scheduled_at", "priority", "job_id"], name: "index_solid_queue_dispatch_all"
  end

  create_table "solid_queue_semaphores", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.string "key", null: false
    t.datetime "updated_at", null: false
    t.integer "value", default: 1, null: false
    t.index ["expires_at"], name: "index_solid_queue_semaphores_on_expires_at"
    t.index ["key", "value"], name: "index_solid_queue_semaphores_on_key_and_value"
    t.index ["key"], name: "index_solid_queue_semaphores_on_key", unique: true
  end

  create_table "terms", force: :cascade do |t|
    t.string "ancestry"
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.bigint "site_id", null: false
    t.string "slug", null: false
    t.string "taxonomy", null: false
    t.datetime "updated_at", null: false
    t.index ["ancestry"], name: "index_terms_on_ancestry"
    t.index ["site_id", "taxonomy", "slug"], name: "index_terms_on_site_id_and_taxonomy_and_slug", unique: true
    t.index ["site_id"], name: "index_terms_on_site_id"
  end

  create_table "themes", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.jsonb "customizer_settings", default: {}, null: false
    t.string "name", null: false
    t.string "slug", null: false
    t.datetime "updated_at", null: false
    t.index ["slug"], name: "index_themes_on_slug", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.string "bio"
    t.datetime "created_at", null: false
    t.datetime "current_sign_in_at"
    t.string "current_sign_in_ip"
    t.datetime "deactivated_at"
    t.string "email", null: false
    t.string "encrypted_password", default: "", null: false
    t.datetime "last_sign_in_at"
    t.string "last_sign_in_ip"
    t.string "name", null: false
    t.datetime "remember_created_at"
    t.datetime "reset_password_sent_at"
    t.string "reset_password_token"
    t.bigint "role_id", null: false
    t.integer "sign_in_count", default: 0, null: false
    t.bigint "site_id", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
    t.index ["role_id"], name: "index_users_on_role_id"
    t.index ["site_id"], name: "index_users_on_site_id"
  end

  create_table "website_imports", force: :cascade do |t|
    t.string "capture_id", null: false
    t.integer "captured_pages", default: 0, null: false
    t.datetime "created_at", null: false
    t.text "error_message"
    t.datetime "finished_at"
    t.jsonb "imported_page_ids", default: [], null: false
    t.integer "mapped_pages", default: 0, null: false
    t.integer "max_depth", default: 6, null: false
    t.integer "max_pages", default: 80, null: false
    t.boolean "ownership_confirmed", default: false, null: false
    t.jsonb "report", default: {}, null: false
    t.bigint "site_id", null: false
    t.string "source_url", null: false
    t.datetime "started_at"
    t.string "status", default: "queued", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["capture_id"], name: "index_website_imports_on_capture_id", unique: true
    t.index ["site_id", "created_at"], name: "index_website_imports_on_site_id_and_created_at"
    t.index ["site_id"], name: "index_website_imports_on_site_id"
    t.index ["status"], name: "index_website_imports_on_status"
    t.index ["user_id"], name: "index_website_imports_on_user_id"
  end

  create_table "widgets", force: :cascade do |t|
    t.string "area"
    t.jsonb "config"
    t.datetime "created_at", null: false
    t.string "kind"
    t.integer "position"
    t.bigint "site_id", null: false
    t.string "title"
    t.datetime "updated_at", null: false
    t.index ["site_id"], name: "index_widgets_on_site_id"
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "comments", "posts"
  add_foreign_key "comments", "users"
  add_foreign_key "contact_form_messages", "sites"
  add_foreign_key "media_items", "sites"
  add_foreign_key "media_items", "users", column: "uploaded_by_id"
  add_foreign_key "menu_items", "menu_items", column: "parent_id"
  add_foreign_key "menu_items", "menus"
  add_foreign_key "menus", "sites"
  add_foreign_key "newsletter_subscribers", "sites"
  add_foreign_key "options", "sites"
  add_foreign_key "pages", "pages", column: "parent_id"
  add_foreign_key "pages", "sites"
  add_foreign_key "pages", "users", column: "author_id"
  add_foreign_key "post_revisions", "posts"
  add_foreign_key "post_revisions", "users"
  add_foreign_key "post_terms", "terms"
  add_foreign_key "posts", "sites"
  add_foreign_key "posts", "users", column: "author_id"
  add_foreign_key "solid_queue_blocked_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_claimed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_failed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_ready_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_recurring_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_scheduled_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "terms", "sites"
  add_foreign_key "users", "roles"
  add_foreign_key "users", "sites"
  add_foreign_key "website_imports", "sites"
  add_foreign_key "website_imports", "users"
  add_foreign_key "widgets", "sites"
end
