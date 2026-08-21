xml.instruct! :xml, version: "1.0", encoding: "UTF-8"
xml.rss version: "2.0", "xmlns:atom" => "http://www.w3.org/2005/Atom" do
  xml.channel do
    xml.title Current.site.name
    xml.link root_url
    xml.description Current.site.setting("tagline")
    xml.language "en"
    xml.atom :link, href: "#{root_url.chomp('/')}/feed.xml", rel: "self", type: "application/rss+xml"

    @posts.each do |post|
      xml.item do
        xml.title post.title
        xml.link post_url(post)
        xml.guid post_url(post), isPermaLink: "true"
        xml.pubDate post.published_at&.rfc2822
        xml.author post.author.name
        xml.description do
          xml.cdata!(post.excerpt.presence || "")
        end
        if post.categories.any?
          post.categories.each { |c| xml.category c.name }
        end
      end
    end
  end
end
