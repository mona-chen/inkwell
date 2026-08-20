module Api
  module V1
    class PostsController < Api::BaseController
      def index
        posts = Current.site.posts.published.includes(:author, :terms).order(published_at: :desc)
        posts = posts.page(params[:page]).per(params[:per_page] || 20)

        render_jsonapi posts.map { |post| serialize(post) }, meta: { total: posts.total_count }
      end

      def show
        post = Current.site.posts.published.friendly.find(params[:id])
        render_jsonapi serialize(post)
      end

      private

      def serialize(post)
        {
          id: post.id.to_s,
          type: "post",
          attributes: {
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            status: post.status,
            published_at: post.published_at&.iso8601,
            author: post.author.name,
            categories: post.categories.map(&:name),
            content: post.content_blocks,
          },
        }
      end
    end
  end
end
