module Inkwell
  module Mcp
    class Tool
      attr_reader :name, :scope, :schema, :description, :read_only
      def initialize(name:, scope:, description:, schema:, read_only: false, &handler)
        raise ArgumentError, "Invalid tool name" unless name.match?(/\A[a-zA-Z0-9_.-]{1,128}\z/)
        raise ArgumentError, "Unknown scope" unless AgentCredential::SCOPES.include?(scope)
        @name, @scope, @description, @schema, @read_only, @handler = name, scope, description, schema.deep_stringify_keys, read_only, handler
        raise ArgumentError, "Tool needs an object schema and handler" unless @schema["type"] == "object" && handler
        # Resolve local refs only. Tool registration must never fetch schema URLs.
        @validator = JSONSchemer.schema(@schema, ref_resolver: ->(_uri) { raise ArgumentError, "External schema references are unsupported" })
      end

      def as_json(*)
        { name: name, description: description, inputSchema: schema, annotations: { readOnlyHint: read_only, destructiveHint: !read_only, openWorldHint: false } }
      end

      def call(context, arguments)
        raise AgentAccess::Error, "Arguments do not match #{name}'s input schema" unless @validator.valid?(arguments)
        @handler.call(context, arguments)
      end
    end
  end
end
