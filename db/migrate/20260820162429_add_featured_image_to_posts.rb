class AddFeaturedImageToPosts < ActiveRecord::Migration[8.1]
  def change
    add_column :posts, :featured_image_id, :bigint
    add_index :posts, :featured_image_id
  end
end
