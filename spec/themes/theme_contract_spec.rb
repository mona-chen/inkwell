require "rails_helper"

# `ThemeManager` prepends the theme's directory to the view resolver, and Rails silently falls
# back to core `app/views` for anything the theme omits. That fallback only rescues us for the
# templates core actually ships — `posts/template`, `posts/template_index` (the page-builder
# overrides) and `errors/not_found`. Everywhere else the controller renders the theme's template
# directly, with no `rescue ActionView::MissingTemplate`, so a theme that omits one raises a 500
# the moment it goes active. That is exactly how `mono` broke `/posts` and `/authors/:id` while
# `default` looked fine.
#
# This pins the contract for every theme on disk, so the next theme can't merge half-built and
# regress a route that was working a theme-switch ago.
THEME_REQUIRED_TEMPLATES = {
  "layouts/application" => "the theme's own document shell (otherwise core's scaffold layout leaks in)",
  "site/home" => "SiteController#home renders it directly",
  "posts/index" => "PostsController#index renders it directly",
  "posts/show" => "PostsController#show renders it directly",
  "authors/show" => "AuthorsController#show renders it directly",
  "pages/default" => "PagesController's MissingTemplate rescue target"
}.freeze

RSpec.describe "Theme template contract" do
  theme_dirs = Dir.glob(Rails.root.join("app/themes/*")).select { |path| File.directory?(path) }

  it "ships at least one theme" do
    expect(theme_dirs).not_to be_empty
  end

  theme_dirs.sort.each do |theme_dir|
    slug = File.basename(theme_dir)

    context "the #{slug} theme" do
      THEME_REQUIRED_TEMPLATES.each do |template, reason|
        it "defines #{template} (#{reason})" do
          expect(File).to exist(File.join(theme_dir, "#{template}.html.erb"))
        end
      end

      it "ships a parseable theme.json with a name" do
        expect(File).to exist(File.join(theme_dir, "theme.json"))
        expect(ThemeManager.manifest(slug)["name"]).to be_present
      end

      # The manifest is what the Appearance screen and the page editor offer as page templates.
      # `SiteController#home` renders `pages/#{template}` for a designated front page with no
      # rescue, so advertising a template the theme doesn't ship can 500 the home page.
      it "ships every page template its manifest advertises" do
        advertised = Array(ThemeManager.manifest(slug).dig("templates", "page"))
        missing = advertised.reject { |name| File.exist?(File.join(theme_dir, "pages", "#{name}.html.erb")) }

        expect(missing).to be_empty, "theme.json advertises #{missing.join(', ')} with no pages/<name>.html.erb"
      end
    end
  end
end
