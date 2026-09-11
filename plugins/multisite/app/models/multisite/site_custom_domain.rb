module Multisite
  class SiteCustomDomain < ApplicationRecord
    self.table_name = "site_custom_domains"

    belongs_to :site

    STATUSES = %w[
      setup_required
      checking_dns
      dns_incorrect
      verifying
      ssl_provisioning
      active
      error
    ].freeze

    validates :domain, presence: true, uniqueness: true
    validates :status, inclusion: { in: STATUSES }
    validate :domain_format

    scope :active, -> { where(status: "active") }
    scope :pending, -> { where(status: %w[setup_required checking_dns dns_incorrect verifying ssl_provisioning]) }

    def check_dns!(server_ip:)
      dns_records = Resolv::DNS.new.getresources(domain, Resolv::DNS::Resource::IN::A)
      resolved_ips = dns_records.map(&:address).map(&:to_s)

      if resolved_ips.include?(server_ip)
        update!(status: "verifying", last_checked_at: Time.current)
        { matched: true, expected: server_ip, found: resolved_ips }
      else
        update!(status: "dns_incorrect", last_checked_at: Time.current)
        { matched: false, expected: server_ip, found: resolved_ips }
      end
    rescue Resolv::ResolvError
      update!(status: "setup_required", last_checked_at: Time.current)
      { matched: false, expected: server_ip, found: [] }
    end

    def verify!
      update!(status: "active", verified_at: Time.current)
    end

    def fail_verification!(reason: nil)
      update!(status: "error", error_message: reason)
    end

    private

    def domain_format
      return if domain.blank?
      unless domain.match?(/\A[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}\z/i)
        errors.add(:domain, "must be a valid domain (e.g. example.com)")
      end
    end
  end
end
