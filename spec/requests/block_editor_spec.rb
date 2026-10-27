require "rails_helper"

RSpec.describe "Block editor patterns", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:role) { Role.create!(name: "admin") }
  let(:site) { Site.create!(name: "Test Site", domain: "example.test") }
  let(:user) { User.create!(name: "Admin", email: "admin@example.com", password: "password123", site: site, role: role) }

  before { sign_in user }

  it "keeps draft and publish actions visible in the editor toolbar" do
    post = Post.create!(title: "Publishable post", site: site, author: user, status: "draft")

    get edit_admin_post_path(post)

    expect(response).to have_http_status(:ok)
    expect(response.body).to include('id="post-editor-form"')
    expect(response.body).to include('name="save_draft"')
    expect(response.body).to include('formaction="/admin/posts/publishable-post/publish"')
    expect(response.body).to include(">Publish<")
  end

  it "keeps a draft reachable after autosaving its title and settings" do
    post = Post.create!(title: "Original title", site: site, author: user, status: "draft")
    original_slug = post.slug
    patch admin_post_path(post), params: { post: { title: "Revised title", excerpt: "A useful summary", draft_content: [{ type: "paragraph", data: { text: "Working copy" } }].to_json } }, headers: { "Accept" => "application/json" }
    expect(response).to have_http_status(:ok)
    expect(post.reload.slug).to eq(original_slug)
    expect(post.title).to eq("Revised title")
    expect(post.excerpt).to eq("A useful summary")
    expect(post.editing_blocks.first.dig("data", "text")).to eq("Working copy")
    get edit_admin_post_path(original_slug)
    expect(response).to have_http_status(:ok)
  end

  it "does not duplicate list blocks with a rendered preview" do
    post = Post.create!(title: "List post", site: site, author: user, status: "draft",
      content: [ { "type" => "list", "data" => { "ordered" => false, "items" => "One\nTwo" } } ])

    get edit_admin_post_path(post)

    expect(response).to have_http_status(:ok)
    expect(response.body).not_to include("Rendered preview")
    expect(response.body).to include('data-list-block-target="preview"')
    expect(response.body).to include('aria-hidden="true"')
  end

  it "renders the Patterns picker section with every registered pattern" do
    post = Post.create!(title: "Patterned post", site: site, author: user, status: "draft")

    get edit_admin_post_path(post)
    expect(response).to have_http_status(:ok)

    body = response.body
    expect(body).to include(">Patterns<")
    BlockRenderer.patterns.each do |name, pattern|
      expect(body).to include(%(data-block-editor-pattern-param="#{name}"))
      expect(body).to include(%(id="pattern-template-#{name}"))
      expect(body).to include(pattern["title"])
    end
  end

  it "pre-fills pattern blocks with their default data in the hidden template" do
    get new_admin_post_path
    body = response.body

    hero = body[%r{<template id="pattern-template-hero">(.*?)</template>}m, 1]
    expect(hero).to include('data-type="heading"')
    expect(Nokogiri::HTML.fragment(hero).at_css('textarea[data-field="text"]').text).to eq('Big headline here')
    expect(hero).to include('data-type="button"')
    expect(hero).to include('value="Get started"')
  end

  it "retains heading levels and reactive selectors for callout/button/list" do
    post = Post.create!(title: "Selectors post", site: site, author: user, status: "draft",
      content: [
        { "type" => "heading", "data" => { "level" => 3, "text" => "Hi" } },
        { "type" => "callout", "data" => { "tone" => "warning", "text" => "Careful" } },
        { "type" => "button", "data" => { "style" => "secondary", "label" => "Go", "url" => "https://x" } },
        { "type" => "list", "data" => { "ordered" => true, "items" => "a\nb" } }
      ])

    get edit_admin_post_path(post)
    expect(response).to have_http_status(:ok)
    body = response.body

    expect(body.scan('data-controller="choice-field"').size).to be >= 3
    # Heading editing retains its saved level independently of the textarea.
    expect(body).to include('class="heading-preview' )
    expect(body).to match(/data-field="level"[^>]*value="3"/)
    # callout tone buttons + hidden tone input
    expect(body).to include('data-preview-class="tone-warning"')
    expect(body).to match(/data-field="tone"[^>]*value="warning"/)
    # button style + list ordered toggle
    expect(body).to include('data-preview-class="btn-secondary"')
    expect(body).to include('data-value="true"')
    expect(body).to include('data-value="false"')
  end

  it "renders the Gutenberg-style image block with drop zone and per-block picker frame" do
    post = Post.create!(title: "Image post", site: site, author: user, status: "draft",
      content: [ { "type" => "image", "data" => { "url" => "/assets/x.png", "alt" => "A", "caption" => "" } },
                { "type" => "image", "data" => { "url" => "", "alt" => "", "caption" => "" } } ])

    get edit_admin_post_path(post)
    expect(response).to have_http_status(:ok)
    body = response.body

    expect(body.scan('data-controller="image-block"').size).to be >= 2
    expect(body).to include("Drag &amp; drop an image here")
    expect(body).to include("data-image-block-target=\"dropzone\"")
    expect(body).to include(">Replace<")
    expect(body).to include(">Remove<")
    expect(body).to include("data-image-block-target=\"url\"")

    # Every image block (rendered blocks + the hidden add-new template) gets its own unique
    # picker frame id so picker events never collide across blocks.
    frame_ids = body.scan(/<turbo-frame id="(media-picker-frame-[a-f0-9]+)"/).flatten
    expect(frame_ids.size).to be >= 2
    expect(frame_ids.uniq.size).to eq(frame_ids.size)
  end
end
