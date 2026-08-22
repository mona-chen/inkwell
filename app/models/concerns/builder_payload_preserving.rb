module BuilderPayloadPreserving
  extend ActiveSupport::Concern

  private

  # The classic block editor can position a page-builder block, but it does not own the
  # builder's recursive store or its CSS/JS files. Publishing from the classic editor must
  # therefore never replace a complete builder block with the editor's HTML-only projection.
  def publishable_draft_content
    draft_blocks = Array(draft_content).deep_dup
    builder_blocks = Array(content).select { |block| block["type"] == "page_builder" }
    builder_index = 0

    merged = draft_blocks.map do |block|
      next block unless block["type"] == "page_builder"

      preserved = builder_blocks[builder_index]
      builder_index += 1
      preserved&.deep_dup || block
    end

    builder_blocks.drop(builder_index).each { |block| merged << block.deep_dup }
    merged
  end
end
