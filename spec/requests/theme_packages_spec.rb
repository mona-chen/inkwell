require "rails_helper"
require "zip"
require "tmpdir"

RSpec.describe "Theme package routing", type: :request do
  let!(:site) { Site.create!(name: "Theme site", domain: "www.example.com", active_theme: "package-test") }
  let(:root) { Rails.root.join("app/themes/package-test") }

  around do |example|
    FileUtils.mkdir_p(root.join("public/assets"))
    root.join("public/index.html").write('<html><head><script type="module" src="/assets/app.js"></script></head><body><div id="root">SPA shell</div></body></html>')
    root.join("public/about.html").write("<h1>About page</h1>")
    root.join("public/assets/app.js").write('document.querySelector("#root").textContent = location.pathname;')
    root.join("theme.json").write(JSON.generate(format: "inkwell-theme-v1", slug: "package-test", name: "Package test", kind: "static", public: "public", routes: { "/" => "index.html", "/about" => "about.html" }, spa_fallback: "index.html"))
    example.run
  ensure
    FileUtils.rm_rf(root)
  end

  it "serves a bundled app at the root and on a deep-link reload with query parameters" do
    get "/"
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("SPA shell")
    get "/customers/123/conversations?tab=open"
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("SPA shell", '<base href="/">')
    expect(response).not_to be_redirect
  end

  it "serves declared pages and both namespaced and original bundle paths" do
    get "/about"
    expect(response.body).to include("About page")
    get "/theme-assets/package-test/assets/app.js"
    expect(response).to have_http_status(:ok)
    expect(response.media_type).to eq("text/javascript")
    expect(response.body).to include("location.pathname")
    get "/assets/app.js"
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("location.pathname")
  end

  it "keeps preview chunks attached to their theme namespace without activating it" do
    site.update!(active_theme: "default")
    get "/assets/app.js", headers: { "HTTP_REFERER" => "http://www.example.com/theme-assets/package-test/assets/entry.js" }
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("location.pathname")
    expect(site.reload.active_theme).to eq("default")
  end

  it "does not return HTML for missing chunks, API requests, or unknown file paths" do
    get "/assets/missing.js"
    expect(response).to have_http_status(:not_found)
    expect(response.body).not_to include("SPA shell")
    get "/missing.css"
    expect(response).to have_http_status(:not_found)
    get "/api/v1/pages"
    expect(response.body).not_to include("SPA shell")
    get "/theme-assets/package-test/theme.json"
    expect(response).to have_http_status(:not_found)
  end

  it "renders ERB routes with the theme's own layout and isolated Hotwire entrypoint" do
    manifest = JSON.parse(root.join("theme.json").read).merge("kind" => "rails", "routes" => { "/" => "marketing/home", "/pricing" => "marketing/pricing" }, "imports" => { "theme/application" => "app.js" }, "entrypoint" => "theme/application")
    manifest.delete("spa_fallback")
    root.join("theme.json").write(JSON.generate(manifest))
    FileUtils.mkdir_p(root.join("views/layouts"))
    FileUtils.mkdir_p(root.join("views/marketing"))
    root.join("views/layouts/application.html.erb").write('<html><head><%= csrf_meta_tags %><%= theme_javascript_tags %></head><body data-controller="counter"><%= yield %></body></html>')
    root.join("views/marketing/home.html.erb").write("<h1><%= @site.name %></h1>")
    root.join("views/marketing/pricing.html.erb").write("<h1>Plans</h1>")
    get "/"
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Theme site", "@hotwired/stimulus", "/theme-assets/package-test/app.js", 'import "theme/application"')
    get "/pricing"
    expect(response.body).to include("Plans")
  end
end

RSpec.describe "Theme package administration", type: :request do
  include Devise::Test::IntegrationHelpers
  let!(:site) { Site.create!(name: "Theme admin", domain: "www.example.com", active_theme: "default") }
  let(:role) { Role.create!(name: "admin") }
  let(:admin) { User.create!(name: "Theme admin", email: "theme-admin@example.com", password: "password123", site: site, role: role) }
  let(:theme_root) { Rails.root.join("app/themes/upload-test") }

  after { FileUtils.rm_rf(theme_root) }

  it "shows a conventional multipart import form and imports without activating" do
    sign_in admin
    get "/admin/themes"
    expect(response).to have_http_status(:ok)
    expect(response.body).to include('type="file"', 'name="archive"', 'multipart/form-data')
    Dir.mktmpdir do |directory|
      archive = File.join(directory, "upload-test.zip")
      Zip::File.open(archive, create: true) { |zip| zip.get_output_stream("index.html") { |out| out.write("<h1>Uploaded</h1>") } }
      post "/admin/themes/import", params: { archive: Rack::Test::UploadedFile.new(archive, "application/zip") }
      expect(response).to redirect_to("/admin/themes")
      expect(theme_root.join("public/index.html")).to exist
      expect(site.reload.active_theme).to eq("default")
    end
  end

  it "refuses activation until required gems are loaded" do
    FileUtils.mkdir_p(theme_root.join("public"))
    theme_root.join("public/index.html").write("Home")
    theme_root.join("theme.json").write(JSON.generate(format: "inkwell-theme-v1", slug: "upload-test", name: "Upload", kind: "static", routes: { "/" => "index.html" }, dependencies: { gems: { "inkwell-missing-test-gem" => ">= 1" } }))
    sign_in admin
    post "/admin/themes/upload-test/activate"
    expect(response).to redirect_to("/admin/themes")
    expect(site.reload.active_theme).to eq("default")
    expect(flash[:alert]).to include("inkwell-missing-test-gem")
  end
end
