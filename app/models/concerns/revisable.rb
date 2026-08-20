module Revisable
  extend ActiveSupport::Concern

  included do
    has_many :revisions, class_name: "PostRevision", dependent: :destroy
  end

  def restore_revision!(revision)
    update!(title: revision.title_snapshot, content: revision.content_snapshot)
  end
end
