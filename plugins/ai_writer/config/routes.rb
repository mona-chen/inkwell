AiWriter::Engine.routes.draw do
  post "write" => "completions#create"
  post "chat" => "completions#chat"
  post "tool_result" => "completions#tool_result"
  get "settings" => "settings#show"
  post "settings" => "settings#update"
end
