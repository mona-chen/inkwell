require "rails_helper"
require "webmock/rspec"
RSpec.describe ThemePackages::Github do
  let(:sha) { "a" * 40 }
  it "resolves a branch to a pinned SHA and downloads without leaking credentials to redirect hosts" do
    client = described_class.new("owner/theme", token: "private-token")
    stub_request(:get, "https://api.github.com/repos/owner/theme/commits/main").with(headers: { "Authorization" => "Bearer private-token" }).to_return(body: { sha: sha }.to_json)
    expect(client.head("main")).to eq(sha)
    stub_request(:get, "https://api.github.com/repos/owner/theme/zipball/#{sha}").to_return(status: 302, headers: { "Location" => "https://codeload.github.com/owner/theme/legacy.zip/#{sha}" })
    download = stub_request(:get, "https://codeload.github.com/owner/theme/legacy.zip/#{sha}").with { |request| !request.headers.key?("Authorization") }.to_return(body: "archive")
    client.archive(sha) { |path| expect(File.binread(path)).to eq("archive") }
    expect(download).to have_been_requested
  end
  it "refuses foreign download redirects and malformed repo paths" do
    client = described_class.new("owner/theme", token: "private-token")
    stub_request(:get, "https://api.github.com/repos/owner/theme/zipball/#{sha}").to_return(status: 302, headers: { "Location" => "http://127.0.0.1/private" })
    expect { client.archive(sha) { |_| } }.to raise_error(ThemePackages::Invalid, /allowed download hosts/)
    expect { described_class.new("owner/../private") }.to raise_error(ThemePackages::Invalid)
  end
  it "surfaces GitHub permission/rate limit failures without response body secrets" do
    client = described_class.new("owner/theme", token: "secret")
    stub_request(:get, "https://api.github.com/repos/owner/theme/commits/main").to_return(status: 403, body: "private details")
    expect { client.head("main") }.to raise_error(ThemePackages::Invalid, /HTTP 403/)
  end
end
