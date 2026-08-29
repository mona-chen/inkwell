# frozen_string_literal: true

# Clean-room Ruut hero built entirely from Ink Builder v2 native elements.
# Run with: bin/rails runner scripts/seed_native_ruut_parity.rb

require "securerandom"

target_slug = ENV.fetch("PARITY_SLUG", "a-hero-raw-build")
target_title = ENV.fetch("PARITY_TITLE", "Native Ruut parity study")
page = Page.find_or_initialize_by(slug: target_slug)
if page.new_record?
  page.site = Site.first!
  page.author = User.first!
  page.template = "landing"
end
page.title = target_title
page.status = "draft"

states = ->(base = {}) {
  {
    "base" => base,
    "hover" => {},
    "focus" => {},
    "active" => {}
  }
}

responsive = ->(desktop = {}, tablet = {}, mobile = {}) {
  {
    "desktop" => states.call(desktop),
    "tablet" => states.call(tablet),
    "mobile" => states.call(mobile)
  }
}

node = ->(type, settings: {}, styles: {}, children: []) {
  {
    "id" => SecureRandom.uuid,
    "type" => type,
    "settings" => settings,
    "styles" => styles,
    "children" => children
  }
}

container = ->(children = [], desktop: {}, tablet: {}, mobile: {}, tag: "div", layout: "full") {
  node.call(
    "container",
    settings: { "tag" => tag, "layout" => layout },
    styles: responsive.call(desktop, tablet, mobile),
    children: children
  )
}

paragraph = ->(text, desktop: {}, tablet: {}, mobile: {}) {
  node.call(
    "paragraph",
    settings: { "text" => text },
    styles: responsive.call(desktop, tablet, mobile)
  )
}

heading = ->(text, desktop: {}, tablet: {}, mobile: {}) {
  node.call(
    "heading",
    settings: { "text" => text, "tag" => "h1", "size" => "", "link" => "" },
    styles: responsive.call(desktop, tablet, mobile)
  )
}

button = ->(text, desktop: {}, tablet: {}, mobile: {}, url: "#", icon: "", icon_position: "after") {
  node.call(
    "button",
    settings: {
      "text" => text,
      "url" => url,
      "target" => "_self",
      "size" => "md",
      "icon" => icon,
      "iconPosition" => icon_position,
      "align" => ""
    },
    styles: responsive.call(desktop, tablet, mobile)
  )
}

image = ->(src, alt, desktop: {}, tablet: {}, mobile: {}) {
  node.call(
    "image",
    settings: { "src" => src, "alt" => alt, "link" => "", "caption" => "", "align" => "" },
    styles: responsive.call(desktop, tablet, mobile)
  )
}

nav_text = {
  "color" => "rgba(255,255,255,.62)",
  "font-family" => "Inter, ui-sans-serif, system-ui, sans-serif",
  "font-size" => { "size" => 14, "unit" => "px" },
  "font-weight" => "500",
  "line-height" => { "size" => 1, "unit" => "" },
  "margin" => { "top" => 0, "right" => 0, "bottom" => 0, "left" => 0, "unit" => "px" }
}

