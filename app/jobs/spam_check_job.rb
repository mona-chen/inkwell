# Deliberately a thin stub with a clear filter extension point: a plugin (e.g. an Akismet-style
# spam plugin) registers a `comment_spam_score` filter; core has no opinion on how spam
# detection works, only on what happens with the resulting score.
class SpamCheckJob < ApplicationJob
  queue_as :default

  def perform(comment_id)
    comment = Comment.find_by(id: comment_id)
    return unless comment

    score = Inkwell::Hooks.filter(:comment_spam_score, 0.0, comment: comment)
    comment.update!(status: score > 0.8 ? "spam" : "pending")
  end
end
