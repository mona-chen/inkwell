class WebsiteImport < ApplicationRecord
  STATUSES = %w[queued capturing mapping ready importing imported failed].freeze
  # Sibling origins an import may also crawl (a CMS domain, a blog subdomain).
  MAX_ORIGINS = 10

  belongs_to :site
  belongs_to :user

  validates :source_url, :capture_id, presence: true
  validates :capture_id, uniqueness: true, format: { with: /\A[a-z0-9][a-z0-9_-]*\z/i }
  validates :status, inclusion: { in: STATUSES }
  validates :max_depth, numericality: { only_integer: true, in: 0..12 }
  validates :max_pages, numericality: { only_integer: true, in: 1..250 }
  validate :ownership_must_be_confirmed
  validate :source_must_be_http
  validate :origins_must_be_http

  before_validation :normalize_source_url
  before_validation :assign_capture_id, on: :create

  scope :recent, -> { order(created_at: :desc) }

  def additional_origins
    Array(allowed_origins).join("\n")
  end

  def additional_origins=(value)
    self.allowed_origins = value.to_s.split(/[\s,]+/).reject(&:blank?).map { |origin| origin.delete_suffix("/") }.uniq
  end

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

  def origins_must_be_http
    origins = Array(allowed_origins)
    errors.add(:additional_origins, "allows at most #{MAX_ORIGINS} origins") if origins.size > MAX_ORIGINS
    origins.each do |origin|
      uri = URI.parse(origin.to_s)
      unless uri.is_a?(URI::HTTP) && uri.host.present? && uri.userinfo.nil? && uri.query.nil? && uri.fragment.nil? && [ "", "/" ].include?(uri.path)
        errors.add(:additional_origins, "must contain origins such as https://your-site.framer.ai, without paths")
      end
    rescue URI::InvalidURIError
      errors.add(:additional_origins, "contains an invalid URL")
    end
  end

  def ownership_must_be_confirmed
    errors.add(:ownership_confirmed, "must be accepted") unless [ true, "1" ].include?(ownership_confirmed)
  end
end
