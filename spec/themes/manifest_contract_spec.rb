require "rails_helper"

RSpec.describe ThemePackages::Manifest do
  def manifest(overrides = {})
    {
      "format" => "inkwell-theme-v1", "slug" => "customer-app", "name" => "Customer App", "kind" => "static",
      "public" => "dist",
      "routes" => { "/" => "index.html", "/blog" => "blog.html", "/blog/:slug" => "post.html", "/authors/:slug" => "author.html" },
      "spa_fallback" => "index.html",
      "asset_prefix" => "/__inkwell_assets__/",
      "inkwell" => {
        "contract" => "1",
        "parts" => { "header" => "header", "footer" => "footer", "navigation" => "navigation", "comments" => "comments" },
        "templates" => { "blog_index" => "blog", "blog_post" => "post", "author" => "author", "search" => "search", "404" => "not_found" },
        "content_types" => %w[posts pages authors comments categories tags],
        "editable_regions" => { "homepage_hero" => { "type" => "rich_text", "builder" => true }, "featured_posts" => { "type" => "query", "builder" => true } }
      }
    }.deep_merge(overrides)
  end

  it "accepts the documented contract" do
    parsed = described_class.new(manifest)
    expect(parsed.contract_version).to eq("1")
    expect(parsed.parts.keys).to eq(%w[header footer navigation comments])
    expect(parsed.runtime).to eq("server_injected")
  end

  it "keeps every existing v1 manifest valid" do
    Dir.glob(Rails.root.join("app/themes/*/theme.json")).each do |file|
      data = JSON.parse(File.read(file))
      next unless data["format"] == "inkwell-theme-v1"

      expect { described_class.new(data) }.not_to raise_error, file
    end
  end

  it "ignores unknown future keys but rejects malformed known keys" do
    expect { described_class.new(manifest("inkwell" => { "contract" => "1", "future" => { "x" => 1 } })) }.not_to raise_error
    expect { described_class.new(manifest("inkwell" => [])) }.to raise_error(ThemePackages::Invalid, /object/)
    expect { described_class.new(manifest("inkwell" => { "contract" => "99" })) }.to raise_error(ThemePackages::Invalid, /contract/)
    expect { described_class.new(manifest("inkwell" => { "contract" => "1", "content_types" => ["secrets"] })) }.to raise_error(ThemePackages::Invalid, /content_types/)
    expect { described_class.new(manifest("inkwell" => { "contract" => "1", "editable_regions" => { "Hero" => { "type" => "rich_text" } } })) }.to raise_error(ThemePackages::Invalid, /key/)
    expect { described_class.new(manifest("inkwell" => { "contract" => "1", "editable_regions" => { "hero" => { "type" => "ruby" } } })) }.to raise_error(ThemePackages::Invalid, /type/)
    expect { described_class.new(manifest("inkwell" => { "contract" => "1", "parts" => { "header" => "../secret" } })) }.to raise_error(ThemePackages::Invalid, /safe relative path/)
  end

  it "rejects reserved namespaces declared as theme routes" do
    expect { described_class.new(manifest("routes" => { "/admin" => "index.html" })) }.to raise_error(ThemePackages::Invalid, /reserved/)
    expect { described_class.new(manifest("routes" => { "/theme-islands/comments" => "index.html" })) }.to raise_error(ThemePackages::Invalid, /reserved/)
    expect { described_class.new(manifest("routes" => { "/api/v1/posts" => "index.html" })) }.to raise_error(ThemePackages::Invalid, /reserved/)
  end

  it "rejects executable server declarations" do
    expect { described_class.new(manifest("controllers" => { "app" => "x" })) }.to raise_error(ThemePackages::Invalid, /controllers/)
    expect { described_class.new(manifest("inkwell" => { "contract" => "1", "migrations" => [] })) }.to raise_error(ThemePackages::Invalid, /executable/)
  end

  it "rejects unsafe region/template declarations at runtime" do
    expect { described_class.new(manifest("inkwell" => { "contract" => "1", "templates" => { "blog-index" => "blog" } })) }.to raise_error(ThemePackages::Invalid, /key/)
    expect { described_class.new(manifest("inkwell" => { "contract" => "1", "templates" => { "blog" => "/absolute" } })) }.to raise_error(ThemePackages::Invalid, /safe relative path/)
  end
end
