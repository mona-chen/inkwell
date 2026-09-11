class CreateWebhookDeliveries < ActiveRecord::Migration[8.1]
  def change
    create_table :webhook_deliveries do |t|
      t.references :webhook_endpoint, null: false, foreign_key: true
      t.string :event, null: false
      t.jsonb :payload, null: false, default: {}
      t.integer :response_code
      t.integer :attempts, null: false, default: 0
      t.datetime :delivered_at
      t.text :error

      t.timestamps
    end

    add_index :webhook_deliveries, [ :webhook_endpoint_id, :created_at ]
  end
end
