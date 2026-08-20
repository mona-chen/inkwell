class Comment < ApplicationRecord
  has_ancestry # nested replies

  belongs_to :post
  belongs_to :user, optional: true

  validates :body, presence: true
  validates :guest_name, :guest_email, presence: true, unless: :user_id?

  scope :approved, -> { where(status: "approved") }
  scope :pending, -> { where(status: "pending") }

  after_create :queue_spam_check

  def author_name
    user&.name || guest_name
  end

  private

  def queue_spam_check
    SpamCheckJob.perform_later(id)
  end
end
