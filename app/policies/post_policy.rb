class PostPolicy < ApplicationPolicy
  def create? = user.can?(:publish_posts) || user.admin?
  def update? = user.admin? || record.author == user || user.can?(:edit_others_posts)
  def destroy? = user.admin? || record.author == user || user.can?(:delete_posts)
  def publish? = user.admin? || record.author == user || user.can?(:publish_posts)

  class Scope < Scope
    def resolve
      user.admin? || user.can?(:edit_others_posts) ? scope.all : scope.where(author: user)
    end
  end
end
