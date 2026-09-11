Multisite::Engine.routes.draw do
  # Public invitation acceptance (token link from the invitation email)
  get "invitations/:token/accept", to: "invitations#accept", as: :accept_invitation

  # Onboarding flow for new sites
  get "onboarding", to: "onboarding#show", as: :onboarding
  post "onboarding", to: "onboarding#update"

  namespace :admin do
    resources :sites do
      collection do
        post :set_site_creation_mode
      end
      member do
        post :activate
        post :deactivate
        delete "domains/:domain_id", to: "sites#remove_domain", as: :remove_domain
        post "domains/:domain_id/check", to: "sites#check_domain", as: :check_domain
        post "domains/:domain_id/make_primary", to: "sites#make_primary", as: :make_primary
      end

      resources :users, controller: "site_users", only: %i[index create update destroy]
      resources :plugins, controller: "site_plugins" do
        collection do
          post :set_mode
        end
        member do
          post :activate
          post :deactivate
        end
      end
    end

    resource :site_switcher, only: %i[create destroy], controller: "site_switcher"
  end
end
