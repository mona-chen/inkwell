class CreateBuilderWorkspaces < ActiveRecord::Migration[8.1]
  def change
    create_table :builder_workspaces do |t|
      t.references :site, null: false, foreign_key: true
      t.string :record_type, null: false
      t.bigint :record_id, null: false
      t.bigint :revision, null: false, default: 0
      t.jsonb :document, null: false, default: {}
      t.jsonb :participants, null: false, default: {}
      t.jsonb :threads, null: false, default: []
      t.timestamps
    end
    add_index :builder_workspaces, [:site_id, :record_type, :record_id], unique: true, name: 'index_builder_workspaces_on_record'
  end
end
