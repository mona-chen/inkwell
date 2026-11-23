require "rails_helper"

RSpec.describe "Public media delivery", type: :request do
  let!(:site) { Site.create!(name: "Media site", domain: "www.example.com", is_default: true) }
  let(:role) { Role.find_or_create_by!(name: "admin") }
  let(:user) { User.create!(name: "Admin", email: "media-delivery@example.test", password: "password123", site: site, role: role) }
  let!(:item) do
    site.media_items.create!(uploaded_by: user, file: {
      io: File.open(Rails.root.join("spec/fixtures/files/test.png")),
      filename: "test.png", content_type: "image/png"
    })
  end

  after { Current.reset }

  def follow_media_redirects
    4.times do
      break unless response.redirect?

      follow_redirect!
    end
  end

  it "delivers an uploaded image anonymously through blob and disk redirects" do
    get item.url
    expect(response).to redirect_to(%r{/rails/active_storage/blobs/redirect/})
    follow_media_redirects

    expect(response).to have_http_status(:ok)
    expect(response.media_type).to eq("image/png")
    expect(response.body.b).to eq(File.binread(Rails.root.join("spec/fixtures/files/test.png")))
  end

  it "delivers the thumbnail used by the media library" do
    get item.thumbnail_url
    follow_media_redirects

    expect(response).to have_http_status(:ok)
    expect(response.media_type).to eq("image/png")
    expect(response.body).to be_present
  end
end
