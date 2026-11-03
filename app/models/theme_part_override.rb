class ThemePartOverride < ApplicationRecord
  belongs_to :site
  has_many :revisions, -> { order(revision_number: :desc) }, class_name: "ThemePartRevision", dependent: :destroy

  validates :theme_release_id, :part_key, presence: true
  validates :part_key, uniqueness: { scope: [ :site_id, :theme_release_id ] }

  before_update :capture_revision, if: :will_save_change_to_body?
  after_update :bump_revision, if: :saved_change_to_body?

  def restore!(revision_record)
    update!(body: revision_record.body)
  end

  private

  def capture_revision
    revisions.create!(revision_number: revisions.maximum(:revision_number).to_i + 1, body: body_in_database)
  end

  def bump_revision
    update_column(:revision, revision + 1)
  end
end
