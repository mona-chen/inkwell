module Inkwell
  # Inkwell::Hooks is the WordPress `do_action` / `apply_filters` system, rebuilt as
  # typed, instance-based pub/sub instead of global string-keyed functions.
  #
  #   Actions  — "something happened, react to it." No return value is used.
  #     Inkwell::Hooks.on_action(:post_published) { |post| PingSearchEngineJob.perform_later(post.id) }
  #     Inkwell::Hooks.fire(:post_published, post)
  #
  #   Filters  — "transform this value, pass it down the pipeline."
  #     Inkwell::Hooks.on_filter(:post_content) { |html, post:| html.gsub("teh", "the") }
  #     Inkwell::Hooks.filter(:post_content, raw_html, post: post) #=> transformed html
  #
  # Listeners are registered with a `source:` (usually the plugin name) so they can be
  # introspected or torn down independently — e.g. disabling a plugin removes exactly its
  # listeners, nothing else, which was never reliably true in WordPress.
  class Hooks
    Listener = Struct.new(:source, :priority, :callback, keyword_init: true)

    class << self
      def registry
        @registry ||= { actions: Hash.new { |h, k| h[k] = [] }, filters: Hash.new { |h, k| h[k] = [] } }
      end

      # --- Actions ---------------------------------------------------------

      def on_action(name, source: "core", priority: 10, &block)
        registry[:actions][name.to_sym] << Listener.new(source: source, priority: priority, callback: block)
        registry[:actions][name.to_sym].sort_by!(&:priority)
      end

      def fire(name, *args, **kwargs)
        registry[:actions][name.to_sym].each do |listener|
          listener.callback.call(*args, **kwargs)
        rescue StandardError => e
          Rails.logger.error("[Inkwell::Hooks] action `#{name}` listener from `#{listener.source}` raised: #{e.class}: #{e.message}")
          raise if Rails.env.test? # fail loudly in specs, degrade gracefully in prod
        end
        nil
      end

      # --- Filters -----------------------------------------------------------

      def on_filter(name, source: "core", priority: 10, &block)
        registry[:filters][name.to_sym] << Listener.new(source: source, priority: priority, callback: block)
        registry[:filters][name.to_sym].sort_by!(&:priority)
      end

      def filter(name, value, **kwargs)
        registry[:filters][name.to_sym].reduce(value) do |acc, listener|
          listener.callback.call(acc, **kwargs)
        rescue StandardError => e
          Rails.logger.error("[Inkwell::Hooks] filter `#{name}` listener from `#{listener.source}` raised: #{e.class}: #{e.message}")
          raise if Rails.env.test?
          acc # on failure in prod, pass the value through unchanged rather than breaking the page
        end
      end

      # --- Introspection / plugin teardown ------------------------------------

      def listeners_for(source)
        actions = registry[:actions].flat_map { |name, list| list.select { |l| l.source == source }.map { |l| [name, l] } }
        filters = registry[:filters].flat_map { |name, list| list.select { |l| l.source == source }.map { |l| [name, l] } }
        { actions: actions, filters: filters }
      end

      # Used when a plugin is deactivated — removes only that plugin's hooks
      def remove_source!(source)
        registry[:actions].each_value { |list| list.reject! { |l| l.source == source } }
        registry[:filters].each_value { |list| list.reject! { |l| l.source == source } }
      end

      # Test/dev helper — wipe everything and let plugins re-register
      def reset!
        @registry = nil
      end
    end
  end
end
