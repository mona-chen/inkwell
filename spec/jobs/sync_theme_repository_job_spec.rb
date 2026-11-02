require "rails_helper"
require "zip"
require "tmpdir"

RSpec.describe SyncThemeRepositoryJob do
  let!(:site) { Site.create!(name: "Git theme", domain: "git-theme.test", active_theme: "default") }
  let!(:role) { Role.create!(name: "admin") }
  let!(:user) { User.create!(name: "Owner", email: "git-theme@test.example", password: "password123", site: site, role: role) }
  let!(:source) { site.theme_repository_sources.create!(user: user, repository: "https://github.com/example/theme.git", auto_update: true, auto_activate: true) }
  let(:sha) { "a" * 40 }
  let(:client) { instance_double(ThemePackages::Github) }

  around do |example|
    Dir.mktmpdir do |dir|
      @archive = File.join(dir, "site.zip")
      Zip::File.open(@archive, create: true) do |zip|
        zip.get_output_stream("repository/index.html") { |output| output.write("<h1>A GitHub theme</h1>") }
      end
      example.run
    end
  ensure
    source.releases.each { |release| FileUtils.rm_rf(Rails.root.join("app/themes", release["slug"])) }
    # A failed job's immutable directory may outlive a rolled-back record update.
    Dir.glob(Rails.root.join("app/themes/github-#{source.id.to_s(36)}-*")).each { |path| FileUtils.rm_rf(path) }
  end

  before do
    allow(ThemePackages::Github).to receive(:new).with("example/theme").and_return(client)
    allow(client).to receive(:head).with("main").and_return(sha)
    allow(client).to receive(:archive).with(sha).and_yield(@archive)
  end

  it "installs an immutable SHA release and switches the site only when opted in" do
    described_class.perform_now(source.id)
    expect(source.reload.status).to eq("installed")
    expect(source.deployed_sha).to eq(sha)
    expect(ThemePackages::Runtime.for(source.installed_slug).readiness_errors).to eq([])
    expect(site.reload.active_theme).to eq(source.installed_slug)
    expect(client).to receive(:archive).never
    described_class.perform_now(source.id)
    expect(source.reload.releases.size).to eq(1)
  end

  it "leaves installation as preview-only without activation permission" do
    source.update!(auto_activate: false)
    described_class.perform_now(source.id)
    expect(source.reload.installed_slug).to be_present
    expect(site.reload.active_theme).to eq("default")
  end

  it "preserves the last working theme if an update fails" do
    described_class.perform_now(source.id)
    working = site.reload.active_theme
    allow(client).to receive(:head).and_raise(ThemePackages::Invalid, "GitHub unavailable")
    described_class.perform_now(source.id)
    expect(source.reload.status).to eq("failed")
    expect(site.reload.active_theme).to eq(working)
  end

  it "does not overwrite a manual switch away from a connected theme" do
    described_class.perform_now(source.id)
    site.update!(active_theme: "mono")
    next_sha = "b" * 40
    allow(client).to receive(:head).and_return(next_sha)
    allow(client).to receive(:archive).with(next_sha).and_yield(@archive)
    described_class.perform_now(source.id)
    expect(source.reload.deployed_sha).to eq(next_sha)
    expect(site.reload.active_theme).to eq("mono")
  end

  it "honors paused updates and revoked author permissions" do
    source.update!(auto_update: false)
    expect(client).not_to receive(:head)
    described_class.perform_now(source.id, automatic: true)
    user.deactivate!
    described_class.perform_now(source.id)
    expect(source.reload.installed_slug).to be_nil
  end
  it "does not replace a theme selected after installation was queued" do
    site.update!(active_theme: "mono")
    described_class.perform_now(source.id)
    expect(source.reload.installed_slug).to be_present
    expect(site.reload.active_theme).to eq("mono")
  end

  it "retains manifest packages needing a build without activating them" do
    Zip::File.open(@archive) do |zip|
      zip.remove("repository/index.html")
      zip.get_output_stream("repository/theme.json") { |out| out.write(JSON.generate(format: "inkwell-theme-v1", slug: "original-theme", name: "App", kind: "static", routes: { "/" => "index.html" })) }
      zip.get_output_stream("repository/package.json") { |out| out.write(JSON.generate(scripts: { build: "vite build" })) }
    end
    described_class.perform_now(source.id)
    expect(source.reload.status).to eq("needs_build")
    expect(source.error_message).to include("build the theme first")
    expect(site.reload.active_theme).to eq("default")
    expect(ThemePackages::Runtime.for(source.installed_slug).manifest.slug).to eq(source.installed_slug)
  end

  it "rechecks authorization before activating an in-flight download" do
    allow(client).to receive(:archive).with(sha) do |&block|
      user.deactivate!
      block.call(@archive)
    end
    described_class.perform_now(source.id)
    expect(site.reload.active_theme).to eq("default")
  end

end
