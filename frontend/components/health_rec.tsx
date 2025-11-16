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

// Cấu trúc dữ liệu mới để phân loại các mục
interface StructuredHealthData {
  generalCare: HealthBlock[];
  commonIssues: HealthBlock[];
}

// Helper component to render simple markdown (bold)
const SimpleMarkdown: React.FC<{ text: string }> = ({ text }) => {
  const html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
};

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
    if (!recommendations) return { generalCare: [], commonIssues: [] };

    const generalCare: HealthBlock[] = [];
    const commonIssues: HealthBlock[] = [];
    let currentBlock: HealthBlock | null = null;

    // Từ khóa để xác định các mục chăm sóc chung (có thể cần điều chỉnh nếu prompt thay đổi)
    const generalCareKeywords = [
        "nutrition", "dinh dưỡng", 
        "exercise", "vận động", 
        "grooming", "chăm sóc bộ lông", 
        "vaccination", "tiêm phòng", 
        "apartment", "căn hộ"
    ];

    recommendations.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('### ')) {
        currentBlock = { title: trimmedLine.substring(4), items: [] };
        // Phân loại vào nhóm generalCare hoặc commonIssues
        if (generalCareKeywords.some(keyword => currentBlock!.title.toLowerCase().includes(keyword))) {
          generalCare.push(currentBlock);
        } else {
          commonIssues.push(currentBlock);
        }
      } else if (trimmedLine.startsWith('- ') && currentBlock) {
        currentBlock.items.push(trimmedLine.substring(2));
      }
    });
    return { generalCare, commonIssues };
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

  if (error || (structuredData.generalCare.length === 0 && structuredData.commonIssues.length === 0)) {
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
          {/* Render các mục chăm sóc chung */}
          {structuredData.generalCare.map((block, index) => (
            <AccordionItem value={`item-${index}`} key={index}>
              <AccordionTrigger className="text-base text-left font-semibold">
                {block.title}
              </AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc list-inside space-y-2 pl-2">
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex}><SimpleMarkdown text={item} /></li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}

          {/* Render mục gộp cho các vấn đề sức khỏe */}
          {structuredData.commonIssues.length > 0 && (
            <AccordionItem value="common-health-issues">
              <AccordionTrigger className="text-base text-left font-semibold">
                {t('results.commonHealthIssues')}
              </AccordionTrigger>
              <AccordionContent>
                {/* Accordion lồng bên trong */}
                <Accordion type="single" collapsible className="w-full pl-4 border-l-2 border-border">
                  {structuredData.commonIssues.map((issue, index) => (
                    <AccordionItem value={`issue-${index}`} key={`issue-${index}`}>
                      <AccordionTrigger className="text-base text-left">
                        {issue.title}
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="list-disc list-inside space-y-2 pl-2">
                          {issue.items.map((item, itemIndex) => <li key={itemIndex}><SimpleMarkdown text={item} /></li>)}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </CardContent>
    </Card>
  );
}
