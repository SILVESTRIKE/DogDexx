"use client";

import { useState, useMemo } from "react";
import { apiClient } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Stethoscope, ChevronDown, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface HealthBlock {
  title: string;
  items: string[];
}
interface StructuredHealthData {
  generalCare: HealthBlock[];
  commonIssues: HealthBlock[];
}

const SimpleMarkdown: React.FC<{ text: string }> = ({ text }) => {
  const html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
};

interface HealthRecommendationsProps {
  breedSlug: string;
  breedName: string;
}

export function HealthRecommendations({ breedSlug, breedName }: HealthRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { locale: lang, t } = useI18n();

  // Fetch data khi user click expand (lazy load)
  async function handleExpand() {
    if (isExpanded) {
      // Collapse
      setIsExpanded(false);
      return;
    }

    // Expand
    setIsExpanded(true);

    // Chỉ fetch nếu chưa có data
    if (recommendations) return;

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
  }

  const structuredData = useMemo(() => {
    if (!recommendations) return { generalCare: [], commonIssues: [] };

    const generalCare: HealthBlock[] = [];
    const commonIssues: HealthBlock[] = [];
    let currentBlock: HealthBlock | null = null;

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

  // Collapsed state: Show full-width button only
  if (!isExpanded) {
    return (
      <Button
        variant="outline"
        className="w-full h-14 justify-between text-left border-2 hover:bg-primary/5 hover:border-primary/50 transition-all"
        onClick={handleExpand}
      >
        <div className="flex items-center gap-3">
          <Stethoscope className="h-5 w-5 text-primary" />
          <span className="font-medium">{t('results.healthRecommendations')}</span>
        </div>
        <ChevronDown className="h-5 w-5 text-muted-foreground" />
      </Button>
    );
  }

  // Loading state after expand
  if (isLoading) {
    return (
      <Card className="border-2 border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
            {t('results.healthRecommendations')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Error or no data
  if (error || (structuredData.generalCare.length === 0 && structuredData.commonIssues.length === 0)) {
    return (
      <Card className="border-2 border-destructive/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Stethoscope className="h-5 w-5 text-destructive" />
              {t('results.healthRecommendations')}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={handleExpand}>
              Thu gọn
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {error || "Không có dữ liệu sức khỏe cho giống chó này."}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Expanded with data
  return (
    <Card className="border-2 border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Stethoscope className="h-6 w-6 text-primary" />
            {t('results.healthRecommendations')}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExpand}
            className="text-muted-foreground hover:text-foreground"
          >
            Thu gọn
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
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

          {structuredData.commonIssues.length > 0 && (
            <AccordionItem value="common-health-issues">
              <AccordionTrigger className="text-base text-left font-semibold">
                {t('results.commonHealthIssues')}
              </AccordionTrigger>
              <AccordionContent>
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
