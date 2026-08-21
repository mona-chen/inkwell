FactoryBot.define do
  factory :widget do
    site { nil }
    kind { "MyString" }
    area { "MyString" }
    title { "MyString" }
    position { 1 }
    config { "" }
  end
end
