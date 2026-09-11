module Webhooks
  # Builds a plain, JSON-safe payload for the record carried by a domain event. Kept
  # defensive: plugins that fire hooks for their own records are only introspected when the
  # constant is present.
  module Payload
    module_function

    def build(_event, record)
      case record
      when (Post if defined?(Post))
        post(record)
      when (Page if defined?(Page))
        page(record)
      when (Comment if defined?(Comment))
        comment(record)
      when (ContactForm::Message if defined?(ContactForm::Message))
        contact_message(record)
      when (Newsletter::Subscriber if defined?(Newsletter::Subscriber))
        subscriber(record)
      else
        { id: record.id }
      end
    end

    def post(post)
      {
        id: post.id,
        type: "post",
        title: post.title,
        slug: post.slug,
        status: post.status,
        excerpt: post.excerpt,
        published_at: post.published_at&.iso8601,
        updated_at: post.updated_at&.iso8601,
        author: post.author&.name,
        url: "/posts/#{post.slug}"
      }.compact
    end

    def page(page)
      {
        id: page.id,
        type: "page",
        title: page.title,
        slug: page.slug,
        status: page.status,
        updated_at: page.updated_at&.iso8601,
        author: page.author&.name,
        url: "/pages/#{page.slug}"
      }.compact
    end

    def comment(comment)
      {
        id: comment.id,
        type: "comment",
        post_id: comment.post_id,
        status: comment.status,
        created_at: comment.created_at&.iso8601
      }.compact
    end

    def contact_message(message)
      { id: message.id, type: "contact_message" }
        .merge(message.attributes.symbolize_keys.slice(:name, :email, :subject, :body))
        .compact
    end

    def subscriber(subscriber)
      { id: subscriber.id, type: "subscriber", email: subscriber.email }
    end
  end
end
