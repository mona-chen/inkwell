require "rails_helper"

# The capture script only crawls linked pages on origins it is told about, so the job must
# forward every configured origin as `--include-origin` — without this the extra-origins field
# would be dead config. This pins that wiring, plus the SSRF check that also runs over each
# origin, without launching a browser or hitting the network.
RSpec.describe WebsiteImportJob do
  let(:role) { Role.create!(name: "admin") }
  let(:site) { Site.create!(name: "Job Site", domain: "job.example.test") }
  let(:user) { User.create!(name: "Importer", email: "importer@example.com", password: "password123", site: site, role: role) }

  def create_import(overrides = {})
    site.website_imports.create!({
      user: user,
      source_url: "https://example.com",
      max_depth: 3,
      max_pages: 10,
      ownership_confirmed: true
    }.merge(overrides))
  end

  before do
    allow(Resolv).to receive(:getaddresses).and_return([ "93.184.216.34" ])
  end

  it "forwards every configured origin to the capture script and marks the import ready" do
    import = create_import(allowed_origins: [ "https://ruutai.framer.ai", "https://cdn.example.com" ])
    commands = []
    allow(Open3).to receive(:capture3) do |*command, **_options|
      commands << command
      [ "", "", double("status", success?: true) ]
    end
    FileUtils.mkdir_p(import.capture_directory)
    import.capture_directory.join("site-builder-payload.json").write(
      JSON.generate("pages" => [], "importReport" => { "capturedPages" => 2 })
    )

    described_class.perform_now(import.id)

    capture = commands.find { |command| command.include?("capture-site") }
    expect(capture).to be_present
    expect(capture.each_cons(2)).to include(
      [ "--include-origin", "https://ruutai.framer.ai" ],
      [ "--include-origin", "https://cdn.example.com" ]
    )
    expect(import.reload.status).to eq("ready")
    expect(import.captured_pages).to eq(2)
  end

  it "does not capture when a configured origin resolves to a private address" do
    allow(Resolv).to receive(:getaddresses).with("ruutai.framer.ai").and_return([ "10.0.0.5" ])
    import = create_import(allowed_origins: [ "https://ruutai.framer.ai" ])
    allow(Open3).to receive(:capture3).and_raise("capture must not run for a private origin")

    described_class.perform_now(import.id)

    expect(import.reload.status).to eq("failed")
    expect(import.error_message).to match(/reserved network/i)
  end
end
