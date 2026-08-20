ActiveRecord::Base.transaction do
  admin_role = Role.find_or_create_by!(name: "admin") { |r| r.capabilities = Role::CAPABILITIES }
  editor_role = Role.find_or_create_by!(name: "editor") { |r| r.capabilities = %w[publish_posts edit_others_posts edit_pages upload_media moderate_comments] }
  Role.find_or_create_by!(name: "author") { |r| r.capabilities = %w[publish_posts upload_media] }
  Role.find_or_create_by!(name: "subscriber") { |r| r.capabilities = [] }

  site = Site.find_or_create_by!(domain: "localhost:3000") do |s|
    s.name = "Inkwell Demo"
    s.active_theme = "default"
  end

  admin = User.find_or_create_by!(email: "admin@inkwell.test") do |u|
    u.name = "Site Admin"
    u.password = "password123"
    u.site = site
    u.role = admin_role
  end

  writer = User.find_or_create_by!(email: "writer@inkwell.test") do |u|
    u.name = "Sample Writer"
    u.password = "password123"
    u.site = site
    u.role = editor_role
  end

  design = Term.find_or_create_by!(site: site, taxonomy: "category", slug: "design") { |t| t.name = "Design" }
  Term.find_or_create_by!(site: site, taxonomy: "category", slug: "engineering") { |t| t.name = "Engineering" }

  post = site.posts.find_or_create_by!(slug: "hello-inkwell") do |p|
    p.title = "Hello, Inkwell"
    p.author = writer
    p.status = "published"
    p.excerpt = "The first post on a fresh Inkwell install."
    p.content = [
      { "type" => "heading", "data" => { "level" => 2, "text" => "Welcome" } },
      { "type" => "paragraph", "data" => { "text" => "This post is stored as structured blocks, not an HTML blob — open it in the admin editor to see how each block maps to real, reorderable fields." } },
      { "type" => "quote", "data" => { "text" => "Content is data, not a string full of shortcodes.", "attribution" => "Inkwell's design notes" } },
    ]
  end
  post.terms << design unless post.terms.include?(design)

  site.pages.find_or_create_by!(slug: "about") do |p|
    p.title = "About"
    p.author = admin
    p.status = "published"
    p.content = [{ "type" => "paragraph", "data" => { "text" => "This is a page, rendered through the same block renderer as posts." } }]
  end

  header_menu = site.menus.find_or_create_by!(location: "header") { |m| m.name = "Header" }
  header_menu.menu_items.find_or_create_by!(label: "About") { |i| i.url = "/pages/about"; i.position = 0 }

  puts "Seeded: admin@inkwell.test / password123"
end
