class User < ApplicationRecord
  devise :database_authenticatable, :recoverable, :rememberable, :trackable, :validatable

  belongs_to :site
  belongs_to :role
  has_many :posts, foreign_key: :author_id, dependent: :nullify
  has_many :pages, foreign_key: :author_id, dependent: :nullify
  has_many :comments, dependent: :nullify

  validates :name, presence: true

  delegate :can?, to: :role

  def admin?
    role.name == "admin"
  end
end
