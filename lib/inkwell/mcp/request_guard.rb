require "stringio"

module Inkwell
  module Mcp
    # Bound the body before Rails parses/logs JSON parameters, including chunked
    # requests with no Content-Length. Do not buffer an unbounded request first.
    class RequestGuard
      MAX_BYTES = 1_048_576
      def initialize(app)
        @app = app
      end

      def call(env)
        if env["PATH_INFO"] == "/mcp" && env["REQUEST_METHOD"] == "POST"
          return oversized if env["CONTENT_LENGTH"].to_i > MAX_BYTES
          body = env["rack.input"]&.read(MAX_BYTES + 1).to_s
          return oversized if body.bytesize > MAX_BYTES
          env["rack.input"] = StringIO.new(body)
          env["CONTENT_LENGTH"] = body.bytesize.to_s
        end
        @app.call(env)
      end

      private

      def oversized
        [413, { "content-type" => "application/json", "cache-control" => "no-store" }, ['{"error":"MCP request exceeds 1 MB"}']]
      end
    end
  end
end
