ActiveRecord::Base.transaction do
  admin_role = Role.find_or_create_by!(name: "admin") { |r| r.capabilities = Role::CAPABILITIES }
  editor_role = Role.find_or_create_by!(name: "editor") { |r| r.capabilities = %w[publish_posts edit_others_posts edit_pages upload_media moderate_comments] }
  Role.find_or_create_by!(name: "author") { |r| r.capabilities = %w[publish_posts upload_media] }
  Role.find_or_create_by!(name: "subscriber") { |r| r.capabilities = [] }

  site = Site.find_or_create_by!(domain: "localhost:3000") do |s|
    s.name = "Inkwell Demo"
    s.active_theme = "default"
  end

  # Site identity + homepage (static page front)
  site.set_setting!("site_title", "Inkwell Demo")
  site.set_setting!("tagline", "A modern home for words, design, and the craft of building for the web.")
  site.set_setting!("timezone", "UTC")
  site.set_setting!("posts_per_page", "9")
  site.set_setting!("comments_enabled", "1")

  admin = User.find_or_create_by!(email: "admin@inkwell.test") do |u|
    u.name = "Site Admin"
    u.password = "password123"
    u.site = site
    u.role = admin_role
  end

  writer = User.find_or_create_by!(email: "writer@inkwell.test") do |u|
    u.name = "Maya Okafor"
    u.password = "password123"
    u.site = site
    u.role = editor_role
  end

  designer = User.find_or_create_by!(email: "designer@inkwell.test") do |u|
    u.name = "Jonas Berg"
    u.password = "password123"
    u.site = site
    u.role = editor_role
  end

  # Categories
  design = Term.find_or_create_by!(site: site, taxonomy: "category", slug: "design") { |t| t.name = "Design" }
  engineering = Term.find_or_create_by!(site: site, taxonomy: "category", slug: "engineering") { |t| t.name = "Engineering" }
  culture = Term.find_or_create_by!(site: site, taxonomy: "category", slug: "culture") { |t| t.name = "Culture" }
  product = Term.find_or_create_by!(site: site, taxonomy: "category", slug: "product") { |t| t.name = "Product" }

  # ---- Posts ----
  posts = {
    "crafting-calm-interfaces" => {
      title: "Crafting calm interfaces",
      author: writer, category: design,
      excerpt: "The quiet details that make a product feel considered — and why restraint is the hardest skill in design.",
      days_ago: 2,
      content: [
        { "type" => "heading", "data" => { "level" => 2, "text" => "Less, but better" } },
        { "type" => "paragraph", "data" => { "text" => "Every interface is a set of decisions. The ones we leave out matter as much as the ones we keep. Calm products don't shout — they make room for the work at hand." } },
        { "type" => "quote", "data" => { "text" => "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.", "attribution" => "Antoine de Saint-Exupéry" } },
        { "type" => "paragraph", "data" => { "text" => "Start with a single focused task. Give it generous whitespace. Let typography carry hierarchy instead of boxes and borders. Then remove one more thing." } },
        { "type" => "callout", "data" => { "text" => "A quiet UI is a confident UI. If everything demands attention, nothing earns it." } },
      ]
    },
    "rails-8-in-practice" => {
      title: "Rails 8 in practice: what's worth adopting today",
      author: writer, category: engineering,
      excerpt: "Solid Queue, Kamal, and the move toward boring, defaulted infrastructure — a field report from production.",
      days_ago: 6,
      content: [
        { "type" => "heading", "data" => { "level" => 2, "text" => "The defaults finally win" } },
        { "type" => "paragraph", "data" => { "text" => "For a decade the Rails community was told to swap out the defaults. Rails 8 flips that: the new defaults — Solid Queue, Solid Cache, Kamal — are genuinely production-grade." } },
        { "type" => "code", "data" => { "code" => "config.active_job.queue_adapter = :solid_queue\nconfig.cache_store = :solid_cache_store", "language" => "ruby" } },
        { "type" => "paragraph", "data" => { "text" => "No Redis. No sidekiq. No Kafka for a blog. The infrastructure that ships with the framework now covers the 90% case cleanly." } },
        { "type" => "heading", "data" => { "level" => 3, "text" => "What we adopted" } },
        { "type" => "list", "data" => { "items" => ["Solid Queue for background jobs", "Propshaft for assets", "Importmap for JavaScript", "Kamal for deployment"] } },
        { "type" => "paragraph", "data" => { "text" => "The biggest win wasn't any single feature — it was the confidence that boring, defaulted infrastructure lets the team focus on product." } },
      ]
    },
    "the-culture-of-small-teams" => {
      title: "The culture of small teams",
      author: designer, category: culture,
      excerpt: "Why the best software often comes from two or three people who trust each other and own outcomes.",
      days_ago: 12,
      content: [
        { "type" => "heading", "data" => { "level" => 2, "text" => "Small is a feature" } },
        { "type" => "paragraph", "data" => { "text" => "Small teams don't scale by adding people. They scale by removing ceremony. Fewer handoffs means the person who decides is the person who knows." } },
        { "type" => "quote", "data" => { "text" => "A small team that ships weekly beats a large team that syncs monthly.", "attribution" => "" } },
        { "type" => "paragraph", "data" => { "text" => "The enemy of small teams is not size — it's the slow accumulation of process that nobody remembers agreeing to." } },
      ]
    },
    "designing-for-reading" => {
      title: "Designing for reading",
      author: designer, category: design,
      excerpt: "Measure, line height, and the quiet art of making long-form content genuinely pleasant to consume.",
      days_ago: 20,
      content: [
        { "type" => "heading", "data" => { "level" => 2, "text" => "The reading column" } },
        { "type" => "paragraph", "data" => { "text" => "A comfortable measure is roughly 45–75 characters. Shorter and the eye tires; longer and it loses its place. This is not a rule — it's a physical fact about how we read." } },
        { "type" => "paragraph", "data" => { "text" => "Line height does more work than font size. A generous 1.7–1.9 line height makes a long article feel light. Serif headlines carry personality; sans-serif body text carries clarity." } },
        { "type" => "button", "data" => { "text" => "Read the full piece", "url" => "#" } },
      ]
    },
    "shipping-product-without-drama" => {
      title: "Shipping product without drama",
      author: writer, category: product,
      excerpt: "A playbook for small releases: scope the slice, protect the cadence, and let quality be the definition of done.",
      days_ago: 28,
      content: [
        { "type" => "heading", "data" => { "level" => 2, "text" => "Drama is a tax" } },
        { "type" => "paragraph", "data" => { "text" => "Most release drama comes from surprises discovered late. The cure is boring: smaller slices, shipped often, with a definition of done that includes QA." } },
        { "type" => "list", "data" => { "items" => ["Ship the smallest useful slice", "Keep the cadence sacred", "Treat 'done' as 'released and observed'", "Write the changelog as you go"] } },
        { "type" => "paragraph", "data" => { "text" => "Drama-free shipping is a habit, not a tool. Once the team feels it, nobody wants to go back." } },
      ]
    },
    "notes-on-building-a-cms" => {
      title: "Notes on building a CMS in 2026",
      author: writer, category: engineering,
      excerpt: "Structured content, a real block editor, and the case for owning the tool you publish with.",
      days_ago: 40,
      content: [
        { "type" => "heading", "data" => { "level" => 2, "text" => "Why build your own?" } },
        { "type" => "paragraph", "data" => { "text" => "The publishing layer of the web is stuck on a decade-old architecture. A modern CMS treats content as structured blocks, renders them safely, and ships fast." } },
        { "type" => "callout", "data" => { "text" => "Content is data, not a string full of shortcodes." } },
        { "type" => "paragraph", "data" => { "text" => "Blocks make editing honest: what you see is structured data that renders predictably — no arbitrary HTML soup, no injection risk, no layout surprises." } },
      ]
    },
  }

  posts.each do |slug, opts|
    post = site.posts.find_or_create_by!(slug: slug) do |p|
      p.title = opts[:title]
      p.author = opts[:author]
      p.status = "published"
      p.published_at = opts[:days_ago].days.ago
      p.excerpt = opts[:excerpt]
      p.content = opts[:content]
    end
    post.update!(published_at: opts[:days_ago].days.ago) if post.persisted?
    post.terms << opts[:category] unless post.terms.include?(opts[:category])
  end

  # ---- Pages ----
  about_page = site.pages.find_or_create_by!(slug: "about") do |p|
    p.title = "About"
    p.author = admin
    p.status = "published"
    p.content = [
      { "type" => "heading", "data" => { "level" => 2, "text" => "About Inkwell" } },
      { "type" => "paragraph", "data" => { "text" => "Inkwell is a modern publishing platform built on Rails. It treats content as structured blocks, ships a real drag-and-drop page builder, and keeps the tooling boring so writers can focus on words." } },
      { "type" => "paragraph", "data" => { "text" => "We believe the CMS should get out of the way — fast to load, pleasant to edit, and safe to publish." } },
    ]
  end

  contact_page = site.pages.find_or_create_by!(slug: "contact") do |p|
    p.title = "Contact"
    p.author = admin
    p.status = "published"
    p.content = [
      { "type" => "heading", "data" => { "level" => 2, "text" => "Get in touch" } },
      { "type" => "paragraph", "data" => { "text" => "Questions, ideas, or just saying hello — we read everything. Reach us at hello@inkwell.test." } },
    ]
  end

  # Homepage shows the editorial landing page (hero + featured + latest grid).
  # Switch to a static page via Settings → Reading → Homepage if you prefer.
  site.set_setting!("show_on_front", "posts")

  # ---- Menus ----
  header_menu = site.menus.find_or_create_by!(location: "header") { |m| m.name = "Header" }
  [["Home", "/", 0], ["About", "/pages/about", 1], ["Contact", "/pages/contact", 2]].each do |label, url, pos|
    header_menu.menu_items.find_or_create_by!(label: label, url: url) { |i| i.position = pos }
  end

  footer_menu = site.menus.find_or_create_by!(location: "footer") { |m| m.name = "Footer" }
  [["About", "/pages/about", 0], ["Contact", "/pages/contact", 1], ["Home", "/", 2]].each do |label, url, pos|
    footer_menu.menu_items.find_or_create_by!(label: label, url: url) { |i| i.position = pos }
  end

  puts "Seeded Inkwell Demo:"
  puts "  admin@inkwell.test / password123"
  puts "  #{site.posts.count} posts, #{site.pages.count} pages, #{Term.where(taxonomy: 'category').count} categories"
  puts "  Front page: About · header/footer menus configured"
end
