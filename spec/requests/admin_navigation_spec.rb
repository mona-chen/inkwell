require "rails_helper"

RSpec.describe "Admin navigation", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:role) { Role.create!(name: "admin") }
  let(:site) { Site.create!(name: "S", domain: "s.test", is_default: true) }
  let(:user) { User.create!(name: "A", email: "nav@example.com", password: "password123", site: site, role: role) }

  def site_items
    Admin::Shell.build_nav_groups(user: user).find { |label, _items| label == "Site" }[1]
  end

  it "nests Themes and Content templates under Appearance" do
    appearance = site_items.find { |item| item[:label] == "Appearance" }
    expect(appearance[:children].map { |child| child[:label] }).to eq([ "Themes", "Content templates" ])
    expect(appearance[:children].map { |child| child[:path] }).to eq([ "/admin/themes", "/admin/templates" ])
  end

  it "lets a plugin attach a child beneath an existing parent" do
    allow(Inkwell::PluginManager).to receive(:admin_nav_items).and_return([
      { label: "Custom CSS", path: "/plugins/css/settings", icon: "palette", admin_only: false, section: "Site", parent: "Appearance", children: [] }
    ])

    appearance = site_items.find { |item| item[:label] == "Appearance" }
    expect(appearance[:children].map { |child| child[:label] }).to include("Custom CSS")
  end

  it "lets a plugin register a nested nav item with its own children" do
    allow(Inkwell::PluginManager).to receive(:admin_nav_items).and_return([
      {
        label: "Commerce", path: nil, icon: "puzzle-piece", admin_only: false, section: "Site",
        children: [ { label: "Orders", path: "/plugins/commerce/orders", icon: "puzzle-piece", admin_only: false } ]
      }
    ])

    commerce = site_items.find { |item| item[:label] == "Commerce" }
    expect(commerce[:children].map { |child| child[:label] }).to eq([ "Orders" ])
  end

  it "renders the dedicated Content templates page" do
    sign_in user

    get admin_templates_path
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Content templates")
    expect(response.body).to include("Single post")
    expect(response.body).to include("Blog index")
  end

  it "renders a collapsible disclosure for parent nav items" do
    sign_in user

    get admin_templates_path
    expect(response.body).to include('data-controller="toggle"')
    expect(response.body).to include('data-action="click->toggle#toggle"')
    expect(response.body).to include('data-toggle-target="menu"')
  end

  it "creates a content template page for a role" do
    sign_in user

    expect do
      post admin_create_template_path("single_post")
    end.to change(site.pages, :count).by(1)

    page = site.pages.last
    expect(page.template_for).to eq("single_post")
    expect(response).to redirect_to("/builder/page/#{page.id}")
  end
end
