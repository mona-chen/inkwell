# frozen_string_literal: true
module Admin
  class ThemesPage < ApplicationComponent
    def initialize(themes:, active_theme:, tab: "installed", install_method: "github")
      @themes, @active_theme = themes, active_theme
      @tab = %w[installed add github].include?(tab) ? tab : "installed"
      @install_method = install_method == "zip" ? "zip" : "github"
    end

    def view_template
      div(class: "theme-hub") do
        header(class: "theme-hub-heading") do
          div do
            h1 { "Themes" }
            p { "Manage your site’s appearance and its deployments." }
          end
          if Current.user&.admin?
            render Button.new("Add theme", href: admin_themes_path(tab: "add"), variant: :primary, size: :sm, icon: :plus)
          end
        end
        render DesignNavigation.new(current: "themes")
        nav(class: "theme-hub-tabs", aria: { label: "Theme management" }) do
          [["installed", "Installed"], ["add", "Add theme"], ["github", "GitHub connection"]].each do |key, label|
            next if key != "installed" && !Current.user&.admin?
            a(href: admin_themes_path(tab: key), aria: { current: @tab == key ? "page" : nil }) { label }
          end
        end
        if !Current.user&.admin? || @tab == "installed"
          installed
        elsif @tab == "github"
          github_connection
        else
          add_theme
        end
      end
    end

    private

    def installed
      div(class: "theme-section-heading") do
        div { h2 { "Installed themes" }; p { "#{@themes.size} available · preview before activating" } }
      end
      div(class: "themes-cards") { @themes.each { |theme| theme_card(theme) } }
      sources = Current.site.theme_repository_sources.order(id: :desc)
      return unless Current.user&.admin? && sources.any?
      div(class: "theme-section-heading theme-deploy-heading") do
        div { h2 { "Repository deployments" }; p { "Track releases and control what goes live." } }
      end
      div(class: "theme-deployment-list") { sources.each { |source| repository_row(source) } }
    end

    def add_theme
      div(class: "theme-install-layout") do
        aside(class: "theme-install-nav") do
          h2 { "Add a theme" }
          p { "Choose where your theme comes from." }
          [["github", "GitHub repository", :git_branch], ["zip", "ZIP package", :upload]].each do |method, label, icon|
            a(href: admin_themes_path(tab: "add", method: method), aria: { current: @install_method == method ? "page" : nil }) do
              render Icon.new(icon, size: :sm)
              span { label }
              render Icon.new(:chevron_right, size: :xs)
            end
          end
        end
        section(class: "theme-panel") { @install_method == "zip" ? zip_form : repository_form }
      end
    end

    def repository_form
      panel_heading("Install from GitHub", "Connect a repository and deploy from a branch.", :git_branch)
      connection = Current.site.github_app_connection
      div(class: "theme-provider-status") do
        render Icon.new(connection&.connected? ? :check : :plug, size: :sm)
        div do
          strong { connection&.connected? ? "Connected as #{connection.account_login}" : "GitHub is not connected" }
          p { connection&.connected? ? "Only repositories you granted access to are available." : "Connect a GitHub App for private repositories and push-triggered updates." }
        end
        render Button.new(connection&.connected? ? "Manage" : "Connect GitHub", href: admin_themes_path(tab: "github"), variant: :outline, size: :sm)
      end
      form_with(url: admin_theme_repository_sources_path, scope: :theme_repository_source, builder: Ink::FormBuilder, html: { class: "theme-form" }, data: { controller: "repository-picker" }) do |form|
        if connection&.connected? && connection.repositories.any?
          form.hidden_field(:github_app_connection_id, value: connection.id)
          choices = connection.repositories.map { |repo| ["#{repo['full_name']} · #{repo['default_branch']}", repo['full_name'], { "data-default-branch" => repo['default_branch'] }] }
          render Ink::SearchableSelect.new(form: form, name: :repository, label: "Repository", options: choices, prompt: "Choose a repository", source_action: "change->repository-picker#select")
        else
          form.field(:repository, label: "Public repository URL", control_html: { placeholder: "https://github.com/your-team/site-theme", required: true })
          p(class: "theme-field-help") { "Public repositories work without connecting an App. Private repos need a GitHub connection." }
        end
        form.field(:branch, label: "Deploy branch", value: "main", control_html: { required: true, data: { repository_picker_target: "branch" } })
        fieldset(class: "theme-options-group") do
          legend { "Deployment preferences" }
          form.field(:auto_update, as: :switch, label: "Keep up with new commits")
          p { "Verified push events trigger updates. Scheduled checks run every five minutes as a fallback." }
          form.field(:auto_activate, as: :switch, label: "Automatically activate ready releases")
          p { "Leave this off to review each release before it changes your site." }
        end
        details(class: "theme-advanced") do
          summary { "Advanced routing" }
          form.field(:spa, as: :switch, label: "Client-side routing without a manifest")
          p { "For prebuilt single-page applications. Manifest routing takes precedence." }
        end
        div(class: "theme-form-actions") do
          p { "Requires theme.json or a static index.html. Commit built assets to the deploy branch." }
          render Button.new("Install theme", type: :submit, variant: :primary, size: :sm, icon: :download)
        end
      end
    end

    def zip_form
      panel_heading("Upload a theme package", "Install a Rails theme, static site, or prebuilt app.", :package)
      form_with(url: import_admin_themes_path, multipart: true, builder: Ink::FormBuilder, html: { class: "theme-form" }, data: { turbo: false }) do |form|
        div(class: "theme-upload-field") do
          render Icon.new(:upload, size: :lg)
          form.label(:archive, "Choose a ZIP package")
          form.file_field(:archive, accept: ".zip", required: true)
          p { "Up to 200 MB · Rails + Hotwire · HTML / CSS / JS · prebuilt bundles" }
        end
        details(class: "theme-advanced") do
          summary { "Advanced routing" }
          form.field(:spa, as: :switch, label: "Enable client-side routing")
          p { "For single-page apps without a theme.json manifest." }
        end
        div(class: "theme-form-actions") do
          p { "Install first. Preview before going live." }
          render Button.new("Import theme", type: :submit, variant: :primary, size: :sm, icon: :download)
        end
      end
    end

    def github_connection
      connection = Current.site.github_app_connection
      section(class: "theme-panel theme-github-panel") do
        panel_heading("GitHub connection", "Use a GitHub App instead of managing a personal access token.", :plug)
        div(class: "theme-setup-steps") do
          [["1", "Create your App", "Inkwell prepares its permissions and callback URLs."], ["2", "Choose repository access", "Install it on your account or organization."], ["3", "Install a theme", "Select a repository and a deployment branch."]].each do |number, title, text|
            div { span(class: "theme-step-number") { number }; div { strong { title }; p { text } } }
          end
        end
        if connection
          div(class: "theme-provider-status") do
            render Icon.new(connection.connected? ? :check : :plug, size: :md)
            div do
              strong { connection.connected? ? "#{connection.account_login} is connected" : "App created · installation needed" }
              p { "#{connection.slug} · App #{connection.app_id}" }
            end
            render Badge.new(connection.connected? ? "Connected" : "Setup required", color: connection.connected? ? :success : :neutral)
          end
          div(class: "theme-connection-actions") do
            render ButtonTo.new(connection.connected? ? "Manage repository access" : "Install on GitHub", href: install_admin_github_connection_path, method: :post, data: { turbo: false }, variant: :primary, size: :sm, icon: :external_link)
            if connection.connected?
              render ButtonTo.new("Refresh repositories", href: refresh_admin_github_connection_path, method: :post, variant: :outline, size: :sm, icon: :refresh_cw)
              render ButtonTo.new("Disconnect", href: admin_github_connection_path, method: :delete, variant: :ghost, size: :sm, data: { turbo_confirm: "Disconnect this account and pause automatic theme deployments?" })
            end
          end
          if connection.repositories.any?
            h3(class: "theme-repo-list-title") { "#{connection.repositories.size} accessible repositories" }
            div(class: "theme-access-list") do
              connection.repositories.each do |repo|
                div { span { repo["full_name"] }; span { repo["private"] ? "Private" : "Public" } }
              end
            end
            render Button.new("Choose a theme repository", href: admin_themes_path(tab: "add"), variant: :outline, size: :sm)
          end
        else
          div(class: "theme-connection-actions") do
            render ButtonTo.new("Create GitHub App", href: manifest_admin_github_connection_path, method: :post, data: { turbo: false }, variant: :primary, size: :sm, icon: :external_link)
          end
          unless GithubApps::Setup.public_url(helpers.request.base_url)
            p(class: "theme-field-help") { "Complete setup on your public HTTPS deployment or an HTTPS tunnel. GitHub needs a reachable webhook and callback URL." }
          end
        end
        div(class: "theme-connection-footnote") do
          render Icon.new(:lock, size: :sm)
          p { "Read-only repository access. App keys are encrypted, and installation tokens are generated only when needed." }
        end
      end
    end

    def repository_row(source)
      article(class: "theme-deployment") do
        div(class: "theme-deployment-summary") do
          render Icon.new(:git_branch, size: :md)
          div(class: "theme-deployment-identity") do
            h3 { source.repository }
            p { "#{source.branch} · #{source.deployed_sha&.first(8) || 'No release yet'}" }
          end
          render Badge.new(source.status.humanize, color: source.status == "failed" ? :destructive : :neutral, size: :xs)
          render ButtonTo.new("Sync", href: sync_admin_theme_repository_source_path(source), method: :post, variant: :outline, size: :sm, icon: :refresh_cw)
          render Button.new("Preview", href: preview_admin_theme_path(source.installed_slug), variant: :ghost, size: :sm) if source.installed_slug
        end
        p(class: "theme-deployment-error") { source.error_message } if source.error_message.present?
        details(class: "theme-deployment-details", open: source.status == "needs_build") do
          summary { "Edit deploy branch, settings & release history" }
          div(class: "theme-deployment-body") do
            form_with(url: admin_theme_repository_source_path(source), method: :patch, builder: Ink::FormBuilder, scope: "repository_#{source.id}") do |form|
              form.field(:branch, label: "Deploy branch", value: source.branch, control_html: { required: true })
              p(class: "theme-field-help") { "Choose a branch containing built theme files. Source-only branches cannot be activated. Changing branches queues an install and pauses automatic activation." }
              form.field(:auto_update, as: :switch, label: "Automatic updates", checked: source.auto_update)
              form.field(:auto_activate, as: :switch, label: "Automatic activation", checked: source.auto_activate)
              render Button.new("Save preferences", type: :submit, variant: :secondary, size: :sm)
            end
            div(class: "theme-release-list") do
              source.releases.reverse.each do |release|
                div do
                  code { release["sha"].first(8) }
                  span { release["slug"] == @active_theme ? "Live" : "Installed" }
                  render Button.new("Preview", href: preview_admin_theme_path(release["slug"]), variant: :ghost, size: :sm)
                  render ButtonTo.new("Activate", href: activate_admin_theme_repository_source_path(source, slug: release["slug"]), method: :post, variant: :outline, size: :sm)
                end
              end
            end
          end
        end
      end
    end

    def theme_card(theme)
      slug = theme[:slug]
      active = slug == @active_theme
      manifest = ThemeManager.manifest(slug)
      ready = !ThemePackages::Runtime.for(slug)&.readiness_errors&.any?
      article(class: "themes-card theme-library-card#{active ? ' is-active' : ''}") do
        div(class: "theme-card-preview #{slug == 'mono' ? 'theme-card-preview-mono' : ''}", aria: { hidden: true }) do
          div(class: "theme-preview-masthead") { span { Current.site.name }; render Icon.new(:menu, size: :xs) }
          div(class: "theme-preview-title") { theme[:name] || slug.titleize }
          p { manifest["kind"] == "static" ? "Frontend theme" : "Journal & pages" }
          div(class: "theme-preview-rule")
        end
        div(class: "themes-card-content") do
          div(class: "themes-card-title") do
            h3 { theme[:name] || slug.titleize }
            render Badge.new("Active", color: :success, size: :xs) if active
            render Badge.new("Needs build", color: :neutral, size: :xs) unless ready
          end
          p(class: "themes-description") { theme[:description] || "#{manifest['kind']&.capitalize || 'Rails'} theme package" }
        end
        footer(class: "themes-card-footer") do
          render Button.new("Preview", href: preview_admin_theme_path(slug), variant: :ghost, size: :sm, icon: :eye)
          if active
            span(class: "themes-current") { "Currently live" }
          elsif ready
            render ButtonTo.new("Activate", href: activate_admin_theme_path(slug), method: :post, variant: :outline, size: :sm)
          end
          if !active && Current.user&.admin? && !ThemePackages::Remover::PROTECTED.include?(slug)
            render ButtonTo.new("Delete", href: admin_theme_path(slug), method: :delete, variant: :ghost, size: :sm, data: { turbo_confirm: "Delete this installed theme and its release files? Linked automatic deployments will be paused. This cannot be undone; you can reinstall from its repository or ZIP." })
          end
        end
      end
    end

    def panel_heading(title, subtitle, icon)
      header(class: "theme-panel-heading") do
        span(class: "theme-panel-icon") { render Icon.new(icon, size: :md) }
        div { h2 { title }; p { subtitle } }
      end
    end
  end
  # Theme preview: renders the live site in an iframe with the ?preview_theme=<slug>
  # param so admins can preview a theme without activating it. Rendered from
  # Admin::ThemesController#preview.
  class ThemePreviewPage < ApplicationComponent
    def initialize(slug:)
      @slug = slug
    end

    def view_template
      render Toolbar.new do |toolbar|
        toolbar.leading do
          div do
            h1(class: "text-2xl font-bold tracking-tight") { "Theme preview" }
            p(class: "text-sm text-muted-foreground mt-1") { "#{@slug.titleize} · Theme defaults preview. Your published template assignments stay unchanged." }
          end
        end
        toolbar.trailing do
          render Button.new("Back to themes", href: admin_themes_path, variant: :ghost)
        end
      end

      render Card.new do |card|
        card.body do
          iframe(src: root_path(preview_theme: @slug, theme_home: "1"), title: "#{@slug.titleize} theme preview", class: "w-full h-[80vh]")
        end
      end
    end
  end
end
