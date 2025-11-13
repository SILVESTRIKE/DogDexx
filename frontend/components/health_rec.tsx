"use client";

import { useEffect, useState, useMemo } from "react";
import { apiClient } from "@/lib/api-client"; // Đã import useI18n
import { useI18n } from "@/lib/i18n-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Stethoscope } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ==============================================================================
// BƯỚC 1: IMPORT CÁC COMPONENT ACCORDION CẦN THIẾT
// ==============================================================================
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Interface để định nghĩa cấu trúc dữ liệu sau khi phân tích
interface HealthBlock {
  title: string;
  items: string[];
}

// ==============================================================================
// BƯỚC 2: CẬP NHẬT COMPONENT CHÍNH
// ==============================================================================
interface HealthRecommendationsProps {
  breedSlug: string;
  breedName: string;
}

export function HealthRecommendations({ breedSlug, breedName }: HealthRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { locale: lang, t } = useI18n(); // Lấy thêm hàm t

  // Logic fetch dữ liệu không thay đổi
  useEffect(() => {
    if (!breedSlug) return;
    const fetchRecommendations = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiClient.getHealthRecommendations(breedSlug, lang);
        setRecommendations(data.recommendations);
      } catch (err) {
        console.error("Failed to fetch health recommendations:", err);
        setError(err instanceof Error ? err.message : "Failed to load recommendations.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchRecommendations();
  }, [breedSlug, lang]);

  // BƯỚC 3: PHÂN TÍCH DỮ LIỆU TỪ AI THÀNH CẤU TRÚC PHÙ HỢP VỚI ACCORDION
  const structuredData = useMemo(() => {
    if (!recommendations) return [];

    const blocks: HealthBlock[] = [];
    let currentBlock: HealthBlock | null = null;

    recommendations.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('### ')) {
        currentBlock = { title: trimmedLine.substring(4), items: [] };
        blocks.push(currentBlock);
      } else if (trimmedLine.startsWith('- ') && currentBlock) {
        currentBlock.items.push(trimmedLine.substring(2));
      }
    });

    return blocks;
  }, [recommendations]);


  if (isLoading) {
    return (
      <Card className="border-2">
        <CardHeader>
           <Skeleton className="h-8 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || structuredData.length === 0) {
    return null; // Không hiển thị gì nếu có lỗi hoặc không có dữ liệu
  }

  // BƯỚC 4: RENDER RA GIAO DIỆN ACCORDION
  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
            <Stethoscope className="h-6 w-6 text-primary" />
            {t('results.healthRecommendations')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {structuredData.map((block, index) => (
            <AccordionItem value={`item-${index}`} key={index}>
              {/* Tên bệnh sẽ là phần bấm để sổ ra/đóng lại */}
              <AccordionTrigger className="text-base text-left font-semibold">
                {block.title}
              </AccordionTrigger>
              {/* Nội dung khuyến nghị sẽ nằm ở đây */}
              <AccordionContent>
                <ul className="list-disc list-inside space-y-2 pl-2">
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex}>
                      {item}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}