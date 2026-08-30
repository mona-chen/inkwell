class WebsiteImport < ApplicationRecord
  STATUSES = %w[queued capturing mapping ready importing imported failed].freeze

  belongs_to :site
  belongs_to :user

  validates :source_url, :capture_id, presence: true
  validates :capture_id, uniqueness: true, format: { with: /\A[a-z0-9][a-z0-9_-]*\z/i }
  validates :status, inclusion: { in: STATUSES }
  validates :max_depth, numericality: { only_integer: true, in: 0..12 }
  validates :max_pages, numericality: { only_integer: true, in: 1..250 }
  validates :ownership_confirmed, acceptance: true
  validate :source_must_be_http

  before_validation :normalize_source_url
  before_validation :assign_capture_id, on: :create

  scope :recent, -> { order(created_at: :desc) }

  def active?
    %w[queued capturing mapping importing].include?(status)
  end

  def ready?
    status == "ready"
  end

  def progress
    { "queued" => 5, "capturing" => 35, "mapping" => 75, "ready" => 100, "importing" => 90, "imported" => 100, "failed" => 100 }.fetch(status, 0)
  end

  def capture_directory
    Rails.root.join("tmp", "site-captures", capture_id)
  end

  def begin_capture!
    update!(status: "capturing", started_at: Time.current, finished_at: nil, error_message: nil)
  end

  def begin_mapping!
    update!(status: "mapping")
  end

  def mark_ready!(payload)
    update!(
      status: "ready",
      captured_pages: payload.dig("importReport", "capturedPages").to_i,
      mapped_pages: payload.fetch("pages", []).size,
      report: payload.fetch("importReport", {}),
      finished_at: Time.current
    )
  end

  def mark_failed!(message)
    update!(status: "failed", error_message: message.to_s.truncate(8_000), finished_at: Time.current)
  end

  private

  def normalize_source_url
    value = source_url.to_s.strip
    value = "https://#{value}" unless value.blank? || value.match?(/\Ahttps?:\/\//i)
    self.source_url = value
  end

  def assign_capture_id
    self.capture_id ||= "site-#{SecureRandom.hex(8)}"
  end

  def source_must_be_http
    uri = URI.parse(source_url.to_s)
    errors.add(:source_url, "must be a valid HTTP or HTTPS URL") unless uri.is_a?(URI::HTTP) && uri.host.present?
  rescue URI::InvalidURIError
    errors.add(:source_url, "must be a valid HTTP or HTTPS URL")
  end
end
