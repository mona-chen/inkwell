AiWriter::Engine.routes.draw do
  post "write" => "completions#create"
  post "chat" => "completions#chat"
  get "settings" => "settings#show"
  post "settings" => "settings#update"
end
