class ThemeRepositorySource < ApplicationRecord
  belongs_to :site
  belongs_to :user
  belongs_to :github_app_connection, optional: true
  validate do
    errors.add(:github_app_connection, "must belong to this site") if github_app_connection && github_app_connection.site_id != site_id
  end
  validates :repository, format: { with: /\A[a-zA-Z0-9][a-zA-Z0-9_.-]*\/[a-zA-Z0-9][a-zA-Z0-9_.-]*\z/ }
  validates :branch, presence: true, length: { maximum: 200 }, format: { with: /\A[a-zA-Z0-9][a-zA-Z0-9_.\/-]*\z/ }
  before_create { self.activation_base_slug ||= site.active_theme }
  before_validation do
    self.repository = repository.to_s.strip.delete_prefix("https://github.com/").delete_suffix("/").delete_suffix(".git")
    self.branch = branch.to_s.strip.presence || "main"
  end
end
