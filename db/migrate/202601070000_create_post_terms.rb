class CreatePostTerms < ActiveRecord::Migration[7.1]
  def change
    # Polymorphic join so both Post and Page (and future plugin-defined content types) can
    # carry terms without a join table per content type.
    create_table :post_terms do |t|
      t.references :term, null: false, foreign_key: true
      t.references :termable, polymorphic: true, null: false
      t.timestamps
    end
    add_index :post_terms, [:term_id, :termable_type, :termable_id], unique: true, name: "index_post_terms_uniqueness"
  end
end
