require "rails_helper"
require "tmpdir"

RSpec.describe ThemePackages::Importer do
  around do |example|
    Dir.mktmpdir do |root|
      @root = Pathname.new(root)
      @source = @root.join("source")
      @destination = @root.join("themes")
      FileUtils.mkdir_p(@source)
      example.run
    end
  end

  def write(path, content)
    file = @source.join(path)
    FileUtils.mkdir_p(file.dirname)
    file.write(content)
  end

  def importer = described_class.new(destination: @destination)

  it "imports a plain multipage website with extensionless navigation and excludes secrets" do
    write("index.html", "<h1>Home</h1>")
    write("about.html", "<h1>About</h1>")
    write("assets/app.js", "window.loaded=true")
    write(".env", "SECRET=private")
    manifest = importer.import_directory!(@source, slug: "static-test")
    expect(manifest["spa_fallback"]).to be_nil
    expect(manifest["routes"]).to include("/" => "index.html", "/about" => "about.html", "/about.html" => "about.html")
    expect(@destination.join("static-test/public/assets/app.js")).to exist
    expect(@destination.join("static-test/public/.env")).not_to exist
  end

  it "preserves Rails views, Stimulus sources and dependency declarations" do
    manifest = { format: "inkwell-theme-v1", slug: "rails-test", name: "Rails", kind: "rails",
      views: "app/views", public: "public", routes: { "/" => "site/home" },
      dependencies: { gems: { "rails" => ">= 8" }, packages: { "esbuild" => "^0.25.0" } } }
    write("theme.json", JSON.generate(manifest))
    write("app/views/layouts/application.html.erb", "<html><%= yield %></html>")
    write("app/views/site/home.html.erb", '<button data-controller="counter">Count</button>')
    write("app/javascript/counter_controller.js", "export default class Counter {}")
    write("package.json", JSON.generate(dependencies: { esbuild: "^0.25.0" }))
    importer.import_directory!(@source)
    expect(@destination.join("rails-test/app/views/site/home.html.erb").read).to include("data-controller")
    expect(@destination.join("rails-test/app/javascript/counter_controller.js")).to exist
    expect(@destination.join("rails-test/Gemfile.theme").read).to include('gem "rails", ">= 8"')
  end

  it "allows source-only SPA packages but keeps them unready until built" do
    write("theme.json", JSON.generate(format: "inkwell-theme-v1", slug: "spa-source", name: "SPA", kind: "static", public: "dist", routes: { "/" => "index.html" }, spa_fallback: "index.html"))
    write("package.json", JSON.generate(scripts: { build: "vite build" }))
    importer.import_directory!(@source)
    manifest = ThemePackages::Manifest.new(JSON.parse(@destination.join("spa-source/theme.json").read))
    runtime = ThemePackages::Runtime.new(@destination.join("spa-source"), manifest)
    expect(runtime.readiness_errors.join).to include("build the theme first")
  end

  it "refuses traversal, reserved routes, symlinks, and overwrite" do
    write("theme.json", JSON.generate(format: "inkwell-theme-v1", slug: "bad", name: "Bad", kind: "static", routes: { "/admin" => "index.html" }))
    expect { importer.import_directory!(@source) }.to raise_error(ThemePackages::Invalid, /reserved/)
    FileUtils.rm(@source.join("theme.json"))
    write("index.html", "Home")
    File.symlink("/etc/passwd", @source.join("secret"))
    expect { importer.import_directory!(@source, slug: "safe") }.to raise_error(ThemePackages::Invalid, /symbolic/)
    FileUtils.rm(@source.join("secret"))
    importer.import_directory!(@source, slug: "safe")
    expect { importer.import_directory!(@source, slug: "safe") }.to raise_error(ThemePackages::Invalid, /already exists/)
    expect { ThemePackages::Manifest.new({ "format" => "inkwell-theme-v1", "slug" => "../bad", "name" => "Bad", "kind" => "static" }) }.to raise_error(ThemePackages::Invalid)
  end

  it "imports ZIPs without executing build scripts and rejects escaping entries" do
    archive = @root.join("website.zip")
    Zip::File.open(archive, create: true) { |zip| zip.get_output_stream("index.html") { |out| out.write("Home") } }
    importer.import_zip!(archive.to_s, slug: "zipped", spa: true)
    expect(JSON.parse(@destination.join("zipped/theme.json").read)["spa_fallback"]).to eq("index.html")
    expect(@destination.join("zipped/public/index.html").read).to eq("Home")
    malicious = @root.join("escape.zip")
    Zip::File.open(malicious, create: true) { |zip| zip.get_output_stream("../escaped") { |out| out.write("bad") } }
    expect { importer.import_zip!(malicious.to_s) }.to raise_error(ThemePackages::Invalid, /Unsafe/)
    expect(@root.join("escaped")).not_to exist
  end
end
