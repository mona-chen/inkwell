require "rails_helper"
RSpec.describe GithubApps::Setup do
  around do |example|
    old = ENV.delete("INKWELL_PUBLIC_URL")
    example.run
  ensure
    ENV["INKWELL_PUBLIC_URL"] = old if old
  end
  it "requires a public HTTPS origin without credentials or a path" do
    expect(described_class.public_url("https://inkwell.example/")).to eq("https://inkwell.example")
    ["http://inkwell.example", "https://localhost", "https://user:secret@inkwell.example", "https://inkwell.example/admin", "https://inkwell.example?token=x"].each do |url|
      expect(described_class.public_url(url)).to be_nil
    end
  end
  it "uses the configured public origin behind a proxy" do
    ENV["INKWELL_PUBLIC_URL"] = "https://inkwell.example"
    expect(described_class.public_url("http://127.0.0.1:3100")).to eq("https://inkwell.example")
  end
end
