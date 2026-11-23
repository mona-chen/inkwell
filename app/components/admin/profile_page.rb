# frozen_string_literal: true

module Admin
  # The author profile editor: everything readers see in bylines, author boxes and
  # contributor pages, with a live preview, plus account (password) settings.
  class ProfilePage < ApplicationComponent
    LINK_ROWS = User::MAX_PROFILE_LINKS

    def initialize(user:, own:, public_url:)
      @user = user
      @own = own
      @public_url = public_url
    end

    def view_template
      render Toolbar.new do |toolbar|
        toolbar.leading do
          render ToolbarTitle.new(title: @own ? "Your profile" : "#{@user.name}'s profile", subtitle: "How readers see you in bylines, author boxes and contributor pages")
        end
        toolbar.trailing do
          a(href: @public_url, target: "_blank", rel: "noopener", class: "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted") do
            render Icon.new(:external_link, size: :xs)
            plain "View public page"
          end
          render Button.new("Save profile", variant: :primary, size: :sm, icon: :check, type: :submit, form: "profile-form")
        end
      end

      form_with(url: admin_profile_path(author: @own ? nil : @user.to_param), method: :patch, id: "profile-form", class: "profile-editor", data: { controller: "profile-preview" }) do
        div(class: "profile-editor__grid") do
          div(class: "profile-editor__main") do
            public_section
            links_section
            account_section if @own
          end
          preview_panel
        end
      end
    end

    private

    def public_section
      render Card.new do |card|
        card.title { "Public profile" }
        card.body do
          div(class: "profile-avatar-field", data: { controller: "media-picker" }) do
            input(type: "hidden", name: "user[avatar_item_id]", value: @user.avatar_item_id, data: { media_picker_target: "urlField", media_value: "id", action: "input->profile-preview#avatar", profile_preview_target: "avatarId" })
            button(type: "button", class: "profile-avatar", data: { action: "media-picker#open" }, aria: { label: "Choose profile photo" }) do
              div(class: "profile-avatar__image", data: { media_picker_target: "preview" }) { avatar_markup(96) }
            end
            div(class: "profile-avatar__actions") do
              p(class: "text-sm font-medium text-foreground") { "Profile photo" }
              p(class: "text-xs text-muted-foreground") { "A square photo at least 256 × 256 px works best." }
              div(class: "mt-2 flex gap-2") do
                button(type: "button", class: "profile-button", data: { action: "media-picker#open", media_picker_target: "chooseButton" }) { @user.avatar_display_url ? "Replace" : "Choose photo" }
                button(type: "button", class: "profile-button profile-button--ghost", hidden: @user.avatar_item_id.nil?, data: { action: "media-picker#clear profile-preview#avatar", media_picker_target: "clearButton" }) { "Remove" }
              end
            end
            media_dialog
          end

          field("Name", hint: "Shown on every story you write.") do
            input(type: "text", name: "user[name]", value: @user.name, required: true, maxlength: 120, class: input_class, data: { profile_preview_target: "nameInput", action: "input->profile-preview#update" })
          end
          field("Role or title", hint: "e.g. Head of Customer Success at Ruut") do
            input(type: "text", name: "user[job_title]", value: @user.job_title, maxlength: 120, class: input_class, placeholder: "Head of Customer Success", data: { profile_preview_target: "titleInput", action: "input->profile-preview#update" })
          end
          field("Bio", hint: "Two or three sentences in the third person. Plain text, up to 2,000 characters.") do
            textarea(name: "user[bio]", rows: 5, maxlength: 2000, class: "#{input_class} h-auto py-2 leading-relaxed", placeholder: "Ada leads customer success at Ruut, where she helps teams across Africa…", data: { profile_preview_target: "bioInput", action: "input->profile-preview#update" }) { @user.bio }
          end
        end
      end
    end

    def links_section
      links = @user.profile_links
      render Card.new do |card|
        card.title { "Links" }
        card.body do
          p(class: "mb-3 text-xs text-muted-foreground") { "Website and social profiles. They appear on your author box and help search engines connect your work (schema.org sameAs)." }
          div(class: "profile-links") do
            LINK_ROWS.times do |index|
              link = links[index] || {}
              div(class: "profile-links__row", hidden: index > [ links.size, 1 ].max, data: { profile_preview_target: "linkRow" }) do
                input(type: "text", name: "user[profile_links][][label]", value: link["label"], placeholder: "Label (optional)", maxlength: 60, class: "#{input_class} profile-links__label", aria: { label: "Link #{index + 1} label" })
                input(type: "text", name: "user[profile_links][][url]", value: link["url"], placeholder: "https://linkedin.com/in/you", maxlength: 500, class: input_class, inputmode: "url", aria: { label: "Link #{index + 1} URL" })
              end
            end
          end
          button(type: "button", class: "profile-button mt-3", data: { action: "profile-preview#addLink" }) { "+ Add link" }
        end
      end
    end

    def account_section
      render Card.new do |card|
        card.title { "Account" }
        card.body do
          field("Email", hint: "Used to sign in. Contact a site admin to change it.") do
            input(type: "email", value: @user.email, disabled: true, class: "#{input_class} opacity-70")
          end
          details(class: "profile-password") do
            summary(class: "cursor-pointer text-sm font-medium text-foreground") { "Change password" }
            div(class: "mt-3 grid gap-3 sm:grid-cols-3") do
              field("Current password") { input(type: "password", name: "user[current_password]", autocomplete: "current-password", class: input_class) }
              field("New password") { input(type: "password", name: "user[password]", autocomplete: "new-password", minlength: 6, class: input_class) }
              field("Confirm") { input(type: "password", name: "user[password_confirmation]", autocomplete: "new-password", class: input_class) }
            end
          end
        end
      end
    end

    def preview_panel
      aside(class: "profile-editor__preview", aria: { label: "Preview" }) do
        p(class: "profile-preview__eyebrow") { "Preview" }
        div(class: "profile-preview__byline") do
          span(class: "profile-preview__avatar profile-preview__avatar--sm", data: { profile_preview_target: "avatarSmall" }) { avatar_markup(28) }
          span(data: { profile_preview_target: "nameSmall" }) { @user.name }
          span(class: "text-muted-foreground") { "· #{Date.current.strftime('%b %-d, %Y')} · 6 min read" }
        end
        div(class: "profile-preview__box") do
          span(class: "profile-preview__avatar", data: { profile_preview_target: "avatarLarge" }) { avatar_markup(64) }
          div do
            p(class: "profile-preview__label") { "Written by" }
            p(class: "profile-preview__name", data: { profile_preview_target: "name" }) { @user.name }
            p(class: "profile-preview__title", data: { profile_preview_target: "title" }) { @user.job_title }
            p(class: "profile-preview__bio", data: { profile_preview_target: "bio" }) { @user.bio.presence || "Add a short bio so readers know who is behind the story." }
          end
        end
        p(class: "mt-3 text-[11px] leading-4 text-muted-foreground") { "Themes style this differently; the content is the same everywhere." }
      end
    end

    def media_dialog
      dialog(data: { media_picker_target: "dialog", action: "click->media-picker#backdropClose" }, class: "m-auto w-[42rem] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-background p-0 shadow-2xl backdrop:bg-black/50") do
        div(class: "flex items-center justify-between border-b border-border px-4 py-3") do
          h3(class: "text-sm font-semibold text-foreground") { "Choose profile photo" }
          button(type: "button", data: { action: "media-picker#close" }, class: "rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground", aria: { label: "Close" }) { "✕" }
        end
        div(class: "max-h-[60vh] overflow-y-auto") do
          turbo_frame_tag("avatar-picker-frame", data: { media_picker_target: "frame", src: admin_media_path(picker: 1) }) do
            div(class: "p-4 text-center text-sm text-muted-foreground") { "Loading…" }
          end
        end
      end
    end

    def avatar_markup(size)
      if (url = @user.avatar_display_url)
        img(src: url, alt: "", width: size, height: size, class: "h-full w-full object-cover")
      else
        span(class: "profile-initials") { @user.initials }
      end
    end

    def field(title, hint: nil, &block)
      label(class: "profile-field") do
        span(class: "profile-field__label") { title }
        yield
        span(class: "profile-field__hint") { hint } if hint
      end
    end

    def input_class
      "h-9 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
    end
  end
end
