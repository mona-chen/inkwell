Rails.application.routes.draw do
  devise_for :users, controllers: {
    sessions: "users/sessions",
    passwords: "users/passwords"
  }

  root to: "site#home"

  resources :posts, only: [:show], param: :id do
    resources :comments, only: [:create]
  end
  resources :pages, only: [:show], param: :id

  namespace :admin do
    root to: "dashboard#show"

    resources :posts, except: [:show] do
      member { post :publish }
      resources :revisions, controller: "post_revisions", only: %i[index show] do
        member { post :restore }
      end
    end
    resources :pages do
      member { post :publish }
    end
    resources :media, only: [:index, :create, :destroy]
    resources :comments, only: [:index, :update, :destroy]
    resources :menus do
      resources :menu_items, only: [:create, :update, :destroy]
    end
    resource :settings, only: [:show, :update]

    resources :plugins, only: [:index] do
      member do
        post :activate
        post :deactivate
      end
    end

    resources :themes, only: [:index] do
      member do
        post :activate
        get :preview
      end
    end
  end

  namespace :api do
    namespace :v1 do
      resources :posts, only: [:index, :show] # pattern implementation; expand per-resource as needed
    end
  end

  # Page Builder gets its own top-level mount so the URL is clean (/builder/...)
  mount PageBuilder::Engine => "/builder"

  # Every other plugin's own routes.rb is mounted here automatically.
  Inkwell::PluginManager.discovered.each do |engine_class|
    next unless engine_class.paths["config/routes.rb"].existent.any?
    next if engine_class == PageBuilder::Engine

    mount engine_class => "/plugins/#{engine_class.instance.plugin_slug}"
  end
end
