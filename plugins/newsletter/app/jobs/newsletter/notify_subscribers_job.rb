module Newsletter
  class NotifySubscribersJob < ApplicationJob
    queue_as :low

    def perform(post_id)
      post = Post.find(post_id)
      Newsletter::Subscriber.where(site_id: post.site_id, status: "confirmed").find_each do |sub|
        Rails.logger.info("[Newsletter] would notify #{sub.email} about \"#{post.title}\"")
        # Real install: NewsletterMailer.new_post(sub, post).deliver_later
      end
    end
  end
end
