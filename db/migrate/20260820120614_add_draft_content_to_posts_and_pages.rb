class AddDraftContentToPostsAndPages < ActiveRecord::Migration[8.1]
  def change
    add_column :posts, :draft_content, :jsonb
    add_column :pages, :draft_content, :jsonb
  end
end
