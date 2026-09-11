class CreateSiteInvitations < ActiveRecord::Migration[8.1]
  def change
    create_table :site_invitations do |t|
      t.references :site, null: false, foreign_key: true
      t.string :email, null: false
      t.string :role, default: "editor", null: false
      t.string :token, null: false
      t.datetime :accepted_at
      t.datetime :expires_at, null: false
      t.timestamps
    end

    add_index :site_invitations, :token, unique: true
    add_index :site_invitations, [ :site_id, :email ], unique: true
  end
end
