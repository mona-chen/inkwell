require "rails_helper"

RSpec.describe "Plugin-registered templates and data sources", type: :request do
  after { Inkwell::Hooks.remove_source!("commerce") }

  before do
    Inkwell::Hooks.on_filter(:page_template_roles, source: "commerce") do |roles|
      roles + [ { role: "commerce.single_product", label: "Single product", description: "Product page", icon: "shopping_bag", plugin: "commerce" } ]
    end
    Inkwell::Hooks.on_filter(:builder_data_sources, source: "commerce") do |sources|
      sources.merge("product" => { "label" => "Product", "fields" => { "title" => "Title", "price" => "Price" }, "plugin" => "commerce" })
    end
    Inkwell::Hooks.on_filter(:builder_loop_sources, source: "commerce") do |loops|
      loops.merge("products" => { "label" => "Products", "var" => "product", "scope" => "Current.site.products.published", "plugin" => "commerce" })
    end
    Inkwell::Hooks.on_filter(:builder_sample_data, source: "commerce") do |data, site:|
      data.merge("product" => { "title" => "Sample product", "price" => "9.99" })
    end
  end

  it "adds a namespaced template role to the registry and accepts it in validation" do
    expect(Page.template_roles).to include("commerce.single_product")

    page = Page.new(template_for: "commerce.single_product")
    page.valid?
    expect(page.errors[:template_for]).to be_empty
  end

  it "keeps core roles and still rejects unknown roles" do
    expect(Page.template_roles).to include("single_post")

    page = Page.new(template_for: "not.a.role")
    page.valid?
    expect(page.errors[:template_for]).to be_present
  end

  it "exposes plugin data sources and loop sources to the builder catalog" do
    catalog = PageBuilder::DataSources.catalog
    expect(catalog["sources"]).to include("product")
    expect(catalog["loops"]).to include("products")
  end

  it "converts plugin loop and field tokens via ErbConverter" do
    erb = PageBuilder::ErbConverter.convert(
      "{{ loop products:3 }}<h2>{{ product.title }}</h2>{{ /loop }}",
      document_root: "@page"
    )
    expect(erb).to include("Current.site.products.published.limit(3).each do |product|")
    expect(erb).to include("product.title")
  end

  it "merges plugin sample data for canvas preview" do
    site = Site.create!(name: "S", domain: "s.test")
    expect(PageBuilder::DataSources.sample_data(site)).to include("product")
  end
end
