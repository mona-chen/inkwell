module AiWriter
  # Only conversation/tool history lives here. The editable design stays in the browser.
  # Development workers share a file cache; production uses the app's shared Solid Cache.
  class ClientSessions
    TTL = 10.minutes

    def initialize(cache: nil)
      @cache = cache || if Rails.env.production?
        Rails.cache
      elsif Rails.env.test?
        ActiveSupport::Cache::MemoryStore.new
      else
        directory = Rails.root.join("tmp/cache/ai_writer_sessions")
        FileUtils.mkdir_p(directory, mode: 0o700)
        ActiveSupport::Cache::FileStore.new(directory)
      end
    end

    def [](id)
      @cache.read(key(id))
    end

    def []=(id, value)
      @cache.write(key(id), value, expires_in: TTL)
    end

    def delete(id)
      @cache.delete(key(id))
    end

    def key?(id)
      @cache.exist?(key(id))
    end

    def cleanup
      @cache.cleanup if @cache.is_a?(ActiveSupport::Cache::FileStore) || @cache.is_a?(ActiveSupport::Cache::MemoryStore)
    end

    private

    def key(id)
      "inkwell/copilot/session/v1/#{id}"
    end
  end
end
