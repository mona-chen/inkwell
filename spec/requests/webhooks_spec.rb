require "rails_helper"

RSpec.describe "Webhooks", type: :request do
  include Devise::Test::IntegrationHelpers

  let!(:site) { Site.create!(name: "Acme", domain: "example.test", is_default: true) }
  let(:role) { Role.create!(name: "admin") }
  let(:user) { User.create!(name: "Ada", email: "ada@example.com", password: "password123", site: site, role: role) }
  let(:endpoint) do
    Webhooks::Endpoint.create!(site: site, name: "Hook", url: "http://hooks.test/inkwell", events: Webhooks::Endpoint::EVENT_NAMES)
  end

  describe "model" do
    it "generates a secret and validates events" do
      expect(endpoint.secret).to be_present
      expect(endpoint.subscribes_to?("post_published")).to be(true)
      expect(endpoint.subscribes_to?("nope")).to be(false)
    end

    it "rejects unknown events" do
      invalid = Webhooks::Endpoint.new(site: site, name: "x", url: "http://x.test", events: [ "nope" ])
      expect(invalid).not_to be_valid
    end

    it "requires an http(s) url" do
      invalid = Webhooks::Endpoint.new(site: site, name: "x", url: "ftp://x.test", events: [])
      expect(invalid).not_to be_valid
    end
  end

  describe "signing" do
    it "produces a deterministic HMAC-SHA256 signature" do
      expected = OpenSSL::HMAC.hexdigest("SHA256", "secret", "123.body")
      expect(Webhooks::Client.sign("secret", "123", "body")).to eq(expected)
    end
  end

  describe "UrlGuard" do
    it "flags private and reserved addresses" do
      expect(Webhooks::UrlGuard.private_address?("127.0.0.1")).to be(true)
      expect(Webhooks::UrlGuard.private_address?("10.0.0.5")).to be(true)
      expect(Webhooks::UrlGuard.private_address?("8.8.8.8")).to be(false)
    end
  end

  describe "dispatcher" do
    it "creates a delivery for each subscribed active endpoint" do
      endpoint
      post = site.posts.create!(title: "Hello", author: user, status: "draft")

      expect do
        Webhooks::Dispatcher.dispatch(:post_published, post)
      end.to change(Webhooks::Delivery, :count).by(1)

      expect(Webhooks::Delivery.last.event).to eq("post_published")
    end

    it "ignores endpoints that do not subscribe" do
      Webhooks::Endpoint.create!(site: site, name: "Other", url: "http://other.test", events: [ "page_published" ])
      post = site.posts.create!(title: "Hello", author: user, status: "draft")

      expect do
        Webhooks::Dispatcher.dispatch(:post_published, post)
      end.not_to change(Webhooks::Delivery, :count)
    end
  end

  describe "page_published hook" do
    it "fires when a page is published" do
      received = nil
      Inkwell::Hooks.on_action(:page_published, source: "spec") { |page| received = page.id }

      page = site.pages.create!(title: "About", author: user, status: "draft")
      page.publish_native!

      expect(received).to eq(page.id)
    ensure
      Inkwell::Hooks.remove_source!("spec")
    end
  end

  describe "delivery job" do
    it "marks the delivery delivered on a 2xx response" do
      delivery = endpoint.deliveries.create!(event: "post_published", payload: { id: 1 })
      allow_any_instance_of(Webhooks::Client).to receive(:deliver).and_return({ success: true, code: 200, body: "ok" })

      Webhooks::DeliverJob.perform_now(delivery.id)

      expect(delivery.reload.delivered_at).to be_present
      expect(delivery.response_code).to eq(200)
    end

    it "records the error on a non-2xx response" do
      delivery = endpoint.deliveries.create!(event: "post_published", payload: { id: 1 })
      allow_any_instance_of(Webhooks::Client).to receive(:deliver).and_return({ success: false, code: 500, error: "HTTP 500" })

      Webhooks::DeliverJob.perform_now(delivery.id)

      expect(delivery.reload.delivered_at).to be_nil
      expect(delivery.error).to include("500")
    end
  end

  describe "admin UI" do
    before { sign_in user }

    it "renders the settings page" do
      get "/plugins/webhooks/settings"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("Webhooks")
    end

    it "creates and deletes an endpoint" do
      expect do
        post "/plugins/webhooks/endpoints", params: {
          endpoint: { name: "CI", url: "http://ci.test/hook", events: [ "post_published" ] }
        }
      end.to change(Webhooks::Endpoint, :count).by(1)
      expect(response).to redirect_to("/plugins/webhooks/settings")

      created = Webhooks::Endpoint.last
      expect do
        delete "/plugins/webhooks/endpoints/#{created.id}"
      end.to change(Webhooks::Endpoint, :count).by(-1)
    end
  end
end
