module Admin
  class GithubManifestPage < ApplicationComponent
    def initialize(manifest:, state:)
      @manifest, @state = manifest, state
    end
    def view_template
      div(class: "theme-setup-page") do
        render Button.new("Back to GitHub connection", href: admin_themes_path(tab: "github"), variant: :ghost, icon: :arrow_left)
        h1 { "Create your GitHub App" }
        p { "GitHub will ask you to confirm the App name and repository read permissions. Inkwell receives its credentials securely after you return." }
        dl(class: "theme-connection-facts") do
          dt { "Repository permissions" }; dd { "Contents and metadata · read only" }
          dt { "Events" }; dd { "Push notifications for automatic updates" }
          dt { "Application URL" }; dd { @manifest.fetch(:url) }
        end
        form_with(url: "https://github.com/settings/apps/new?#{URI.encode_www_form(state: @state)}", method: :post, authenticity_token: false, data: { turbo: false }) do |form|
          form.hidden_field(:manifest, value: @manifest.to_json)
          render Button.new("Continue on GitHub", type: :submit, variant: :primary, icon: :external_link)
        end
      end
    end
  end
end
