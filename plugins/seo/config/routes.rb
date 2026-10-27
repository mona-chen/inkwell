Seo::Engine.routes.draw do
  post "analyze", to: "admin#analyze"
  get  "seo",       to: "admin#show"
  patch "seo",       to: "admin#update"
  get  "sitemap.xml", to: "admin#sitemap", defaults: { format: :xml }
end
