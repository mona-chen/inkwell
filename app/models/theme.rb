class Theme < ApplicationRecord
  validates :slug, :name, presence: true, uniqueness: true

  # Reads every folder in app/themes/ — the manifest (theme.json) is the source of truth for
  # display name/description; the DB row only persists customizer values across activation.
  def self.discover
    Dir.glob(Rails.root.join("app/themes/*")).map do |path|
      manifest = JSON.parse(File.read(File.join(path, "theme.json")))
      { slug: File.basename(path), **manifest.slice("name", "description", "author", "version") }
    end
  end
end
