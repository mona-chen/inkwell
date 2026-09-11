# frozen_string_literal: true

module Admin
  # Site settings. Two SettingsSections: General (site identity) and Homepage (what the
  # front page shows — WordPress "Settings → Reading").
  class SettingsPage < ApplicationComponent
    include Phlex::Rails::Helpers::ButtonTo

    SECTIONS = {
      "general" => { label: "General", icon: :sliders_horizontal, subtitle: "Identity and regional preferences" },
      "discussion" => { label: "Discussion", icon: :message_circle, subtitle: "How visitors register and comment" },
      "homepage" => { label: "Homepage", icon: :home, subtitle: "Choose the content visitors see first" },
      "api" => { label: "API", icon: :code, subtitle: "Read-only content API and access tokens" },
      "maintenance" => { label: "Maintenance", icon: :wrench, subtitle: "Caches, assets, and recovery tools" }
    }.freeze

    def initialize(site:, section: "general", new_token: nil)
      @site = site
      @pages = site.pages.published.ordered
      @section = SECTIONS.key?(section) ? section : "general"
      @new_token = new_token
    end

    def view_template
      render Toolbar.new do |toolbar|
        toolbar.leading do
          render ToolbarTitle.new(title: "Settings", subtitle: SECTIONS.fetch(@section).fetch(:subtitle))
        end
        if form_section?
          toolbar.trailing do
            render Button.new(
              "Save changes",
              variant: :primary,
              size: :sm,
              icon: :check,
              type: :submit,
              form: form_id,
              submission_indicator: :spinner,
              data: { turbo_submits_with: "Saving…" }
            )
          end
        end
      end

      render SettingsLayout.new(id: "site-settings") do |layout|
        layout.navigation(label: "Settings sections") do |navigation|
          SECTIONS.each do |key, item|
            navigation.item(
              item.fetch(:label),
              href: admin_settings_path(section: key),
              icon: item.fetch(:icon),
              current: key == @section
            )
          end
        end
        layout.content { render_active_section }
      end
    end

    private

    def render_general_section
      render SettingsSection.new(
        id: "general-settings",
        title: "Site identity and defaults",
        description: "The public identity and publishing defaults shared across #{@site.name}."
      ) do |section|
        section.form do
          form_with(
            url: admin_settings_path(section: @section),
            method: :patch,
            scope: "settings",
            builder: Ink::FormBuilder,
            html: { id: form_id }
          ) do |form|
            form.group do
              form.field(:name, value: @site.name, label: "Site name")
              form.field(:tagline, value: setting_value("tagline"), label: "Tagline")
              form.field(:timezone, value: setting_value("timezone"), label: "Timezone")
            end

            form.group do
              render_logo_field
            end

            form.group do
              noscript { form.submit("Save settings") }
            end
          end
        end
      end
    end

    def render_logo_field
      logo = @site.logo_item
      div(data: { controller: "media-picker" }) do
        div(class: "mb-1 block text-xs font-medium text-muted-foreground") { "Site logo" }
        div(class: "flex items-center gap-4") do
          div(
            data: { media_picker_target: "preview" },
            class: "flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted"
          ) do
            if logo
              img(src: logo.url, class: "h-full w-full object-contain", alt: "")
            else
              span(class: "text-xs text-muted-foreground") { "None" }
            end
          end
          div(class: "flex-1 space-y-2") do
            input(
              type: "text",
              name: "settings[site_logo]",
              value: setting_value("site_logo"),
              data: { media_picker_target: "urlField" },
              placeholder: "Logo media id, or pick below",
              class: "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            )
            button(
              type: "button",
              data: { action: "media-picker#open" },
              class: "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            ) do
              render Icon.new(:image, size: :sm)
              "Choose from media library"
            end
          end
        end

        render_logo_picker_dialog
      end
    end

    def render_logo_picker_dialog
      dialog(
        data: { media_picker_target: "dialog", action: "click->media-picker#backdropClose" },
        class: "m-auto w-[42rem] max-w-full rounded-2xl border border-border bg-background p-0 shadow-2xl backdrop:bg-black/40"
      ) do
        div do
          div(class: "flex items-center justify-between border-b border-border px-4 py-3") do
            h3(class: "text-sm font-semibold text-foreground") { "Choose a logo" }
            button(
              type: "button",
              data: { action: "media-picker#close" },
              aria: { label: "Close" },
              class: "rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            ) { render Icon.new(:x, size: :sm) }
          end
          div(class: "max-h-[60vh] overflow-y-auto") do
            turbo_frame_tag(
              "settings-logo-picker-frame",
              data: { media_picker_target: "frame", src: admin_media_path(picker: 1, logo: 1) }
            ) do
              div(class: "p-4 text-center text-sm text-muted-foreground") { "Loading…" }
            end
          end
        end
      end
    end

    def render_discussion_section
      render SettingsSection.new(
        id: "discussion-settings",
        title: "Discussion",
        description: "Control how visitors create accounts and interact with #{@site.name}."
      ) do |section|
        section.form do
          form_with(
            url: admin_settings_path(section: @section),
            method: :patch,
            scope: "settings",
            builder: Ink::FormBuilder,
            html: { id: form_id }
          ) do |form|
            form.group do
              form.field(
                :registration_mode,
                as: :select,
                label: "User registration",
                options: [
                  [ "Open — anyone can register", "open" ],
                  [ "Invite only", "invite_only" ],
                  [ "Closed", "closed" ]
                ],
                value: setting_value("registration_mode", "open")
              )
            end
            form.group do
              render Ink::Checkbox.new(
                label: "Enable comments",
                name: "settings[comments_enabled]",
                value: "1",
                unchecked_value: "0",
                checked: setting_value("comments_enabled") == "1" || setting_value("comments_enabled").nil?
              )
            end
            form.group do
              noscript { form.submit("Save discussion settings") }
            end
          end
        end
      end
    end

    def render_homepage_section
      render SettingsSection.new(
        id: "homepage-settings",
        title: "Homepage source",
        description: "Choose what visitors see when they arrive at your site's root URL."
      ) do |section|
        section.form do
          form_with(
            url: admin_settings_path(section: @section),
            method: :patch,
            scope: "settings",
            builder: Ink::FormBuilder,
            html: { id: form_id }
          ) do |form|
            form.group do
              render Ink::RadioButtonGroup.new(
                legend: "Your homepage displays",
                name: "settings[show_on_front]",
                options: [
                  Ink::Choice.new(label: "Your latest posts", value: "posts"),
                  Ink::Choice.new(label: "A static page", value: "page")
                ],
                value: setting_value("show_on_front", "posts")
              )
            end
            form.group do
              form.field(
                :page_on_front,
                as: :select,
                label: "Homepage page",
                options: @pages.map { |p| [ p.title, p.id.to_s ] },
                include_blank: "Select a page…",
                value: setting_value("page_on_front")
              )
            end
            form.group do
              noscript { form.submit("Save homepage") }
            end
          end
        end
      end
    end

    def render_api_section
      api_base = "#{helpers.request&.protocol}#{@site.domain}/api/v1"
      tokens = @site.api_tokens.order(created_at: :desc)

      render SettingsSection.new(
        id: "api-settings",
        title: "Content API",
        description: "A read-only JSON API for #{@site.name}. Published content is public; a token unlocks drafts and unpublished content."
      ) do |section|
        section.form do
          div(class: "space-y-4") do
            div(class: "rounded-lg border border-border bg-muted/30 p-3") do
              p(class: "text-[11px] font-medium uppercase tracking-wide text-muted-foreground") { "Base URL" }
              p(class: "mt-1 font-mono text-sm text-foreground") { api_base }
              p(class: "mt-1 text-xs text-muted-foreground") { "Endpoints: /site · /posts · /pages · /media · /taxonomies · /menus" }
            end

            if @new_token.present?
              div(class: "rounded-lg border border-emerald-300 bg-emerald-50 p-3") do
                p(class: "text-sm font-semibold text-emerald-800") { "Copy this token now — it won't be shown again." }
                code(class: "mt-2 block break-all rounded-md bg-white px-3 py-2 font-mono text-sm text-emerald-900") { @new_token }
              end
            end

            form_with(url: admin_api_tokens_path, method: :post, class: "flex items-end gap-2") do |f|
              div(class: "flex-1 space-y-1.5") do
                label(for: "api_token_name", class: "block text-xs font-medium text-muted-foreground") { "New token name" }
                f.text_field :name,
                  id: "api_token_name",
                  value: nil,
                  placeholder: "Next.js frontend",
                  class: "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              end
              f.submit "Create token", class: "inline-flex h-9 cursor-pointer items-center justify-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            end

            if tokens.any?
              div(class: "divide-y divide-border rounded-lg border border-border") do
                tokens.each do |token|
                  div(class: "flex items-center justify-between gap-3 px-3 py-2.5") do
                    div(class: "min-w-0") do
                      p(class: "text-sm font-medium text-foreground") { token.name }
                      p(class: "font-mono text-xs text-muted-foreground") { token.masked }
                    end
                    div(class: "flex shrink-0 items-center gap-3") do
                      span(class: "text-xs text-muted-foreground") do
                        if token.last_used_at
                          "Used #{helpers.time_ago_in_words(token.last_used_at)} ago"
                        else
                          "Never used"
                        end
                      end
                      button_to("Revoke", admin_api_token_path(token), method: :delete,
                        class: "text-xs text-muted-foreground hover:text-destructive transition-colors",
                        data: { turbo_confirm: "Revoke #{token.name}? Any app using it will lose access." })
                    end
                  end
                end
              end
            else
              p(class: "text-sm text-muted-foreground") { "No tokens yet. Create one to let a frontend read drafts." }
            end
          end
        end
      end
    end

    def render_maintenance_section
      render Ink::DangerZone.new(
        title: "Maintenance",
        description: "Clear caches and force freshly-compiled assets. Use when edits aren't showing up due to cached styles, fragments, or render output."
      ) do |zone|
        zone.confirmation do
          render ButtonTo.new(
            "Clear cache & refresh assets",
            href: purge_cache_admin_settings_path,
            method: :post,
            variant: :destructive,
            icon: :trash,
            data: { turbo_confirm: "Clear the application cache? Pages will re-render fresh on the next visit." }
          )
        end
      end
    end

    def setting_value(key, default = nil)
      @site.setting(key, default)
    end

    def render_active_section
      case @section
      when "discussion" then render_discussion_section
      when "homepage" then render_homepage_section
      when "api" then render_api_section
      when "maintenance" then render_maintenance_section
      else render_general_section
      end
    end

    def form_section?
      !%w[maintenance api].include?(@section)
    end

    def form_id
      "#{@section}-settings-form"
    end
  end
end
