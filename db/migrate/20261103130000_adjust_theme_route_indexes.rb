class AdjustThemeRouteIndexes < ActiveRecord::Migration[8.1]
  def up
    if index_exists?(:theme_routes, [ :site_id, :path ], unique: true)
      remove_index :theme_routes, [ :site_id, :path ], unique: true
    end
    add_index :theme_routes, [ :site_id, :path ], if_not_exists: true
    add_index :theme_routes, [ :site_id, :theme_release_id, :path ], unique: true, name: "index_theme_routes_release_path", if_not_exists: true
  end

  def down
    # The create migration also installs these indexes on fresh databases.
  end
end
