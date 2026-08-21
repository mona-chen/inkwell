class User < ApplicationRecord
  devise :database_authenticatable, :recoverable, :rememberable, :trackable, :validatable

  belongs_to :site
  belongs_to :role
  has_many :posts, foreign_key: :author_id, dependent: :nullify
  has_many :pages, foreign_key: :author_id, dependent: :nullify
  has_many :comments, dependent: :nullify

  validates :name, presence: true

  scope :active, -> { where(deactivated_at: nil) }

  # Deactivated accounts can't sign in or receive reset instructions.
  def active_for_authentication?
    super && deactivated_at.nil?
  end

  def inactive_message
    deactivated_at ? :deactivated : super
  end

  def deactivated?
    deactivated_at.present?
  end

  def deactivate!
    update_column(:deactivated_at, Time.current)
  end

  def reactivate!
    update_column(:deactivated_at, nil)
  end

  # Author pages use name-parameterized URLs (/authors/maya-okafor).
  def to_param
    name.to_s.parameterize
  end

  delegate :can?, to: :role

  def admin?
    role.name == "admin"
  end
end
