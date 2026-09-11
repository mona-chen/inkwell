class MarkFirstSiteAsDefault < ActiveRecord::Migration[8.1]
  def up
    return if Site.where(is_default: true).exists?

    Site.order(:id).first&.update_column(:is_default, true)
  end

  def down
    # No-op: downgrades keep previously-defaulted sites defaulted.
  end
end
