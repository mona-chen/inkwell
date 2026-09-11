module Api
  module V1
    class PostsController < Api::BaseController
      def index
        posts = base_scope.includes(:author, :terms).order(published_at: :desc, updated_at: :desc)
        posts = posts.where(status: params[:status]) if include_drafts? && params[:status].present?
        posts = posts.page(params[:page]).per(params[:per_page] || 20)

        render_jsonapi(posts.map { |post| serialize(Api::PostSerializer, post) }, meta: pagination_meta(posts))
      end

      def show
        post = base_scope.friendly.find(params[:id])
        render_jsonapi serialize(Api::PostSerializer, post)
      end

      private

      def base_scope
        include_drafts? ? Current.site.posts : Current.site.posts.published
      end
    end
  end
end
