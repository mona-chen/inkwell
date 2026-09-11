module Multisite
  # Platform-level multisite policy. Stored on the platform (default) Site's options via the
  # core `Site#setting` API, but owned and named by the plugin so core Inkwell never has to
  # know about "site creation modes".
  #
  #   "open"        — anyone can create a site from /signup
  #   "invite_only" — self-serve site creation disabled
  #   "closed"      — self-serve site creation disabled
  #
  # Network admins can always create sites from Network Admin → Sites.
  module Settings
    MODES = %w[open invite_only closed].freeze
    SITE_CREATION_KEY = "site_creation_mode"

    class << self
      def site_creation_mode
        platform&.setting(SITE_CREATION_KEY) || "open"
      end

      def site_creation_mode=(mode)
        raise ArgumentError, "invalid site creation mode: #{mode.inspect}" unless MODES.include?(mode.to_s)

        platform&.set_setting!(SITE_CREATION_KEY, mode.to_s)
      end

      def site_creation_open?
        site_creation_mode == "open"
      end

      # The platform/default site is where network-level policy is stored.
      def platform
        Site.find_by(is_default: true) || Site.first
      end
    end
  end
end
