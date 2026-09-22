module ImageSources
  # The adapters this site can actually use, in the order their results are merged.
  #
  # Definitions are rebuilt per call rather than frozen into a constant so a development reload
  # can never leave a stale adapter class behind.
  module Registry
    class << self
      def definitions
        [
          [ Adapters::Openverse, {} ],
          [ Adapters::SimpleIcons, {} ],
          [ Adapters::DiceBear, { kind: "avatar" } ],
          [ Adapters::DiceBear, { kind: "mascot" } ],
          [ Adapters::Microlink, {} ]
        ]
      end

      # Request-scoped options (a logo colour, say) ride along to every adapter; the definition's
      # own options win, so a caller can never re-point an adapter at another kind.
      def adapters(site, **adapter_options)
        definitions.map { |(klass, options)| klass.new(site: site, **adapter_options.merge(options)) }
      end

      # Enabled by the operator AND configured. An enabled-but-unconfigured provider is not a
      # capability, so it is never offered.
      def enabled(site, **adapter_options)
        adapters(site, **adapter_options).select { |adapter| Settings.provider_enabled?(site, adapter.provider) && adapter.available? }
      end

      def for_kind(site, kind, **adapter_options)
        enabled(site, **adapter_options).select { |adapter| adapter.kind == kind.to_s }
      end
    end
  end
end
