AiWriter::Engine.routes.draw do
  post "write" => "completions#create"
  post "images" => "images#create"
  post "web" => "web#create"
  post "chat" => "completions#chat"
  post "tool_result" => "completions#tool_result"
  get "settings" => "settings#show"
  post "settings" => "settings#update"
  post "settings/web_check" => "settings#web_check", as: :web_check
  post "settings/mcp_check" => "settings#mcp_check", as: :mcp_check
end
