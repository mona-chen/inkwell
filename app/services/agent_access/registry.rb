module AgentAccess
  class Registry
    def self.plugin_active?(site, slug)
      return false unless InstalledPlugin.exists?(slug: slug, active: true)
      return Multisite::PluginGate.active_for_site?(site, slug) if defined?(Multisite::PluginGate)
      true
    end

    def initialize(credential)
      @credential = credential
    end

    def tools
      definitions = CoreTools.tools + SettingsTools.tools + LivePlugins.tools
      Inkwell::PluginManager.discovered.each do |engine|
        next unless self.class.plugin_active?(@credential.site, engine.plugin_slug)
        engine.mcp_tools.each do |name, options|
          definitions << Inkwell::Mcp::Tool.new(name: "#{engine.plugin_slug}.#{name}", **options.except(:handler), &options.fetch(:handler))
        end
      end
      definitions.concat(LivePlugins.plugin_tools(@credential.site))
      raise Error, "Conflicting plugin tool names" if definitions.map(&:name).uniq.size != definitions.size
      definitions.select { |tool| @credential.allows?(tool.scope) }.sort_by(&:name)
    end

    def call(name, arguments)
      tool = tools.find { |item| item.name == name }
      raise Error, "Unknown tool or missing permission" unless tool
      event = AgentActivity.new(site: @credential.site, agent_credential: @credential, tool: name, status: "success", arguments_digest: Digest::SHA256.hexdigest(arguments.to_json))
      result = nil
      AgentActivity.transaction do
        ctx = Context.new(@credential, activity: event)
        ctx.require_scope!(tool.scope)
        Current.set(site: ctx.site, user: ctx.user) { result = tool.call(ctx, arguments) }
        raise Error, "Plugin tools must return a JSON object" unless result.is_a?(Hash)
        result.to_json # Serialization must succeed before the write transaction commits.
        event.save!
      end
      payload = result.merge(activity_id: event.id)
      { content: [{ type: "text", text: payload.to_json }], structuredContent: payload, isError: false }
    rescue StandardError => e
      AgentActivity.create!(site: @credential.site, agent_credential: @credential, tool: name.to_s.first(128), status: "error", error_code: e.class.name, arguments_digest: Digest::SHA256.hexdigest(arguments.to_json))
      expected = e.is_a?(AgentAccess::Error) || e.is_a?(ActiveRecord::RecordInvalid) || e.is_a?(ActiveRecord::RecordNotFound) || e.is_a?(PageBuilder::Workspace::Invalid)
      Rails.logger.error("[MCP tool #{name}] #{e.class}: #{e.message}") unless expected
      { content: [{ type: "text", text: expected ? e.message : "Tool failed. Check the server log." }], isError: true }
    end
  end
end
