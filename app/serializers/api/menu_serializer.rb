module Api
  class MenuSerializer < BaseSerializer
    def attributes
      {
        name: record.name,
        location: record.location,
        items: items_for(record.menu_items.where(parent_id: nil).order(:position))
      }.compact
    end

    private

    def items_for(items)
      items.map do |item|
        children = items_for(item.children.order(:position))
        {
          label: item.label,
          url: item.resolved_url,
          position: item.position,
          children: children.presence
        }.compact
      end
    end
  end
end
