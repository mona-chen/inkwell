# An inherited palette for native Builder documents. Explicit page and element
# values remain authoritative. Values are constrained before producing CSS.
class SiteDesignStyles
  COLORS = { "primary" => "#6750ff", "secondary" => "#64748b", "text" => "#1f2328", "accent" => "#8b5cf6" }.freeze
  FONTS = { "sans" => "Inter,ui-sans-serif,system-ui,sans-serif", "serif" => "Georgia,serif", "mono" => "ui-monospace,SFMono-Regular,monospace" }.freeze
  NUMBERS = { "baseSize" => [16, 10..40], "lineHeight" => [1.5, 1..3], "contentWidth" => [1140, 320..2400], "pageGutter" => [10, 0..100], "sectionGap" => [0, 0..200] }.freeze

  def initialize(values = {})
    @values = values.to_h.stringify_keys
  end

  def values
    colors = COLORS.to_h { |key, fallback| [key, color(@values[key], fallback)] }
    numbers = NUMBERS.to_h { |key, (fallback, range)| [key, number(@values[key], fallback, range)] }
    colors.merge(numbers).merge("font" => FONTS.key?(@values["font"]) ? @values["font"] : "sans")
  end

  def css
    data = values
    variables = COLORS.keys.map { |key| "--ink-site-color-#{key}:#{data[key]}" }
    variables += ["--ink-site-font-family:#{FONTS.fetch(data['font'])}"]
    { "baseSize" => "base-size", "lineHeight" => "line-height", "contentWidth" => "content-width", "pageGutter" => "page-gutter", "sectionGap" => "section-gap" }.each do |key, css_key|
      unit = key == "lineHeight" ? "" : "px"
      variables << "--ink-site-#{css_key}:#{data[key]}#{unit}"
    end
    ":root{#{variables.join(';')}}"
  end

  private

  def color(value, fallback)
    value.to_s.match?(/\A#[0-9a-fA-F]{6}\z/) ? value : fallback
  end

  def number(value, fallback, range)
    parsed = Float(value, exception: false)
    parsed && parsed.finite? && range.cover?(parsed) ? parsed : fallback
  end
end
