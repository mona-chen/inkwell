require "rails_helper"

RSpec.describe ThemeRuntime::ContentHtml do
  def html(*blocks) = described_class.render(blocks)

  it "renders accessible comparison tables with icons, highlights and safe inline text" do
    out = html({ "type" => "table", "data" => { "caption" => "At a glance", "columns" => %w[Feature Ruut Other], "highlight" => 1, "rows" => [ [ "Inbox", "✓", "no" ], [ "Price", "**₦10,000**", "<script>x</script>" ] ], "note" => "Checked [today](https://example.com)" } })
    doc = Nokogiri::HTML.fragment(out)
    expect(doc.at_css("figure.ink-table caption").text).to eq("At a glance")
    expect(doc.css("thead th").map { |th| th["scope"] }).to all(eq("col"))
    expect(doc.css("tbody th[scope=row]").map(&:text)).to eq(%w[Inbox Price])
    expect(doc.css("td.is-highlighted").size).to eq(2)
    expect(doc.at_css(".ink-mark--yes")["aria-label"]).to eq("Yes")
    expect(doc.at_css(".ink-mark--no")).to be_present
    expect(out).to include("<strong>₦10,000</strong>", "&lt;script&gt;")
    expect(doc.at_css(".ink-table__note a")["href"]).to eq("https://example.com")
  end

  it "anchors headings uniquely and builds the table of contents and FAQ data" do
    result = described_class.analyze([
      { "type" => "heading", "data" => { "level" => 2, "text" => "Pricing" } },
      { "type" => "heading", "data" => { "level" => 3, "text" => "Pricing" } },
      { "type" => "faq", "data" => { "items" => [ { "question" => "Why?", "answer" => "Because *it works*." } ] } },
      { "type" => "rich_text", "data" => { "json" => { "type" => "doc", "content" => [ { "type" => "heading", "attrs" => { "level" => 2 }, "content" => [ { "type" => "text", "text" => "Bold", "marks" => [ { "type" => "bold" } ] } ] } ] } } }
    ])
    expect(result["toc"].map { |entry| [ entry["id"], entry["level"] ] }).to eq([ [ "pricing", 2 ], [ "pricing-2", 3 ], [ "frequently-asked-questions", 2 ], [ "bold", 2 ] ])
    expect(result["html"]).to include('<h2 id="bold"><strong>Bold</strong></h2>')
    expect(result["faq"]).to eq([ { "question" => "Why?", "answer" => "Because it works." } ])
  end

  it "drops unsafe URLs and only embeds allow-listed video providers" do
    expect(html({ "type" => "cta", "data" => { "title" => "Go", "primary_label" => "x", "primary_url" => "javascript:alert(1)" } })).to eq("")
    expect(html({ "type" => "image", "data" => { "url" => "data:image/png;base64,AAAA", "alt" => "" } })).to eq("")
    expect(html({ "type" => "paragraph", "data" => { "text" => "[bad](javascript:void0)" } })).to eq("<p>bad</p>")
    expect(html({ "type" => "embed", "data" => { "url" => "https://youtu.be/dQw4w9WgXcQ" } })).to include('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"')
    expect(html({ "type" => "embed", "data" => { "url" => "https://evil.example/x" } })).to include("ink-embed--link")
    expect(html({ "type" => "embed", "data" => { "url" => "https://evil.example/x" } })).not_to include("<iframe")
  end

  it "keeps legacy blocks working (newline lists, quote attribution, ordered lists)" do
    expect(html({ "type" => "list", "data" => { "items" => "One\nTwo", "ordered" => true } })).to eq('<ol class="ink-list"><li>One</li><li>Two</li></ol>')
    expect(html({ "type" => "quote", "data" => { "text" => "Hi", "attribution" => "Ada" } })).to include("<cite>Ada</cite>")
  end

  it "renders takeaways, stats, pros and cons, callouts and code" do
    out = html(
      { "type" => "takeaways", "data" => { "items" => [ "One" ] } },
      { "type" => "stats", "data" => { "items" => [ { "value" => "70%", "label" => "lower cost" } ] } },
      { "type" => "pros_cons", "data" => { "pros_title" => "Choose A if", "pros" => [ "Fast" ], "cons" => [ "Slow" ] } },
      { "type" => "callout", "data" => { "tone" => "tip", "text" => "Do it" } },
      { "type" => "code", "data" => { "language" => "ruby", "filename" => "app.rb", "code" => "puts 1 < 2" } }
    )
    expect(out).to include("ink-takeaways", 'data-count="1"', "Choose A if", "ink-callout--tip", "Tip", 'class="language-ruby"', "app.rb", "puts 1 &lt; 2")
  end
end
