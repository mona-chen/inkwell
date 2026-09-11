module Docs
  # OpenAPI 3.1 description of the read-only Inkwell Content API, served at
  # /docs/openapi.json and rendered by the Scalar API reference page at /docs/api.
  #
  # The API is site-scoped by host: each site answers on its own domain, and a bearer token
  # scoped to that site unlocks drafts/unpublished content.
  module Openapi
    def self.spec
      {
        openapi: "3.1.0",
        info: {
          title: "Inkwell Content API",
          version: "1.0.0",
          description: <<~MD.strip
            Read-only JSON API for Inkwell content, suitable for headless frontends
            (Next.js, Astro, mobile apps).

            **Site scoping.** The API resolves the site from the request host. Point each
            frontend at the site's own domain so `/api/v1/*` returns that site's content.

            **Authentication.** Published content is public. Send `Authorization: Bearer <token>`
            with a site API token (Site Settings → API) to also read drafts and unpublished
            content, and to filter by `status`.
          MD
        },
        servers: [ { url: "/api/v1", description: "Current site" } ],
        tags: [
          { name: "Content", description: "Posts and pages" },
          { name: "Assets", description: "Media library" },
          { name: "Structure", description: "Taxonomies and menus" },
          { name: "Site", description: "Site metadata" }
        ],
        security: [ {}, { bearerAuth: [] } ],
        paths: {
          "/site" => {
            get: {
              tags: [ "Site" ],
              summary: "Site metadata",
              operationId: "getSite",
              responses: {
                "200" => json_response("Site metadata", ref("Site"))
              }
            }
          },
          "/posts" => {
            get: {
              tags: [ "Content" ],
              summary: "List posts",
              operationId: "listPosts",
              parameters: [
                query("page", "integer", "Page number (1-based)"),
                query("per_page", "integer", "Items per page (default 20)"),
                query("status", "string", "Filter by status (requires a token)", enum: %w[draft published scheduled])
              ],
              responses: {
                "200" => list_response("Posts", ref("Post"))
              }
            }
          },
          "/posts/{slug}" => {
            get: {
              tags: [ "Content" ],
              summary: "Get a post by slug",
              operationId: "getPost",
              parameters: [ path_param("slug", "Post slug") ],
              responses: {
                "200" => json_response("A post", ref("Post")),
                "404" => error_response("Not found")
              }
            }
          },
          "/pages" => {
            get: {
              tags: [ "Content" ],
              summary: "List pages",
              operationId: "listPages",
              parameters: [
                query("page", "integer", "Page number (1-based)"),
                query("per_page", "integer", "Items per page (default 50)")
              ],
              responses: {
                "200" => list_response("Pages", ref("Page"))
              }
            }
          },
          "/pages/{slug}" => {
            get: {
              tags: [ "Content" ],
              summary: "Get a page by slug",
              operationId: "getPage",
              parameters: [ path_param("slug", "Page slug") ],
              responses: {
                "200" => json_response("A page", ref("Page")),
                "404" => error_response("Not found")
              }
            }
          },
          "/media" => {
            get: {
              tags: [ "Assets" ],
              summary: "List media",
              operationId: "listMedia",
              parameters: [
                query("page", "integer", "Page number (1-based)"),
                query("per_page", "integer", "Items per page (default 50)")
              ],
              responses: {
                "200" => list_response("Media items", ref("Media"))
              }
            }
          },
          "/taxonomies" => {
            get: {
              tags: [ "Structure" ],
              summary: "List categories and tags",
              operationId: "listTaxonomies",
              parameters: [
                query("taxonomy", "string", "Filter by taxonomy", enum: %w[category tag])
              ],
              responses: {
                "200" => list_response("Terms", ref("Taxonomy"))
              }
            }
          },
          "/menus" => {
            get: {
              tags: [ "Structure" ],
              summary: "List menus with their item tree",
              operationId: "listMenus",
              responses: {
                "200" => list_response("Menus", ref("Menu"))
              }
            }
          },
          "/menus/{location}" => {
            get: {
              tags: [ "Structure" ],
              summary: "Get a menu by location",
              operationId: "getMenu",
              parameters: [ path_param("location", "Menu location", example: "header") ],
              responses: {
                "200" => json_response("A menu", ref("Menu")),
                "404" => error_response("Not found")
              }
            }
          }
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              description: "A site API token. Unlocks drafts and unpublished content."
            }
          },
          schemas: {
            Site: schema(type: "site", properties: {
              name: { type: "string" },
              domain: { type: "string" },
              tagline: { type: [ "string", "null" ] },
              timezone: { type: "string" },
              logo_url: { type: [ "string", "null" ] },
              show_on_front: { type: "string", enum: %w[posts page] },
              front_page: nullable_object(properties: {
                title: { type: "string" }, slug: { type: "string" }, path: { type: "string" }
              }),
              posts_count: { type: "integer" },
              pages_count: { type: "integer" }
            }),
            Post: schema(type: "post", properties: {
              title: { type: "string" },
              slug: { type: "string" },
              excerpt: { type: [ "string", "null" ] },
              status: { type: "string", enum: %w[draft published scheduled trashed] },
              published_at: { type: [ "string", "null" ], format: "date-time" },
              updated_at: { type: "string", format: "date-time" },
              path: { type: "string", example: "/posts/hello-world" },
              url: { type: "string", format: "uri" },
              author: nullable_object(properties: { name: { type: "string" }, slug: { type: "string" } }),
              categories: array_of(term_ref),
              tags: array_of(term_ref),
              featured_image: nullable_object(properties: {
                url: { type: "string" }, alt: { type: [ "string", "null" ] }
              }),
              content: { type: "array", items: { type: "object", additionalProperties: true },
                        description: "Structured content blocks (JSON)." },
              seo: { type: "object", additionalProperties: true }
            }),
            Page: schema(type: "page", properties: {
              title: { type: "string" },
              slug: { type: "string" },
              status: { type: "string" },
              template: { type: "string" },
              parent_id: { type: [ "string", "null" ] },
              menu_order: { type: "integer" },
              updated_at: { type: "string", format: "date-time" },
              path: { type: "string" },
              url: { type: "string", format: "uri" },
              author: nullable_object(properties: { name: { type: "string" }, slug: { type: "string" } }),
              content: { type: "array", items: { type: "object", additionalProperties: true } },
              seo: { type: "object", additionalProperties: true }
            }),
            Media: schema(type: "media", properties: {
              filename: { type: "string" },
              content_type: { type: "string" },
              byte_size: { type: "integer" },
              kind: { type: "string", enum: %w[image document] },
              alt_text: { type: [ "string", "null" ] },
              caption: { type: [ "string", "null" ] },
              path: { type: "string" },
              url: { type: "string", format: "uri" },
              created_at: { type: "string", format: "date-time" }
            }),
            Taxonomy: schema(type: "taxonomy", properties: {
              taxonomy: { type: "string", enum: %w[category tag] },
              name: { type: "string" },
              slug: { type: "string" },
              parent_id: { type: [ "string", "null" ] }
            }),
            Menu: schema(type: "menu", properties: {
              name: { type: "string" },
              location: { type: "string" },
              items: { type: "array", items: { "$ref" => "#/components/schemas/MenuItem" } }
            }),
            MenuItem: {
              type: "object",
              properties: {
                label: { type: "string" },
                url: { type: "string" },
                position: { type: "integer" },
                children: { type: "array", items: { "$ref" => "#/components/schemas/MenuItem" } }
              }
            },
            Error: {
              type: "object",
              properties: {
                errors: {
                  type: "array",
                  items: { type: "object", properties: { title: { type: "string" }, status: { type: "string" } } }
                }
              }
            }
          }
        }
      }
    end

    def self.schema(type:, properties:)
      { type: "object", properties: { id: { type: "string" }, type: { const: type }, attributes: { type: "object", properties: properties } } }
    end

    def self.term_ref
      {
        type: "object",
        properties: { name: { type: "string" }, slug: { type: "string" }, taxonomy: { type: "string" } }
      }
    end

    def self.array_of(items)
      { type: "array", items: items }
    end

    def self.nullable_object(properties:)
      { type: [ "object", "null" ], properties: properties }
    end

    def self.ref(name)
      { "$ref" => "#/components/schemas/#{name}" }
    end

    def self.json_response(description, schema)
      { description: description, content: { "application/json" => { schema: { type: "object", properties: { data: schema } } } } }
    end

    def self.list_response(description, schema)
      {
        description: description,
        content: {
          "application/json" => {
            schema: {
              type: "object",
              properties: {
                data: { type: "array", items: schema },
                meta: { type: "object", properties: { total: { type: "integer" }, page: { type: "integer" }, per_page: { type: "integer" } } }
              }
            }
          }
        }
      }
    end

    def self.error_response(description)
      { description: description, content: { "application/json" => { schema: ref("Error") } } }
    end

    def self.path_param(name, description, example: nil)
      { name: name, in: "path", required: true, description: description, schema: { type: "string", example: example }.compact }
    end

    def self.query(name, type, description, enum: nil)
      schema = { type: type, enum: enum }.compact
      { name: name, in: "query", required: false, description: description, schema: schema }
    end
  end
end
