require "open3"
require "resolv"
require "ipaddr"

class WebsiteImportJob < ApplicationJob
  queue_as :default

  PRIVATE_NETWORKS = %w[
    0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16
    172.16.0.0/12 192.0.0.0/24 192.0.2.0/24 192.168.0.0/16 198.18.0.0/15
    198.51.100.0/24 203.0.113.0/24 224.0.0.0/4 240.0.0.0/4
    ::/128 ::1/128 fc00::/7 fe80::/10 ff00::/8
  ].map { |cidr| IPAddr.new(cidr) }.freeze

  def perform(website_import_id)
    website_import = WebsiteImport.find(website_import_id)
    assert_public_destination!(website_import.source_url)
    website_import.allowed_origins.each { |origin| assert_public_destination!(origin) }
    FileUtils.mkdir_p(website_import.capture_directory.parent)

    website_import.begin_capture!
    capture!(website_import)

    # A site often publishes its articles on a sibling origin — a CMS domain, a blog subdomain.
    # The first pass only records those origins, because the crawler must never visit a host this
    # import was not authorized for. Adopt the public ones and capture once more, so the linked
    # posts become pages instead of a reported gap.
    capture!(website_import) if adopt_discovered_origins(website_import).any?

    website_import.begin_mapping!
    run!("npm", "run", "map-site", "--", website_import.capture_directory.to_s)
    payload = JSON.parse(website_import.capture_directory.join("site-builder-payload.json").read)
    website_import.mark_ready!(payload)
  rescue StandardError => error
    website_import&.mark_failed!(error.message)
  end

  private

  def capture!(website_import)
    run!(
      "npm", "run", "capture-site", "--", website_import.source_url,
      "--confirm-ownership", "--depth", website_import.max_depth.to_s,
      "--max-pages", website_import.max_pages.to_s,
      "--output", website_import.capture_directory.to_s,
      *website_import.allowed_origins.flat_map { |origin| [ "--include-origin", origin ] }
    )
  end

  # Origins the site links to for its articles that this capture was not authorized to follow.
  # Only public, bare origins are adopted, and never past the model's own limit, so a page cannot
  # turn the crawl into an SSRF probe or a wide net. The adopted set is persisted, so a re-run and
  # the import report both show exactly which hosts were captured.
  def adopt_discovered_origins(website_import)
    manifest_path = website_import.capture_directory.join("manifest.json")
    return [] unless manifest_path.exist?

    discovered = Array(JSON.parse(manifest_path.read)["externalOrigins"]).filter_map do |entry|
      origin = entry.is_a?(Hash) ? entry["origin"].to_s : ""
      next if origin.blank? || website_import.allowed_origins.include?(origin) || !public_origin?(origin)
      origin
    end.uniq
    return [] if discovered.empty?

    adopted = discovered.first([ WebsiteImport::MAX_ORIGINS - website_import.allowed_origins.size, 0 ].max)
    return [] if adopted.empty?

    website_import.update!(allowed_origins: website_import.allowed_origins + adopted)
    adopted
  rescue JSON::ParserError
    []
  end

  def public_origin?(origin)
    assert_public_destination!(origin)
    true
  rescue StandardError
    false
  end

  def run!(*command)
    stdout, stderr, status = Open3.capture3(*command, chdir: builder_root.to_s)
    return stdout if status.success?

    raise "#{stderr.presence || stdout.presence || 'Website import command failed'}"
  end

  def builder_root
    Rails.root.join("plugins", "page_builder", "app", "builder")
  end

  def assert_public_destination!(source_url)
    uri = URI.parse(source_url)
    addresses = Resolv.getaddresses(uri.host)
    raise "The website hostname could not be resolved." if addresses.empty?
    raise "Private, local, and reserved network addresses cannot be imported." if addresses.any? { |address| private_address?(address) }
  end

  def private_address?(address)
    ip = IPAddr.new(address)
    PRIVATE_NETWORKS.any? { |network| network.include?(ip) }
  end
end
