class CreateThemeRoutes < ActiveRecord::Migration[8.1]
  def up
    create_table :theme_routes do |t|
      t.references :site, null: false, foreign_key: true
      t.string :theme_release_id, null: false
      t.string :path, null: false
      t.string :route_key, null: false
      t.string :title_override
      t.string :seo_title
      t.text :meta_description
      t.string :canonical_url
      t.references :social_image, foreign_key: { to_table: :media_items }
      t.string :robots, null: false, default: "index, follow"
      t.jsonb :schema_json, null: false, default: {}
      t.string :status, null: false, default: "published"
      t.jsonb :draft_data, null: false, default: {}
      t.datetime :published_at
      t.string :navigation_location
      t.string :navigation_label
      t.integer :navigation_position, null: false, default: 0
      t.boolean :sitemap, null: false, default: true
      t.integer :revision, null: false, default: 0
      t.timestamps
    end
    add_index :theme_routes, [ :site_id, :path ]
    add_index :theme_routes, [ :site_id, :theme_release_id, :route_key ]
    add_index :theme_routes, [ :site_id, :theme_release_id, :path ], unique: true, name: "index_theme_routes_release_path"
    add_index :theme_routes, [ :site_id, :status ]

    create_table :theme_route_revisions do |t|
      t.references :theme_route, null: false, foreign_key: true
      t.integer :revision_number, null: false
      t.jsonb :snapshot, null: false, default: {}
      t.references :user, foreign_key: true
      t.datetime :created_at, null: false
    end
    add_index :theme_route_revisions, [ :theme_route_id, :revision_number ], unique: true

    create_table :theme_region_overrides do |t|
      t.references :site, null: false, foreign_key: true
      t.string :theme_release_id, null: false
      t.string :region_key, null: false
      t.jsonb :data, null: false, default: {}
      t.integer :revision, null: false, default: 0
      t.timestamps
    end
    add_index :theme_region_overrides, [ :site_id, :theme_release_id, :region_key ], unique: true, name: "index_theme_region_overrides_unique"

    create_table :theme_part_overrides do |t|
      t.references :site, null: false, foreign_key: true
      t.string :theme_release_id, null: false
      t.string :part_key, null: false
      t.text :body, null: false, default: ""
      t.integer :revision, null: false, default: 0
      t.timestamps
    end
    add_index :theme_part_overrides, [ :site_id, :theme_release_id, :part_key ], unique: true, name: "index_theme_part_overrides_unique"

    create_table :theme_part_revisions do |t|
      t.references :theme_part_override, null: false, foreign_key: true
      t.integer :revision_number, null: false
      t.text :body
      t.datetime :created_at, null: false
    end
    add_index :theme_part_revisions, [ :theme_part_override_id, :revision_number ], unique: true, name: "index_theme_part_revisions_unique"

    backfill_routes
  end

  def down
    drop_table :theme_part_revisions
    drop_table :theme_part_overrides
    drop_table :theme_region_overrides
    drop_table :theme_route_revisions
    drop_table :theme_routes
  end

  private

  def backfill_routes
    return unless table_exists?(:sites)

    Site.find_each do |site|
      manifest_path = Rails.root.join("app/themes", site.active_theme, "theme.json")
      next unless manifest_path.file?

      manifest = JSON.parse(manifest_path.read)
      next unless manifest["format"] == "inkwell-theme-v1"

      Array(manifest["routes"]).each do |path, target|
        next unless path.is_a?(String) && target.is_a?(String)

        ThemeRoute.find_or_initialize_by(site: site, path: path).tap do |route|
          route.theme_release_id = site.active_theme
          route.route_key = route_key_for(path, manifest)
          route.status = "published"
          route.published_at = Time.current
          route.sitemap = true
          route.save!
        end
      end
    end
  rescue JSON::ParserError
    nil
  end

  def route_key_for(path, manifest)
    templates = manifest.dig("inkwell", "templates") || {}
    key = templates.find { |_name, value| value == path }&.first
    key ||= case path
    when "/" then "home"
    when "/blog" then "blog_index"
    when "/blog/:slug" then "blog_post"
    when "/authors/:slug" then "author"
    else path.delete_prefix("/").gsub(/[^a-z0-9]+/, "_").presence || "home"
    end
    result = key.to_s.gsub(/[^a-z0-9_]+/, "_").gsub(/\A_+|_+\z/, "")
    result = "not_found" if result == "404"
    result = "route_#{result}" unless result.match?(/\A[a-z]/)
    result.presence || "route"
  end
end
