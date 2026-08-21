require "rails_helper"

RSpec.describe "Admin widgets", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:role) { Role.create!(name: "admin") }
  let(:site) { Site.create!(name: "Test Site", domain: "example.test") }
  let(:user) { User.create!(name: "Admin", email: "admin@example.com", password: "password123", site: site, role: role) }

  before { sign_in user }

  it "renders the widgets manager with area tabs" do
    get admin_widgets_path
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Sidebar")
    expect(response.body).to include("Add widget")
  end

  it "creates a widget and it renders in the area" do
    post admin_widgets_path, params: { widget: { kind: "text", area: "sidebar", title: "About", config: { body: "<p>hi</p>" } } }
    expect(response).to redirect_to(admin_widgets_path(area: "sidebar"))
    expect(site.widgets.count).to eq(1)
    expect(site.widgets.first.area).to eq("sidebar")
  end

  it "deletes a widget" do
    w = site.widgets.create!(kind: "text", area: "sidebar", title: "X", config: { body: "" })
    delete admin_widget_path(w)
    expect(response).to redirect_to(admin_widgets_path(area: "sidebar"))
    expect(Widget.exists?(w.id)).to be false
  end
end
