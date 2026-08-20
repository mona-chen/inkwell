class CreateNewsletterSubscribers < ActiveRecord::Migration[7.1]
  def change
    create_table :newsletter_subscribers do |t|
      t.references :site, null: false, foreign_key: true
      t.string :email, null: false
      t.string :status, null: false, default: "pending" # pending | confirmed | unsubscribed
      t.timestamps
    end
    add_index :newsletter_subscribers, [:site_id, :email], unique: true
  end
end
