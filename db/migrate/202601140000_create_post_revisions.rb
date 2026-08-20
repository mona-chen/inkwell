class CreatePostRevisions < ActiveRecord::Migration[7.1]
  def change
    create_table :post_revisions do |t|
      t.references :post, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.jsonb :content_snapshot, null: false, default: []
      t.string :title_snapshot, null: false
      t.timestamps
    end
  end
end
