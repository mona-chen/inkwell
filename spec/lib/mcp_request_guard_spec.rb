require "rails_helper"

RSpec.describe Inkwell::Mcp::RequestGuard do
  let(:app) { ->(env) { [200, {}, [env.fetch("rack.input").read]] } }
  subject(:guard) { described_class.new(app) }
  it "rejects chunked oversized input before the Rails parser" do
    status, = guard.call("PATH_INFO" => "/mcp", "REQUEST_METHOD" => "POST", "rack.input" => StringIO.new("x" * (described_class::MAX_BYTES + 1)))
    expect(status).to eq(413)
  end
  it "preserves a bounded JSON request" do
    status, _, body = guard.call("PATH_INFO" => "/mcp", "REQUEST_METHOD" => "POST", "rack.input" => StringIO.new('{"jsonrpc":"2.0"}'))
    expect(status).to eq(200)
    expect(body.join).to eq('{"jsonrpc":"2.0"}')
  end
end
