class PagePolicy < ApplicationPolicy
  def create? = user.can?(:edit_pages) || user.admin?
  def update? = user.can?(:edit_pages) || user.admin?
  def destroy? = user.admin? || user.can?(:edit_pages)

  class Scope < Scope
    def resolve
      scope.all
    end
  end
end
