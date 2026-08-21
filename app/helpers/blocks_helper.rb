# Helpers for rendering a record's block content on the front end. Used by the Page Builder's
# {{ blocks }} token so a builder-built layout can embed the record's standard block-editor
# content at any point.
module BlocksHelper
  # Render every non-builder block of a record via BlockRenderer. The page_builder block is
  # excluded: it stores the builder's own ERB, and rendering it here would recurse.
  def render_block_content(record)
    blocks = Array(record&.content_blocks).reject { |b| b["type"] == "page_builder" }
    return "" if blocks.empty?

    BlockRenderer.render(blocks, self)
  end
end
