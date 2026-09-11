# frozen_string_literal: true

module Docs
  # Standalone documentation chrome (header + section sidebar + content). Deliberately
  # independent of the admin shell and the active theme so docs are always available to
  # anyone, on any site.
  class Layout < ApplicationComponent
    def initialize(title:, sections: [], active: nil)
      @title = title
      @sections = sections
      @active = active
    end

    def view_template(&block)
      html lang: "en" do
        head do
          meta charset: "utf-8"
          meta name: "viewport", content: "width=device-width,initial-scale=1"
          title { "#{@title} — Inkwell Docs" }
          style { raw(safe(css)) }
        end
        body do
          render_header
          div(class: "docs-shell") do
            render_sidebar
            main(class: "docs-main", &block)
          end
          render_footer
        end
      end
    end

    private

    def render_header
      header(class: "docs-header") do
        div(class: "docs-header-inner") do
          a(href: docs_path, class: "docs-brand") do
            span(class: "docs-brand-mark") { "I" }
            span(class: "docs-brand-name") { "Inkwell" }
            span(class: "docs-brand-tag") { "Docs" }
          end
          nav(class: "docs-topnav") do
            a(href: docs_path, class: "docs-topnav-link#{' is-active' if @active == :docs}") { "Documentation" }
            a(href: docs_api_path, class: "docs-topnav-link#{' is-active' if @active == :api}") { "API Reference" }
          end
        end
      end
    end

    def render_sidebar
      aside(class: "docs-sidebar") do
        nav do
          @sections.each do |section|
            a(href: "##{section[:id]}", class: "docs-nav-link") { section[:title] }
          end
        end
      end
    end

    def render_footer
      footer(class: "docs-footer") do
        div(class: "docs-footer-inner") do
          plain "Inkwell — a modern, plugin-first publishing platform."
        end
      end
    end

    def css
      <<~CSS
        *, *::before, *::after { box-sizing: border-box; }
        :root { --docs-border: #e5e7eb; --docs-muted: #6b7280; --docs-accent: #4f46e5; --docs-bg: #ffffff; --docs-code-bg: #f6f7f9; }
        body { margin: 0; background: var(--docs-bg); color: #111827; font: 15px/1.65 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
        a { color: var(--docs-accent); text-decoration: none; }
        a:hover { text-decoration: underline; }

        .docs-header { position: sticky; top: 0; z-index: 20; border-bottom: 1px solid var(--docs-border); background: rgba(255,255,255,.92); backdrop-filter: blur(8px); }
        .docs-header-inner { display: flex; max-width: 1200px; align-items: center; justify-content: space-between; gap: 16px; margin: 0 auto; padding: 12px 24px; }
        .docs-brand { display: inline-flex; align-items: center; gap: 8px; font-weight: 650; color: #111827; letter-spacing: -.01em; }
        .docs-brand:hover { text-decoration: none; }
        .docs-brand-mark { display: grid; width: 26px; height: 26px; place-items: center; border-radius: 8px; background: var(--docs-accent); color: #fff; font-size: 14px; }
        .docs-brand-tag { color: var(--docs-muted); font-weight: 500; }
        .docs-topnav { display: flex; gap: 4px; }
        .docs-topnav-link { padding: 7px 12px; border-radius: 8px; color: #374151; font-size: 14px; font-weight: 500; }
        .docs-topnav-link:hover { background: #f3f4f6; text-decoration: none; }
        .docs-topnav-link.is-active { background: #eef2ff; color: var(--docs-accent); }

        .docs-shell { display: grid; max-width: 1200px; grid-template-columns: 220px minmax(0, 1fr); gap: 40px; margin: 0 auto; padding: 32px 24px 64px; }
        .docs-sidebar { position: sticky; top: 76px; align-self: start; max-height: calc(100vh - 100px); overflow-y: auto; }
        .docs-sidebar nav { display: flex; flex-direction: column; gap: 1px; border-left: 1px solid var(--docs-border); }
        .docs-nav-link { padding: 6px 12px; border-left: 2px solid transparent; margin-left: -1px; color: var(--docs-muted); font-size: 13.5px; }
        .docs-nav-link:hover { color: #111827; border-left-color: var(--docs-border); text-decoration: none; }

        .docs-main { min-width: 0; max-width: 760px; }
        .docs-main h1 { margin: 0 0 8px; font-size: 30px; letter-spacing: -.02em; }
        .docs-main > p:first-of-type { margin-top: 0; }
        .docs-main h2 { margin: 44px 0 12px; padding-top: 8px; font-size: 21px; letter-spacing: -.01em; border-top: 1px solid var(--docs-border); }
        .docs-main h3 { margin: 26px 0 8px; font-size: 16px; }
        .docs-main p, .docs-main li { color: #1f2937; }
        .docs-main ul, .docs-main ol { padding-left: 22px; }
        .docs-main li { margin: 3px 0; }
        .docs-main code { padding: 1px 5px; border: 1px solid var(--docs-border); border-radius: 5px; background: var(--docs-code-bg); font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
        .docs-main pre { margin: 12px 0; padding: 14px 16px; overflow-x: auto; border: 1px solid var(--docs-border); border-radius: 10px; background: var(--docs-code-bg); }
        .docs-main pre code { padding: 0; border: 0; background: none; font-size: 12.5px; }
        .docs-lead { color: var(--docs-muted); font-size: 16px; }
        .docs-callout { margin: 14px 0; padding: 12px 14px; border: 1px solid #c7d2fe; border-left: 3px solid var(--docs-accent); border-radius: 8px; background: #f5f7ff; font-size: 14px; }
        .docs-table { width: 100%; margin: 12px 0; border-collapse: collapse; font-size: 14px; }
        .docs-table th, .docs-table td { padding: 8px 10px; border: 1px solid var(--docs-border); text-align: left; vertical-align: top; }
        .docs-table th { background: var(--docs-code-bg); font-weight: 600; }
        .docs-footer { border-top: 1px solid var(--docs-border); }
        .docs-footer-inner { max-width: 1200px; margin: 0 auto; padding: 20px 24px; color: var(--docs-muted); font-size: 13px; }
        @media (max-width: 860px) { .docs-shell { grid-template-columns: 1fr; gap: 20px; } .docs-sidebar { position: static; max-height: none; } }
      CSS
    end
  end
end
