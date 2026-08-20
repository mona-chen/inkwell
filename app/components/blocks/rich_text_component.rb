module Blocks
  # Renders a TipTap (ProseMirror) JSON document to HTML. The block editor stores JSON, never
  # HTML, so the renderer is a strict schema walk — no stored HTML is ever executed, matching
  # the block system's security model. Marks and nodes are whitelisted; anything unknown is
  # skipped.
  class RichTextComponent < ViewComponent::Base
    def initialize(data:)
      @doc = data["json"] || data
    end

    def call
      return "" if @doc.blank?

      helpers.content_tag(:div, render_node(@doc), class: "rich-text")
    end

    private

    def render_node(node)
      return "".html_safe unless node.is_a?(Hash)

      if node["type"] == "text"
        text = ERB::Util.html_escape(node["text"].to_s)
        return apply_marks(text.html_safe, Array(node["marks"]))
      end

      content = Array(node["content"]).map { |child| render_node(child) }.join.html_safe
      html = render_node_type(node["type"], content, node["attrs"] || {})
      apply_marks(html, Array(node["marks"]))
    end

    def render_node_type(type, content, attrs)
      case type
      when "doc"        then content
      when "paragraph"  then helpers.content_tag(:p, content, class: "text-base leading-relaxed mb-4")
      when "heading"    then helpers.content_tag("h#{attrs["level"].to_i.clamp(1, 6)}", content, class: "font-bold mb-3")
      when "bulletList" then helpers.content_tag(:ul, content, class: "list-disc list-inside mb-4 space-y-1")
      when "orderedList" then helpers.content_tag(:ol, content, class: "list-decimal list-inside mb-4 space-y-1")
      when "listItem"   then helpers.content_tag(:li, content)
      when "blockquote" then helpers.content_tag(:blockquote, content, class: "border-l-4 border-gray-300 pl-4 italic my-4")
      when "codeBlock"  then helpers.content_tag(:pre, helpers.content_tag(:code, content), class: "bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm font-mono my-4")
      when "horizontalRule" then helpers.content_tag(:hr, nil, class: "border-gray-200 my-8")
      when "hardBreak"  then helpers.content_tag(:br)
      when "text"       then content.to_s
      else "".html_safe
      end
    end

    def apply_marks(html, marks)
      marks.reduce(html) do |acc, mark|
        render_mark(mark["type"], acc, mark["attrs"] || {})
      end
    end

    def render_mark(type, content, attrs)
      case type
      when "bold"      then helpers.content_tag(:strong, content)
      when "italic"    then helpers.content_tag(:em, content)
      when "underline" then helpers.content_tag(:u, content)
      when "strike"    then helpers.content_tag(:s, content)
      when "code"      then helpers.content_tag(:code, content, class: "bg-gray-100 rounded px-1 font-mono text-sm")
      when "link"      then helpers.link_to(content, attrs["href"], target: "_blank", rel: "noopener", class: "text-gray-900 underline underline-offset-2 hover:text-gray-500")
      else content
      end
    end
  end
end