header = container.call(
  [
    container.call(
      [
        paragraph.call(
          "R",
          desktop: {
            "display" => "flex", "align-items" => "center", "justify-content" => "center",
            "width" => { "size" => 20, "unit" => "px" }, "height" => { "size" => 20, "unit" => "px" },
            "color" => "#0b0b0d", "background-color" => "#bd6cff",
            "font-size" => { "size" => 12, "unit" => "px" }, "font-weight" => "800",
            "border-radius" => { "top" => 999, "right" => 999, "bottom" => 999, "left" => 999, "unit" => "px" },
            "margin" => { "top" => 0, "right" => 0, "bottom" => 0, "left" => 0, "unit" => "px" }
          }
        ),
        paragraph.call(
          "Ruut Chat",
          desktop: nav_text.merge("color" => "#ffffff", "font-size" => { "size" => 17, "unit" => "px" }, "font-weight" => "700")
        )
      ],
      desktop: { "display" => "flex", "flex-direction" => "row", "align-items" => "center", "gap" => { "row" => 8, "column" => 8, "unit" => "px" }, "width" => "auto" }
    ),
    container.call(
      [
        paragraph.call("Product", desktop: nav_text),
        paragraph.call("Resource", desktop: nav_text),
        paragraph.call("Pricing", desktop: nav_text),
        button.call(
          "Book a demo",
          icon: "lucide:arrow-right",
          desktop: {
            "color" => "#ffffff", "background-color" => "#282b2b",
            "font-size" => { "size" => 14, "unit" => "px" }, "font-weight" => "600",
            "padding" => { "top" => 13, "right" => 17, "bottom" => 13, "left" => 17, "unit" => "px" },
            "border-radius" => { "top" => 12, "right" => 12, "bottom" => 12, "left" => 12, "unit" => "px" },
            "width" => "auto", "min-height" => { "size" => 42, "unit" => "px" }
          }
        ),
        button.call(
          "Start free trial",
          icon: "lucide:monitor-up",
          desktop: {
            "color" => "#111113", "background-color" => "#ffffff",
            "font-size" => { "size" => 14, "unit" => "px" }, "font-weight" => "600",
            "padding" => { "top" => 13, "right" => 17, "bottom" => 13, "left" => 17, "unit" => "px" },
            "border-radius" => { "top" => 12, "right" => 12, "bottom" => 12, "left" => 12, "unit" => "px" },
            "width" => "auto", "min-height" => { "size" => 42, "unit" => "px" }
          }
        )
      ],
      desktop: { "display" => "flex", "flex-direction" => "row", "align-items" => "center", "justify-content" => "flex-end", "gap" => { "row" => 22, "column" => 22, "unit" => "px" }, "width" => "auto" },
      tablet: { "gap" => { "row" => 16, "column" => 16, "unit" => "px" } },
      mobile: { "display" => "none" }
    )
  ],
  desktop: {
    "display" => "flex", "flex-direction" => "row", "align-items" => "center", "justify-content" => "space-between",
    "width" => "100%", "min-height" => { "size" => 70, "unit" => "px" },
    "padding" => { "top" => 0, "right" => 20, "bottom" => 0, "left" => 20, "unit" => "px" },
    "background-color" => "#0b0b0d", "gap" => { "row" => 20, "column" => 20, "unit" => "px" }
  },
  mobile: { "min-height" => { "size" => 60, "unit" => "px" }, "padding" => { "top" => 0, "right" => 16, "bottom" => 0, "left" => 16, "unit" => "px" } },
  tag: "header"
)

announcement = container.call(
  [
    paragraph.call(
      "Our message to you this Customer Service Week 2025",
      desktop: {
        "color" => "#ffffff", "font-family" => "Inter, ui-sans-serif, system-ui, sans-serif",
        "font-size" => { "size" => 14, "unit" => "px" }, "font-weight" => "500",
        "margin" => { "top" => 0, "right" => 0, "bottom" => 0, "left" => 0, "unit" => "px" }
      }
    ),
    paragraph.call(
      "→",
      desktop: {
        "color" => "#ffffff", "font-size" => { "size" => 28, "unit" => "px" }, "line-height" => { "size" => 1, "unit" => "" },
        "margin" => { "top" => 0, "right" => 0, "bottom" => 0, "left" => 0, "unit" => "px" }
      }
    )
  ],
  desktop: {
    "display" => "flex", "flex-direction" => "row", "align-items" => "center", "justify-content" => "center",
    "width" => "100%", "min-height" => { "size" => 53, "unit" => "px" },
    "padding" => { "top" => 0, "right" => 24, "bottom" => 0, "left" => 24, "unit" => "px" },
    "gap" => { "row" => 28, "column" => 28, "unit" => "px" },
    "--ink-background-type" => "gradient",
    "background-image" => "linear-gradient(90deg,#f71d2d 0%,#2b1113 48%,#38c8d7 100%)"
  },
  mobile: { "padding" => { "top" => 12, "right" => 16, "bottom" => 12, "left" => 16, "unit" => "px" } }
)

avatar_urls = [
  "https://framerusercontent.com/images/uF5wcjNFI4ZsEdL7DQCxuhlXWWA.png?scale-down-to=512&width=600&height=600",
  "https://framerusercontent.com/images/9Eh9Hmj5xvpZHcP8XN9VbysEaw.png?width=200&height=200",
  "https://framerusercontent.com/images/JuNWz3yNkYyp3qijTGfiyfHP8D4.jpg?width=400&height=400"
]

avatar_nodes = avatar_urls.each_with_index.map do |url, index|
  image.call(
    url,
    "Trusted customer #{index + 1}",
    desktop: {
      "width" => { "size" => 36, "unit" => "px" }, "height" => { "size" => 36, "unit" => "px" },
      "margin" => { "top" => 0, "right" => (index < 2 ? -9 : 0), "bottom" => 0, "left" => 0, "unit" => "px" },
      "border" => "2px solid rgba(255,255,255,.8)",
      "border-radius" => { "top" => 12, "right" => 12, "bottom" => 12, "left" => 12, "unit" => "px" },
      "position" => "relative", "z-index" => 3 - index
    }
  )
