# frozen_string_literal: true

module Webhooks
  # Per-site webhook management: create/delete endpoints, choose events, and review recent
  # deliveries. Signing secrets are shown to the site owner so they can verify signatures.
  class SettingsPage < ApplicationComponent
    include Phlex::Rails::Helpers::ButtonTo

    def initialize(site:)
      @site = site
      @endpoints = Webhooks::Endpoint.where(site_id: site.id).order(created_at: :desc)
      @deliveries = Webhooks::Delivery.where(webhook_endpoint_id: @endpoints.select(:id)).recent.limit(10)
    end

    def view_template
      render Toolbar.new do |toolbar|
        toolbar.leading do
          render Admin::ToolbarTitle.new(
            title: "Webhooks",
            subtitle: "Send signed HTTP callbacks to external services when content changes"
          )
        end
      end

      endpoints_section
      deliveries_section
    end

    private

    def endpoints_section
      render Ink::SettingsSection.new(
        title: "Endpoints",
        description: "Inkwell POSTs a JSON payload to each endpoint when a subscribed event fires. Requests are signed with an HMAC-SHA256 signature."
      ) do |section|
        section.form do
          div(class: "space-y-4") do
            if @endpoints.any?
              div(class: "space-y-2") do
                @endpoints.each { |endpoint| render_endpoint(endpoint) }
              end
            else
              p(class: "text-sm text-muted-foreground") { "No endpoints yet." }
            end

            render_new_endpoint_form
          end
        end
      end
    end

    def render_endpoint(endpoint)
      div(class: "flex items-start justify-between gap-4 rounded-lg border border-border p-3") do
        div(class: "min-w-0 space-y-1") do
          div(class: "flex items-center gap-2") do
            span(class: "text-sm font-medium text-foreground") { endpoint.name }
            span(class: "inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground") { endpoint.active ? "Active" : "Paused" }
          end
          p(class: "truncate font-mono text-xs text-muted-foreground") { endpoint.url }
          p(class: "text-xs text-muted-foreground") { endpoint.events.join(", ") }
          p(class: "text-xs text-muted-foreground") do
            plain "Secret: "
            code(class: "font-mono text-foreground/70") { endpoint.secret }
          end
        end
        div(class: "shrink-0") do
          button_to(
            "Delete",
            Webhooks::Engine.routes.url_helpers.endpoint_path(endpoint),
            method: :delete,
            class: "text-xs text-muted-foreground hover:text-destructive transition-colors",
            data: { turbo_confirm: "Delete #{endpoint.name}? Its delivery history will be removed." }
          )
        end
      end
    end

    def render_new_endpoint_form
      div(class: "rounded-lg border border-dashed border-border p-4") do
        p(class: "mb-3 text-sm font-medium text-foreground") { "Add an endpoint" }
        form_with(
          url: Webhooks::Engine.routes.url_helpers.endpoints_path,
          method: :post,
          scope: "endpoint",
          builder: Ink::FormBuilder
        ) do |form|
          form.group do
            form.field(:name, value: nil, label: "Name", placeholder: "Production site")
            form.field(:url, value: nil, label: "Payload URL", placeholder: "https://example.com/webhooks/inkwell")
          end

          form.group do
            div(class: "space-y-2") do
              p(class: "text-xs font-medium text-muted-foreground") { "Events" }
              Webhooks::Endpoint::EVENT_NAMES.each do |event|
                label(class: "flex items-center gap-2 text-sm text-foreground") do
                  input(type: "checkbox", name: "endpoint[events][]", value: event, class: "h-4 w-4 rounded border-border")
                  span { event }
                end
              end
            end
          end

          form.group do
            form.submit("Add webhook")
          end
        end
      end
    end

    def deliveries_section
      render Ink::SettingsSection.new(
        title: "Recent deliveries",
        description: "The last 10 delivery attempts across this site's endpoints."
      ) do |section|
        section.form do
          if @deliveries.any?
            div(class: "divide-y divide-border rounded-lg border border-border") do
              @deliveries.each { |delivery| render_delivery(delivery) }
            end
          else
            p(class: "text-sm text-muted-foreground") { "No deliveries yet." }
          end
        end
      end
    end

    def render_delivery(delivery)
      ok = delivery.delivered?
      div(class: "flex items-center justify-between gap-3 px-3 py-2.5 text-sm") do
        div(class: "min-w-0") do
          span(class: "font-medium text-foreground") { delivery.event }
          span(class: "ml-2 text-muted-foreground") { delivery.endpoint.name }
        end
        div(class: "flex shrink-0 items-center gap-3 text-xs") do
          span(class: ok ? "text-emerald-600" : "text-destructive") do
            ok ? "Delivered" : (delivery.error.presence || "Pending")
          end
          span(class: "text-muted-foreground") { "attempt #{delivery.attempts}" }
        end
      end
    end
  end
end
