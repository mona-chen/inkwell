require "rails_helper"
require "webmock/rspec"
RSpec.describe GithubApps::Client do
  let(:key) { OpenSSL::PKey::RSA.generate(2048) }
  let(:connection) { double("connection", authorized?: true, connected?: true, app_id: 123, installation_id: 456, app_credentials: { "pem" => key.to_pem }) }
  subject(:client) { described_class.new(connection) }

  it "signs short-lived App JWTs with the configured private key" do
    header, payload, signature = client.app_jwt.split(".")
    expect(key.public_key.verify(OpenSSL::Digest::SHA256.new, Base64.urlsafe_decode64(signature), "#{header}.#{payload}")).to eq(true)
    claims = JSON.parse(Base64.urlsafe_decode64(payload))
    expect(claims.fetch("iss")).to eq("123")
    expect(claims.fetch("exp") - Time.current.to_i).to be_between(530, 550)
  end

  it "requests read-only installation tokens and returns only repository metadata" do
    stub_request(:post, "https://api.github.com/app/installations/456/access_tokens").with(body: { permissions: { contents: "read", metadata: "read" } }.to_json).to_return(body: { token: "short-lived" }.to_json)
    stub_request(:get, "https://api.github.com/installation/repositories?per_page=100&page=1").with(headers: { "Authorization" => "Bearer short-lived" }).to_return(body: { repositories: [{ id: 1, full_name: "owner/private", default_branch: "main", private: true, secrets: "never-store" }] }.to_json)
    expect(client.repositories).to eq([{ "id" => 1, "full_name" => "owner/private", "default_branch" => "main", "private" => true }])
  end

  it "rejects an installation the authorizing user cannot access" do
    stub_request(:get, "https://api.github.com/user/installations?per_page=100&page=1").to_return(body: { installations: [{ id: 999, app_id: 123 }] }.to_json)
    expect { client.verify_installation!("user-token", "456") }.to raise_error(described_class::Error, /not accessible/)
  end

  it "also verifies that the installation belongs to this App" do
    stub_request(:get, "https://api.github.com/user/installations?per_page=100&page=1").to_return(body: { installations: [{ id: 456, app_id: 123 }] }.to_json)
    stub_request(:get, "https://api.github.com/app/installations/456").to_return(body: { id: 456, app_id: 777 }.to_json)
    expect { client.verify_installation!("user-token", "456") }.to raise_error(described_class::Error, /different GitHub App/)
  end

  it "does not mint tokens for a revoked administrator" do
    allow(connection).to receive(:authorized?).and_return(false)
    expect { client.installation_token }.to raise_error(described_class::Error, /no longer authorized/)
  end
end
