"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, Sparkles } from "lucide-react";
import type { RecommendedProduct } from "@/lib/types";

export function RecommendedProducts({ breedSlug, breedName }: { breedSlug: string; breedName: string }) {
  const [products, setProducts] = useState<RecommendedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { locale: lang, t } = useI18n();

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const response = await apiClient.getRecommendedProducts(breedSlug, lang);
        setProducts(response.products); // Lấy mảng products trực tiếp từ response
      } catch (error) {
        console.error("Failed to fetch products", error);
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, [breedSlug, lang]);

  if (isLoading) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">{t('results.recommendedProductsTitle', { breedName })}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-primary" />
        {t('results.recommendedProductsTitle', { breedName })}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product, index) => (
          <a
            key={index}
            href={product.shopeeUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="group"
          >
            <Card className="flex flex-col h-full overflow-hidden transition-all duration-300 group-hover:border-primary group-hover:shadow-lg group-hover:-translate-y-1">
              <CardHeader>
                <CardTitle className="text-lg">{product.category}</CardTitle>
                <CardDescription className="text-sm pt-1 line-clamp-3 h-[60px]">
                  {product.reason}
                </CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto">
                 <Button className="w-full bg-primary text-white">
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    {t('results.findOnShopee')}
                 </Button>
              </CardFooter>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}