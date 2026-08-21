require "rails_helper"

RSpec.describe "Newsletter subscribe", type: :request do
  let(:site) { Site.create!(name: "Test Site", domain: "example.test") }
  before { allow(Current).to receive(:site).and_return(site) }

  it "subscribes and redirects to the site home" do
    post "/plugins/newsletter/subscribers", params: { email: "test@example.com" }
    expect(response).to have_http_status(:redirect)
    expect(URI.parse(response.location).path).to eq("/")
    expect(Newsletter::Subscriber.count).to eq(1)
  end

  it "rejects a blank email and redirects back" do
    post "/plugins/newsletter/subscribers", params: { email: "" }
    expect(response).to have_http_status(:redirect)
    expect(Newsletter::Subscriber.count).to eq(0)
  end
end
