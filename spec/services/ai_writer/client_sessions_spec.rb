require "rails_helper"
require "tmpdir"

RSpec.describe AiWriter::ClientSessions do
  include ActiveSupport::Testing::TimeHelpers

  it "shares tool history between instances and expires it after inactivity" do
    Dir.mktmpdir("inkwell-copilot-test") do |directory|
      first = described_class.new(cache: ActiveSupport::Cache::FileStore.new(directory))
      second = described_class.new(cache: ActiveSupport::Cache::FileStore.new(directory))
      first["session"] = { messages: [{ role: "user", content: "Build a dashboard" }], user_id: 12 }
      expect(second["session"]).to eq(first["session"])
      travel 11.minutes do
        expect(second["session"]).to be_nil
      end
    end
  end
end
