require "rails_helper"
RSpec.describe "Site-wide custom CSS", type: :request do
  include Devise::Test::IntegrationHelpers
  let!(:site) { Site.create!(name: "CSS site", domain: "css.test", active_theme: "default") }
  let!(:role) { Role.create!(name: "admin") }
  let!(:user) { User.create!(name: "Owner", email: "css@example.test", password: "password123", site: site, role: role) }

  it "provides a settings form and persists CSS for the current site" do
    sign_in user
    get "/admin/settings?section=custom_css"
    expect(response).to have_http_status(:ok)
    expect(response.body).to include('name="settings[custom_css]"', 'id="custom_css-settings-form"')
    patch "/admin/settings?section=custom_css", params: { settings: { custom_css: "body { --my-brand: red; }" } }
    expect(response).to redirect_to("/admin/settings?section=custom_css")
    get "/"
    expect(response.body).to include('data-ink-site-custom-css="true"', "--my-brand: red")
    get "/admin"
    expect(response.body).not_to include('data-ink-site-custom-css="true"')
    patch "/admin/settings?section=custom_css", params: { settings: { custom_css: "" } }
    get "/"
    expect(response.body).not_to include('data-ink-site-custom-css="true"')
  end

  it "prevents style text from introducing script elements" do
    site.set_setting!("custom_css", '</style><script id="injected">alert(1)</script><style>')
    get "/"
    doc = Nokogiri::HTML5.parse(response.body)
    expect(doc.at_css("script#injected")).to be_nil
    expect(doc.css("style[data-ink-site-custom-css]").size).to eq(1)
  end

  it "rejects oversized settings without changing existing CSS" do
    sign_in user
    site.set_setting!("custom_css", "body { color: red; }")
    patch "/admin/settings?section=custom_css", params: { settings: { custom_css: "x" * 65_537 } }
    expect(site.setting("custom_css")).to eq("body { color: red; }")
  end
  it "preserves literal HTML tokens inside imported runtime scripts" do
    site.set_setting!("custom_css", ".example { color: red; }")
    site.pages.create!(title: "Runtime", author: user, template: "landing", status: "published", public_path: "/runtime", live_render_mode: "original_import", original_import_url: "https://source.test/runtime", original_import_html: '<html><head><script>window.example = "</head>";</script></head><body><main>Original</main></body></html>')
    get "/runtime"
    document = Nokogiri::HTML5.parse(response.body)
    expect(document.css("script").map(&:text)).to include('window.example = "</head>";')
    expect(document.at_css("head > style[data-ink-site-custom-css]")).to be_present
  end

end

RSpec.describe "Site-wide custom scripts", type: :request do
  include Devise::Test::IntegrationHelpers
  let!(:site) { Site.create!(name: "Scripts", domain: "scripts.test", active_theme: "default") }
  let!(:role) { Role.create!(name: "admin") }
  let!(:user) { User.create!(name: "Owner", email: "scripts@example.test", password: "password123", site: site, role: role) }

  it "saves head and footer snippets, renders public pages only, and supports removal" do
    sign_in user
    get "/admin/settings?section=custom_scripts"
    expect(response.body).to include('name="settings[custom_scripts_head]"', 'name="settings[custom_scripts_body]"')
    patch "/admin/settings?section=custom_scripts", params: { settings: { custom_scripts_head: '<script src="https://example.test/analytics.js" defer></script>', custom_scripts_body: '<script id="custom-footer">window.custom = true;</script>' } }
    get "/"
    doc = Nokogiri::HTML5.parse(response.body)
    expect(doc.at_css('head script[src="https://example.test/analytics.js"]')).to be_present
    expect(doc.at_css('body script#custom-footer').text).to eq("window.custom = true;")
    get "/admin"
    expect(response.body).not_to include('id="custom-footer"', 'src="https://example.test/analytics.js"')
    patch "/admin/settings?section=custom_scripts", params: { settings: { custom_scripts_head: "", custom_scripts_body: "" } }
    get "/"
    expect(response.body).not_to include('id="custom-footer"')
  end

  it "rejects oversized snippets before updating either field" do
    sign_in user
    site.set_setting!("custom_scripts_head", "original")
    patch "/admin/settings?section=custom_scripts", params: { settings: { custom_scripts_head: "changed", custom_scripts_body: "x" * 65_537 } }
    expect(site.setting("custom_scripts_head")).to eq("original")
  end

  it "does not allow visitors to change scripts" do
    patch "/admin/settings?section=custom_scripts", params: { settings: { custom_scripts_head: "untrusted" } }
    expect(response).to have_http_status(:redirect)
    expect(site.setting("custom_scripts_head")).to be_blank
  end
end
