"use client"

import { Card } from "@/components/ui/card"
import { useI18n } from "@/lib/i18n-context"
import Footer from "@/components/footer"

export default function ApiDocsPage() {
  const { t } = useI18n()

  const endpoints = [
    {
      method: "POST",
      path: "/bff/predict/image",
      description: "Predict dog breed from image",
      example: `curl -X POST http://localhost:3000/bff/predict/image \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -F "file=@dog.jpg"`,
    },
    {
      method: "POST",
      path: "/bff/predict/video",
      description: "Predict dog breed from video",
      example: `curl -X POST http://localhost:3000/bff/predict/video \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -F "file=@dog.mp4"`,
    },
    {
      method: "GET",
      path: "/bff/collection/pokedex",
      description: "Get all dog breeds",
      example: `curl -X GET http://localhost:3000/bff/collection/pokedex \\
  -H "Authorization: Bearer YOUR_TOKEN"`,
    },
    {
      method: "POST",
      path: "/bff/collection/add/:slug",
      description: "Add breed to collection",
      example: `curl -X POST http://localhost:3000/bff/collection/add/labrador \\
  -H "Authorization: Bearer YOUR_TOKEN"`,
    },
  ]

  return (
    <>
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16">
          <div className="mb-12">
            <h1 className="text-4xl font-bold mb-4">{t("apiDocs.title") || "API Documentation"}</h1>
            <p className="text-xl text-muted-foreground">
              {t("apiDocs.subtitle") || "Build amazing applications with DogPokedex API"}
            </p>
          </div>

          {/* Authentication */}
          <Card className="p-8 mb-8">
            <h2 className="text-2xl font-bold mb-4">{t("apiDocs.authentication") || "Authentication"}</h2>
            <p className="text-muted-foreground mb-4">
              {t("apiDocs.authText") || "All API requests require a Bearer token in the Authorization header."}
            </p>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
              Authorization: Bearer YOUR_ACCESS_TOKEN
            </div>
          </Card>

          {/* Endpoints */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-6">{t("apiDocs.endpoints") || "Endpoints"}</h2>
            <div className="space-y-6">
              {endpoints.map((endpoint, idx) => (
                <Card key={idx} className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <span
                      className={`px-3 py-1 rounded text-sm font-bold text-white ${
                        endpoint.method === "GET"
                          ? "bg-blue-500"
                          : endpoint.method === "POST"
                            ? "bg-green-500"
                            : endpoint.method === "PUT"
                              ? "bg-yellow-500"
                              : "bg-red-500"
                      }`}
                    >
                      {endpoint.method}
                    </span>
                    <div className="flex-1">
                      <code className="font-mono text-sm">{endpoint.path}</code>
                      <p className="text-muted-foreground text-sm mt-1">{endpoint.description}</p>
                    </div>
                  </div>
                  <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{endpoint.example}</pre>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Response Format */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold mb-4">{t("apiDocs.responseFormat") || "Response Format"}</h2>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
              <pre>{`{
  "success": true,
  "predictions": [
    {
      "class": "Labrador Retriever",
      "confidence": 0.95,
      "box": [100, 150, 300, 400]
    }
  ],
  "processedImageUrl": "https://..."
}`}</pre>
            </div>
          </Card>
        </div>
      </main>
      <Footer />
    </>
  )
}
