class Widget < ApplicationRecord
  # A reusable chunk of content placed in a theme "widget area" (sidebar, footer columns).
  # Kinds map to render partials in app/views/widgets/<kind>_widget.html.erb; plugins can
  # register their own kinds through a filter (see WidgetsHelper).
  KINDS = %w[text recent_posts social].freeze

  AREAS = %w[sidebar footer-1 footer-2 footer-3].freeze

  belongs_to :site

  validates :kind, inclusion: { in: KINDS }
  validates :area, inclusion: { in: AREAS }
  validates :title, presence: true, if: :needs_title?

  scope :in_area, ->(area) { where(area: area).order(position: :asc, id: :asc) }

  def needs_title?
    kind != "recent_posts" # recent posts widget renders its own heading
  end
end
