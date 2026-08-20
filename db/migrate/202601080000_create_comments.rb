class CreateComments < ActiveRecord::Migration[7.1]
  def change
    create_table :comments do |t|
      t.references :post, null: false, foreign_key: true
      t.references :user, foreign_key: true # nullable: guest comments allowed like WP
      t.string :guest_name
      t.string :guest_email
      t.text :body, null: false
      t.string :ancestry # nested replies via closure_tree/ancestry
      t.string :status, null: false, default: "pending" # pending | approved | spam | trashed
      t.timestamps
    end
    add_index :comments, :status
    add_index :comments, :ancestry
  end
end
