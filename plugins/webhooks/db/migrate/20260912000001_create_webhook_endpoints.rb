class CreateWebhookEndpoints < ActiveRecord::Migration[8.1]
  def change
    create_table :webhook_endpoints do |t|
      t.references :site, null: false, foreign_key: true
      t.string :name, null: false
      t.string :url, null: false
      t.string :secret, null: false
      t.jsonb :events, null: false, default: []
      t.boolean :active, null: false, default: true

      t.timestamps
    end
  end
end
