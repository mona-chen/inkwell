class AddThemeActivationBase < ActiveRecord::Migration[8.1]
  def change
    add_column :theme_repository_sources, :activation_base_slug, :string
  end
end
