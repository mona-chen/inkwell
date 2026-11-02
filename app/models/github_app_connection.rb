class GithubAppConnection < ApplicationRecord
  belongs_to :site
  belongs_to :user
  has_many :theme_repository_sources
  validates :slug, format: { with: /\A[a-z0-9][a-z0-9-]*\z/ }
  validates :site_id, :app_id, uniqueness: true
  validates :app_id, numericality: { only_integer: true, greater_than: 0 }
  validates :client_id, :credentials_ciphertext, :public_url, presence: true

  def app_credentials=(value)
    self.credentials_ciphertext = self.class.encryptor.encrypt_and_sign(value.stringify_keys.to_json)
  end

  def app_credentials
    JSON.parse(self.class.encryptor.decrypt_and_verify(credentials_ciphertext))
  end

  def self.encryptor
    key = Rails.application.key_generator.generate_key("inkwell-github-app-v1", 32)
    ActiveSupport::MessageEncryptor.new(key, cipher: "aes-256-gcm")
  end

  def connected? = installation_id.present?
  def authorized? = user.admin? && !user.deactivated?

  def disconnect!
    with_lock do
      update!(installation_id: nil, account_login: nil, repositories: [], synced_at: nil)
      theme_repository_sources.update_all(auto_update: false, auto_activate: false, updated_at: Time.current)
    end
  end
end
