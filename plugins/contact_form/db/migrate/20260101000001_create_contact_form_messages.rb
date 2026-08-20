class CreateContactFormMessages < ActiveRecord::Migration[7.1]
  def change
    # A plugin's own table, in the plugin's own db/migrate — Rails' engine machinery picks
    # this up automatically for `rails db:migrate` because the engine is a real Rails::Engine.
    # Uninstalling the plugin later is a `drop_table` migration the plugin ships, not
    # archaeology through a shared core schema.
    create_table :contact_form_messages do |t|
      t.references :site, null: false, foreign_key: true
      t.string :name, null: false
      t.string :email, null: false
      t.text :body, null: false
      t.boolean :read, null: false, default: false
      t.timestamps
    end
  end
end