end

trust_row = container.call(
  avatar_nodes + [
    paragraph.call(
      "Trusted by global startups",
      desktop: {
        "color" => "#ffffff", "font-family" => "Inter, ui-sans-serif, system-ui, sans-serif",
        "font-size" => { "size" => 14, "unit" => "px" }, "font-weight" => "600",
        "margin" => { "top" => 0, "right" => 0, "bottom" => 0, "left" => 10, "unit" => "px" }
      }
    )
  ],
  desktop: { "display" => "flex", "flex-direction" => "row", "align-items" => "center", "justify-content" => "center", "gap" => { "row" => 0, "column" => 0, "unit" => "px" }, "width" => "auto" }
)

dashboard = image.call(
  "https://framerusercontent.com/images/J4ursafmWTMQUmf10fvpXqYMag.png?scale-down-to=2048&width=2940&height=1528",
  "Ruut conversations dashboard",
  desktop: {
    "width" => { "size" => 1090, "unit" => "px" }, "max-width" => { "size" => 90, "unit" => "%" },
    "image-width" => { "size" => 100, "unit" => "%" }, "image-height" => { "size" => 777, "unit" => "px" }, "object-fit" => "cover", "object-position" => "top",
    "margin" => { "top" => 123, "right" => 0, "bottom" => 0, "left" => 0, "unit" => "px" },
    "border" => "1px solid rgba(255,255,255,.18)",
    "border-radius" => { "top" => 16, "right" => 16, "bottom" => 16, "left" => 16, "unit" => "px" },
    "box-shadow" => "0 42px 100px rgba(0,0,0,.7)", "position" => "relative", "z-index" => 2
  },
  tablet: { "width" => { "size" => 854, "unit" => "px" }, "max-width" => { "size" => 90, "unit" => "%" }, "image-width" => { "size" => 100, "unit" => "%" }, "image-height" => { "size" => 605, "unit" => "px" }, "object-fit" => "cover", "object-position" => "top", "margin" => { "top" => 123, "right" => 0, "bottom" => 0, "left" => 0, "unit" => "px" } },
  mobile: { "max-width" => { "size" => 94, "unit" => "%" }, "image-height" => { "size" => 420, "unit" => "px" }, "margin" => { "top" => 70, "right" => 0, "bottom" => 0, "left" => 0, "unit" => "px" } }
)

