class CreateThemes < ActiveRecord::Migration[7.1]
  def change
    # Themes are discovered from disk (app/themes/*), this table just tracks metadata +
    # per-theme customizer values (colors, logo) so switching themes doesn't lose settings.
    create_table :themes do |t|
      t.string :slug, null: false
      t.string :name, null: false
      t.jsonb :customizer_settings, null: false, default: {}
      t.timestamps
    end
    add_index :themes, :slug, unique: true
  end
end
