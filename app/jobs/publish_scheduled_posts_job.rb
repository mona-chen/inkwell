# Publishes posts whose scheduled_for time has arrived. Runs on a recurring interval
# (see SolidQueue recurring tasks) so a scheduled post goes live without manual action.
class PublishScheduledPostsJob < ApplicationJob
  queue_as :default

  def perform
    Post.where(status: "scheduled").where("scheduled_for <= ?", Time.current).find_each do |post|
      post.update!(status: "published", published_at: post.scheduled_for)
    end
  end
end
