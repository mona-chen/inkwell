# Ink — Inkwell's own design system.
# Replaces NitroKit with our own components + design tokens so the design is
# fully ours. Stroke-based Lucide icons, calm editorial surfaces, our tokens.
module Ink
  class Component < Phlex::HTML
    include Phlex::Rails::Helpers::Routes
    include Phlex::Rails::Helpers::DOMID
  end
end