hero = container.call(
  [
    heading.call(
      "Support • Engage • Retain.\nAcross every channel.",
      desktop: {
        "color" => "#ffffff", "font-family" => "Gambarino Regular, Georgia, Times New Roman, serif",
        "font-size" => { "size" => 64, "unit" => "px" }, "font-weight" => "400",
        "line-height" => { "size" => 1.04, "unit" => "" }, "letter-spacing" => { "size" => -1.68, "unit" => "px" },
        "text-align" => "center", "white-space" => "pre-line", "max-width" => { "size" => 650, "unit" => "px" },
        "margin" => { "top" => 0, "right" => 0, "bottom" => 0, "left" => 0, "unit" => "px" }, "position" => "relative", "z-index" => 2
      },
      tablet: { "font-size" => { "size" => 56, "unit" => "px" } },
      mobile: { "font-size" => { "size" => 42, "unit" => "px" }, "max-width" => { "size" => 92, "unit" => "%" } }
    ),
    paragraph.call(
      "Your customers are everywhere—so is Ruut. Reach them instantly, build trust, and keep them coming back with one powerful, unified platform.",
      desktop: {
        "color" => "rgba(255,255,255,.60)", "font-family" => "Inter, ui-sans-serif, system-ui, sans-serif",
        "font-size" => { "size" => 18, "unit" => "px" }, "font-weight" => "500",
        "line-height" => { "size" => 1.5, "unit" => "" }, "letter-spacing" => { "size" => -0.36, "unit" => "px" },
        "text-align" => "center", "max-width" => { "size" => 600, "unit" => "px" },
        "margin" => { "top" => 20, "right" => 0, "bottom" => 0, "left" => 0, "unit" => "px" }, "position" => "relative", "z-index" => 2
      },
      mobile: { "font-size" => { "size" => 16, "unit" => "px" }, "max-width" => { "size" => 92, "unit" => "%" } }
    ),
    button.call(
      "Start for free",
      icon: "lucide:wand-sparkles",
      icon_position: "before",
      desktop: {
        "display" => "flex", "justify-content" => "center", "align-items" => "center",
        "width" => { "size" => 356, "unit" => "px" }, "min-height" => { "size" => 46, "unit" => "px" },
        "color" => "#ffffff", "background-color" => "#3b0f75",
        "font-size" => { "size" => 16, "unit" => "px" }, "font-weight" => "600",
        "padding" => { "top" => 10, "right" => 26, "bottom" => 10, "left" => 26, "unit" => "px" },
        "margin" => { "top" => 32, "right" => 0, "bottom" => 0, "left" => 0, "unit" => "px" },
        "border" => "2px solid #6f1ee8", "border-radius" => { "top" => 10, "right" => 10, "bottom" => 10, "left" => 10, "unit" => "px" },
        "box-shadow" => "0 0 0 2px rgba(111,30,232,.35), 0 14px 40px rgba(49,10,106,.35)", "position" => "relative", "z-index" => 2
      },
      mobile: { "width" => { "size" => 82, "unit" => "%" } }
    ),
    paragraph.call(
      "Processed over 3 million messages across hundreds of trusted brands.",
      desktop: {
        "color" => "#ffffff", "font-family" => "Inter, ui-sans-serif, system-ui, sans-serif",
        "font-size" => { "size" => 16, "unit" => "px" }, "font-weight" => "500", "text-align" => "center",
        "margin" => { "top" => 26, "right" => 0, "bottom" => 0, "left" => 0, "unit" => "px" }, "position" => "relative", "z-index" => 2
      },
      mobile: { "font-size" => { "size" => 14, "unit" => "px" }, "max-width" => { "size" => 90, "unit" => "%" } }
    ),
    trust_row,
    dashboard
  ],
  desktop: {
    "display" => "flex", "flex-direction" => "column", "align-items" => "center", "justify-content" => "flex-start",
    "width" => "100%", "min-height" => { "size" => 1170, "unit" => "px" },
    "padding" => { "top" => 43, "right" => 0, "bottom" => 70, "left" => 0, "unit" => "px" },
    "gap" => { "row" => 0, "column" => 0, "unit" => "px" }, "overflow" => "hidden",
    "background-color" => "#070b09",
    "--ink-background-type" => "slideshow",
    "--ink-overlay-background-type" => "gradient",
    "overlay-background-image" => "linear-gradient(180deg,rgba(5,9,7,.995) 0%,rgba(5,9,7,.985) 30%,rgba(5,9,7,.80) 42%,rgba(5,9,7,.55) 60%,rgba(5,9,7,.28) 84%,rgba(7,11,9,.72) 100%)",
    "overlay-opacity" => 1
  },
  tablet: { "min-height" => { "size" => 1241, "unit" => "px" } },
  mobile: { "padding" => { "top" => 48, "right" => 0, "bottom" => 60, "left" => 0, "unit" => "px" }, "min-height" => { "size" => 920, "unit" => "px" } },
  tag: "main"
)

# Use the builder's native background-media runtime rather than a CSS URL. This
# produces the same real <img>/object-fit behaviour as the Framer reference and
# leaves the image, crop, and overlay fully adjustable in the Style panel.
hero["settings"]["backgroundSlideshow"] = {
  "images" => ["https://framerusercontent.com/images/W3crv5wH9zhUiNoioEq9sNGnZs.png?width=2400&height=1984"],
  "loop" => false,
  "duration" => 5_000,
  "transition" => "fade",
  "transitionDuration" => 0,
  "size" => "cover",
  "position" => "center center",
  "lazyload" => false,
  "kenBurns" => false
}

store = {
  "type" => "page",
  "version" => 2,
  "settings" => {
    "backgroundColor" => "#070b09",
    "customFonts" => [
      {
        "family" => "Gambarino Regular",
        "url" => "https://framerusercontent.com/assets/7lzCLCntw0gvV4zRdhieU5AzA.woff2",
        "weight" => "400",
        "style" => "normal",
        "display" => "swap"
      }
    ],
    "theme" => {
      "typography" => { "fontFamily" => "Inter,ui-sans-serif,system-ui,sans-serif", "baseSize" => 16, "lineHeight" => 1.5 },
      "spacing" => { "contentWidth" => 1140, "pageGutter" => 0, "sectionGap" => 0 }
    }
  },
  "children" => [header, announcement, hero]
}
block = {
  "id" => SecureRandom.uuid,
  "type" => "page_builder",
  "data" => {
    "html" => "",
    "store" => store,
    "custom_css" => "",
    "custom_js" => ""
  }
}

page.content = Array(page.content_blocks).reject { |item| item["type"] == "page_builder" } + [block]
page.draft_content = nil
page.save!

puts "Seeded native parity study at /builder/page/#{page.id} (page #{page.id})"
