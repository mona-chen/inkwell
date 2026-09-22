module ImageSources
  # One image source. A subclass declares who it is and what it can do; the seam handles the
  # rest (fetching, filing, crediting). The declarations matter because providers disagree:
  #
  #   provider "openverse"          the key an operator enables/disables
  #   kind "photo"                  what the result IS (the Copilot searches by kind)
  #   may_hotlink false             this provider's images may be re-hosted (true = must not)
  #   attribution_required false    a visible credit is part of the licence
  #   default_license "CC0 1.0"     used when a result does not name its own
  #
  # `available?` is the configuration gate. A provider that needs a key is simply not a
  # capability until the key exists, which is the same rule that keeps generate_image out of
  # the model's tool list until an image model is named.
  class Adapter
    class Error < StandardError; end

    # One search hit, normalized. `download_url` is what we fetch and file; `page_url` is where
    # a human can go to see the original and its terms.
    Result = Struct.new(:title, :download_url, :fallback_url, :page_url, :creator, :creator_url,
                        :license, :license_url, keyword_init: true)

    attr_reader :site, :options

    def initialize(site:, **options)
      @site = site
      @options = options
    end

    def provider = self.class.provider
    def kind = self.class.kind
    def label = self.class.label
    def homepage = self.class.homepage
    def default_license = self.class.default_license
    def may_hotlink? = self.class.may_hotlink?
    def attribution_required? = self.class.attribution_required?

    # Overridden by keyed providers.
    def available? = true

    def search(query:, limit:)
      raise NotImplementedError, "#{self.class} must implement #search"
    end

    class << self
      def provider(value = nil) = value.nil? ? @provider : (@provider = value)
      def kind(value = nil) = value.nil? ? @kind : (@kind = value)
      def label(value = nil) = value.nil? ? @label : (@label = value)
      def homepage(value = nil) = value.nil? ? @homepage : (@homepage = value)
      def default_license(value = nil) = value.nil? ? @default_license : (@default_license = value)
      def may_hotlink(value = nil) = value.nil? ? !!@may_hotlink : (@may_hotlink = value)
      def attribution_required(value = nil) = value.nil? ? !!@attribution_required : (@attribution_required = value)
    end
  end
end
