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
end
