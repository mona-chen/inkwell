class CreateWidgets < ActiveRecord::Migration[8.1]
  def change
    create_table :widgets do |t|
      t.references :site, null: false, foreign_key: true
      t.string :kind
      t.string :area
      t.string :title
      t.integer :position
      t.jsonb :config

      t.timestamps
    end
  end
end
