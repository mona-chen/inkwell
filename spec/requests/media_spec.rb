require "rails_helper"

RSpec.describe "Media library", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:role) { Role.create!(name: "admin") }
  let(:site) { Site.create!(name: "Test Site", domain: "example.test") }
  let(:user) { User.create!(name: "Admin", email: "admin@example.com", password: "password123", site: site, role: role) }

  before { sign_in user }

  it "deletes a media item and purges its blob + file" do
    item = site.media_items.create!(uploaded_by: user, file: { io: StringIO.new("x"), filename: "gone.txt", content_type: "text/plain" })
    blob_id = item.file.blob_id
    expect(MediaItem.exists?(item.id)).to be true
    expect(ActiveStorage::Blob.exists?(blob_id)).to be true

    delete "/admin/media/#{item.id}"
    expect(response).to have_http_status(:redirect)

    expect(MediaItem.exists?(item.id)).to be false
    expect(ActiveStorage::Blob.exists?(blob_id)).to be false
  end

  it "returns a turbo stream that removes the item from the grid" do
    item = site.media_items.create!(uploaded_by: user, file: { io: StringIO.new("y"), filename: "remove.txt", content_type: "text/plain" })

    delete "/admin/media/#{item.id}", headers: { "Accept" => "text/vnd.turbo-stream.html" }
    expect(response).to have_http_status(:ok)
    expect(response.media_type).to eq("text/vnd.turbo-stream.html")
    expect(response.body).to include("turbo-stream action=\"remove\"")
    expect(response.body).to include("media_item_#{item.id}")
  end

  it "renders the media page with the sidebar upload zone" do
    get "/admin/media"
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Media library")
    expect(response.body).to include("Upload")
  end

  it "renders delete/update forms pointing at /admin/media/:id (not /admin/media.:id)" do
    item = site.media_items.create!(uploaded_by: user, file: { io: StringIO.new("z"), filename: "urlcheck.txt", content_type: "text/plain" })
    get "/admin/media"
    body = response.body
    expect(body).to include("/admin/media/#{item.id}")
    expect(body).not_to include("/admin/media.#{item.id}")
  end

  it "wraps the picker grid in the requesting turbo-frame id (fixes 'Content missing')" do
    site.media_items.create!(uploaded_by: user, file: { io: StringIO.new("w"), filename: "pick.jpg", content_type: "image/jpeg" })

    get "/admin/media?picker=1", headers: { "Turbo-Frame" => "featured-image-frame" }
    expect(response).to have_http_status(:ok)
    expect(response.body).to include('<turbo-frame id="featured-image-frame">')
    expect(response.body).to include('data-controller="media-picker-item"')
    expect(response.body).not_to include('<turbo-frame id="media-picker-frame">')
  end

  it "defaults the picker frame to media-picker-frame when Turbo-Frame header is absent" do
    get "/admin/media?picker=1"
    expect(response.body).to include('<turbo-frame id="media-picker-frame">')
  end

  it "returns JSON for direct image-block uploads (url + alt)" do
    post "/admin/media",
      params: { file: fixture_file_upload("test.png", "image/png") },
      headers: { "Accept" => "application/json" }

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body["url"]).to be_present
    expect(body["id"]).to be_present
    expect(site.media_items.count).to eq(1)
  end
end
