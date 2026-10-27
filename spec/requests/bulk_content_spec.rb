require "rails_helper"

RSpec.describe "Bulk content actions", type: :request do
  include Devise::Test::IntegrationHelpers
  let!(:site) { Site.create!(name: "Bulk site", domain: "bulk.test") }
  let!(:role) { Role.create!(name: "admin") }
  let!(:user) { User.create!(name: "Owner", email: "bulk@example.test", password: "password123", site: site, role: role) }
  before { sign_in user }
  def page(title, **attrs)
    site.pages.create!({ title: title, author: user, template: "default", status: "draft", content: [{ type: "paragraph", data: { text: "Saved content" } }] }.merge(attrs))
  end
  def article(title, **attrs)
    site.posts.create!({ title: title, author: user, status: "draft", content: [{ type: "paragraph", data: { text: "Saved content" } }] }.merge(attrs))
  end

  it "renders selectable posts and pages with a standalone bulk form" do
    item = page("Selected page")
    post_record = article("Selected post")
    [["pages", item], ["posts", post_record]].each do |kind, record|
      get "/admin/#{kind}"
      expect(response).to have_http_status(:ok)
      doc = Nokogiri::HTML5.parse(response.body)
      expect(doc.at_css("input[name='ids[]'][value='#{record.id}']")['form']).to eq("bulk-content-form")
      expect(doc.at_css("form#bulk-content-form")['action']).to eq("/admin/#{kind}/bulk")
      expect(doc.css("a input[type=checkbox]")).to be_empty
    end
  end

  it "publishes stored content without erasing it and commits working drafts" do
    saved = article("Saved")
    working = article("Working", draft_content: [{ type: "paragraph", data: { text: "Working content" } }])
    post "/admin/posts/bulk", params: { ids: [saved.id, working.id], bulk_action: "publish" }
    expect(response).to have_http_status(:see_other)
    expect(saved.reload.content_blocks.first.dig("data", "text")).to eq("Saved content")
    expect(working.reload.content_blocks.first.dig("data", "text")).to eq("Working content")
    expect(saved.status).to eq("published")
  end

  it "trashes and restores pages and prevents trashed homepages from rendering" do
    home = page("Home", status: "published")
    site.set_setting!("show_on_front", "page")
    site.set_setting!("page_on_front", home.id)
    post "/admin/pages/bulk", params: { ids: [home.id], bulk_action: "trash" }
    expect(home.reload.status).to eq("trashed")
    expect(site.front_page).to be_nil
    get "/admin/pages"
    expect(response.body).not_to include("Select Home")
    get "/admin/pages?status=trashed"
    expect(response.body).to include("Select Home", "Restore as drafts", "Delete permanently")
    post "/admin/pages/bulk", params: { ids: [home.id], bulk_action: "restore", status: "trashed" }
    expect(home.reload.status).to eq("draft")
  end

  it "does not partially mutate a selection containing a foreign site record" do
    own = page("Own")
    other = Site.create!(name: "Other", domain: "other.test")
    foreign = other.pages.create!(title: "Other", author: user, template: "default", status: "draft")
    post "/admin/pages/bulk", params: { ids: [own.id, foreign.id], bulk_action: "trash" }
    expect(response).to have_http_status(:not_found)
    expect(own.reload.status).to eq("draft")
    expect(foreign.reload.status).to eq("draft")
  end

  it "authorizes the complete selection before making any changes" do
    role.update!(name: "editor", capabilities: ["manage_site", "edit_others_posts"])
    other_user = User.create!(name: "Other author", email: "other-author@example.test", password: "password123", site: site, role: role)
    mine = article("Mine")
    theirs = article("Theirs", author: other_user)
    post "/admin/posts/bulk", params: { ids: [mine.id, theirs.id], bulk_action: "trash" }
    expect(response).to have_http_status(:forbidden)
    expect(mine.reload.status).to eq("draft")
  end

  it "requires trash before permanent deletion" do
    item = page("Keep me")
    post "/admin/pages/bulk", params: { ids: [item.id], bulk_action: "delete" }
    expect(item.reload.status).to eq("draft")
    item.update!(status: "trashed")
    post "/admin/pages/bulk", params: { ids: [item.id], bulk_action: "delete", status: "trashed" }
    expect(Page.exists?(item.id)).to be(false)
  end
  it "rolls back the full batch if a page fails publication validation" do
    good = page("Ready")
    invalid = page("", status: "draft")
    post "/admin/pages/bulk", params: { ids: [good.id, invalid.id], bulk_action: "publish" }
    expect(response).to have_http_status(:see_other)
    expect(good.reload.status).to eq("draft")
    expect(invalid.reload.status).to eq("draft")
  end

end
