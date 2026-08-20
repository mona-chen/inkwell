class CreateTerms < ActiveRecord::Migration[7.1]
  def change
    # Unifies WP's categories + tags into one polymorphic-by-taxonomy table (ancestry
    # gives free nesting for categories; tags simply never get children).
    create_table :terms do |t|
      t.references :site, null: false, foreign_key: true
      t.string :taxonomy, null: false # "category" | "tag" | plugin-registered custom taxonomies
      t.string :name, null: false
      t.string :slug, null: false
      t.string :ancestry # nested set via the `ancestry` gem, categories only
      t.timestamps
    end
    add_index :terms, [:site_id, :taxonomy, :slug], unique: true
    add_index :terms, :ancestry
  end
end
