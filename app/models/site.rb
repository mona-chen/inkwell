class Site < ApplicationRecord
  has_many :users, dependent: :destroy
  has_many :posts, dependent: :destroy
  has_many :pages, dependent: :destroy
  has_many :terms, dependent: :destroy
  has_many :menus, dependent: :destroy
  has_many :media_items, dependent: :destroy
  has_many :widgets, dependent: :destroy
  has_many :options, dependent: :destroy

  validates :name, :domain, presence: true

  def setting(key, default = nil)
    options.find_by(key: key)&.value&.dig("value") || default
  end

  def set_setting!(key, value)
    options.find_or_initialize_by(key: key).update!(value: { "value" => value })
  end

  def builder_site_parts
    setting("builder_site_parts", {}).presence || {}
  end

  def set_builder_site_parts!(parts)
    allowed = parts.to_h.slice("header", "footer")
    set_setting!("builder_site_parts", allowed)
  end

  # Homepage configuration — mirrors WordPress "Settings → Reading".
  #   show_on_front: "posts" (latest posts) or "page" (a chosen static page)
  #   page_on_front: the Page id to render as the homepage when show_on_front is "page"
  def show_on_front
    setting("show_on_front", "posts")
  end

  def front_page
    id = setting("page_on_front")
    id.present? ? pages.find_by(id: id) : nil
  end

  def front_page?
    show_on_front == "page" && front_page.present?
  end

  # Site logo — the id of a MediaItem in the media library (set via Settings → General).
  def logo_item
    id = setting("site_logo")
    id.present? ? media_items.find_by(id: id) : nil
  end
end
