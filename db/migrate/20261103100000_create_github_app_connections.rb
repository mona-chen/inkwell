class CreateGithubAppConnections < ActiveRecord::Migration[8.1]
  def change
    create_table :github_app_connections do |t|
      t.references :site, null: false, foreign_key: true, index: { unique: true }
      t.references :user, null: false, foreign_key: true
      t.bigint :app_id, null: false
      t.string :slug, null: false
      t.string :client_id, null: false
      t.text :credentials_ciphertext, null: false
      t.string :public_url, null: false
      t.bigint :installation_id
      t.string :account_login
      t.jsonb :repositories, null: false, default: []
      t.datetime :synced_at
      t.timestamps
    end
    add_index :github_app_connections, :app_id, unique: true
    add_reference :theme_repository_sources, :github_app_connection, foreign_key: true
  end
end
