class CreateRoles < ActiveRecord::Migration[7.1]
  def change
    # WordPress ships 5 fixed roles with capability strings scattered across code.
    # Here capabilities are an explicit jsonb array on the role itself — introspectable,
    # editable by a super-admin without a redeploy, and pundit policies read from it.
    create_table :roles do |t|
      t.string :name, null: false          # "admin", "editor", "author", "contributor", "subscriber"
      t.jsonb :capabilities, null: false, default: []
      t.timestamps
    end
    add_index :roles, :name, unique: true
  end
end
