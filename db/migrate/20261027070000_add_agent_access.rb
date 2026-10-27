class AddAgentAccess < ActiveRecord::Migration[8.1]
  def change
    create_table :agent_credentials do |t|
      t.references :site, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.string :name, null: false
      t.string :token_digest, null: false
      t.string :token_prefix, null: false
      t.jsonb :scopes, null: false, default: []
      t.datetime :expires_at, null: false
      t.datetime :revoked_at
      t.datetime :last_used_at
      t.timestamps
    end
    add_index :agent_credentials, :token_digest, unique: true
    create_table :agent_activities do |t|
      t.references :site, null: false, foreign_key: true
      t.references :agent_credential, null: true, foreign_key: { on_delete: :nullify }
      t.string :tool, null: false
      t.string :status, null: false
      t.string :arguments_digest
      t.string :error_code
      t.jsonb :before_state, null: false, default: {}
      t.jsonb :after_state, null: false, default: {}
      t.timestamps
    end
    create_table :live_plugins do |t|
      t.references :site, null: false, foreign_key: true
      t.string :slug, null: false
      t.bigint :active_release_id
      t.jsonb :settings, null: false, default: {}
      t.timestamps
    end
    add_index :live_plugins, [:site_id, :slug], unique: true
    create_table :live_plugin_releases do |t|
      t.references :live_plugin, null: false, foreign_key: true
      t.jsonb :manifest, null: false, default: {}
      t.string :digest, null: false
      t.timestamps
    end
    add_foreign_key :live_plugins, :live_plugin_releases, column: :active_release_id
  end
end
