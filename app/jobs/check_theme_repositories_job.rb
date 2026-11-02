class CheckThemeRepositoriesJob < ApplicationJob
  queue_as :default
  def perform
    ThemeRepositorySource.where(auto_update: true).where("checked_at IS NULL OR checked_at < ?", 4.minutes.ago).find_each do |source|
      SyncThemeRepositoryJob.perform_later(source.id, automatic: true)
    end
  end
end
