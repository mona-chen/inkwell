# Ink — Inkwell's own design system.
# Application-owned components and design tokens. Stroke-based Lucide icons,
# calm editorial surfaces, and no external component-runtime dependency.
module Ink
  class Component < Phlex::HTML
    include Phlex::Rails::Helpers::Routes
    include Phlex::Rails::Helpers::DOMID
  end
end
