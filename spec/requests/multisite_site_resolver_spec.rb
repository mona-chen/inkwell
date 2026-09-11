require "rails_helper"

RSpec.describe Multisite::SiteResolver, type: :request do
  let(:app) { ->(_env) { [ 200, { "Content-Type" => "text/plain" }, [ "ok" ] ] } }
  let!(:default_site) do
    Site.create!(name: "Platform", domain: "inkwell.test", subdomain: nil, is_default: true)
  end
  let!(:blog) { Site.create!(name: "Blog", domain: "blog.inkwell.test", subdomain: "blog") }

  def resolved_site(host:, session: nil)
    env = Rack::MockRequest.env_for("http://#{host}/")
    env["rack.session"] = session || {}
    middleware = Multisite::SiteResolver.new(app)
    status, = middleware.call(env)
    id = env["multisite.site_id"]
    [ status, id && Site.find(id) ]
  end

  it "resolves the session-switched site first" do
    status, site = resolved_site(host: "inkwell.test", session: { "multisite.site_id" => blog.id })
    expect(status).to eq(200)
    expect(site).to eq(blog)
  end

  it "resolves by exact domain" do
    status, site = resolved_site(host: "blog.inkwell.test")
    expect(site).to eq(blog)
  end

  it "resolves by host_with_port (seed-style records)" do
    seeded = Site.create!(name: "Local", domain: "localhost:3000")
    status, site = resolved_site(host: "localhost:3000")
    expect(site).to eq(seeded)
  end

  it "resolves by tenant subdomain of the base domain" do
    status, site = resolved_site(host: "blog.lvh.me")
    expect(site).to eq(blog)
  end

  it "falls back to the default site when nothing matches" do
    status, site = resolved_site(host: "unrelated.example")
    expect(site).to eq(default_site)
  end

  it "falls back to the first site when no default exists" do
    default_site.update!(is_default: false)
    status, site = resolved_site(host: "unrelated.example")
    expect(site).to eq(default_site)
  end

  it "passes through when no sites exist at all (fresh install)" do
    Site.delete_all
    status, site = resolved_site(host: "anything.test")
    expect(status).to eq(200)
    expect(site).to be_nil
  end

  it "sets Current.site for the request and resets it afterwards" do
    expect(Current.site).to be_nil
    resolved_site(host: "blog.lvh.me")
    expect(Current.site).to be_nil
  end
end
