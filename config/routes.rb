Rails.application.routes.draw do
  devise_for :users, controllers: {
    sessions: "users/sessions",
    passwords: "users/passwords"
  }, skip: [ :registrations ]

  # Public self-service account creation (registerable is enabled on User, but we expose
  # only the sign-up routes — the account-edit/destroy routes are unused in Inkwell).
  devise_scope :user do
    get  "users/sign_up", to: "users/registrations#new", as: :new_user_registration
    post "users",          to: "users/registrations#create", as: :user_registration
  end

  root to: "site#home"
  get "feed.xml", to: "site#feed", defaults: { format: "xml" }
  get "sitemap.xml", to: "site#sitemap", defaults: { format: "xml" }
  get "media/:id/file", to: "media_files#show", as: :media_file

  # Public documentation and API reference.
  get "docs", to: "docs#index", as: :docs
  get "docs/api", to: "docs#api", as: :docs_api
  get "docs/openapi.json", to: "docs#openapi", as: :docs_openapi

  resources :posts, only: [:index, :show], param: :id do
    resources :comments, only: [:create]
  end
  get "tags/:slug", to: "posts#index", as: :tag_posts, slug: /[a-z0-9-]+/
  get "authors/:slug", to: "authors#show", as: :author, slug: /[a-z0-9-]+/
  resources :pages, only: [:show], param: :id

  namespace :admin do
    root to: "dashboard#show"

    resources :posts, except: [:show] do
      member { post :publish }
      resources :revisions, controller: "post_revisions", only: %i[index show] do
        member { post :restore }
      end
    end
    resources :taxonomies, only: [:index, :create, :update, :destroy]
    resources :pages, except: :show do
      member { post :publish }
      member { post :publish_original_import }
    end
    resources :website_imports, only: %i[index new create show] do
      resource :application, only: :create, module: :website_imports
    end
    resources :media, only: [:index, :create, :update, :destroy]
    resources :comments, only: [:index, :update, :destroy]
    resources :menus, only: %i[index show] do
      resources :menu_items, only: [:create, :update, :destroy]
    end
    resources :widgets, only: [:index, :create, :update, :destroy]
    resource :settings, only: [:show, :update] do
      member { post :purge_cache }
    end

    resources :api_tokens, only: [:create, :destroy]

    resources :plugins, only: [:index] do
      member do
        post :activate
        post :deactivate
      end
    end

    resources :users, only: %i[index create update destroy] do
      member do
        post :deactivate
        post :reactivate
      end
    end

    resources :themes, only: [:index] do
      member do
        post :activate
        get :preview
      end
    end
    get "templates", to: "templates#index", as: :templates
    post "templates/:role", to: "templates#create", as: :create_template
  end

  namespace :api do
    namespace :v1 do
      resource :site, only: [:show], controller: "site"
      resources :posts, only: [:index, :show]
      resources :pages, only: [:index, :show]
      resources :media, only: [:index]
      resources :taxonomies, only: [:index]
      resources :menus, only: [:index, :show], param: :location
    end
  end

  # Page Builder gets its own top-level mount so the URL is clean (/builder/...)
  mount PageBuilder::Engine => "/builder"

  # Multisite: self-serve site creation gets clean top-level URLs (/signup, /new-site)
  # instead of nested under the plugin mount. Only present when the plugin is installed.
  if defined?(Multisite::Engine)
    get  "signup",   to: "multisite/registrations#new", as: :signup
    post "signup",   to: "multisite/registrations#create"
    get  "new-site", to: "multisite/registrations#new_site", as: :new_site
    post "new-site", to: "multisite/registrations#create_site"

    mount Multisite::Engine => "/plugins/multisite"
  end

  # Every other plugin's own routes.rb is mounted here automatically.
  Inkwell::PluginManager.discovered.each do |engine_class|
    next unless engine_class.paths["config/routes.rb"].existent.any?
    next if [PageBuilder::Engine, (Multisite::Engine if defined?(Multisite::Engine))].compact.include?(engine_class)

    mount engine_class => "/plugins/#{engine_class.instance.plugin_slug}"
  end
end
