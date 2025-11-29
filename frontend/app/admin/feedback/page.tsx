"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Eye,
  Check,
  X,
  Hourglass,
  UserCheck,
  Search,
  Calendar as CalendarIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  getAdminFeedback,
  approveAdminFeedback,
  rejectAdminFeedback,
  browseAdminDatasets,
  AdminFeedbackResponse,
  Feedback,
} from "@/lib/admin-api";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n-context";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CheckIcon, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const initialData: AdminFeedbackResponse = {
  stats: { pending_review: 0, approved_for_training: 0, rejected: 0 },
  userStats: [],
  feedbacks: { data: [], total: 0, page: 1, limit: 10, totalPages: 1 },
};

// Combobox Component for Breed Selection
const BreedCombobox = ({
  breeds,
  value,
  onChange,
  ...props
}: {
  breeds: string[];
  value: string;
  onChange: (value: string) => void;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
>) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {value || t("admin.feedback.dialog.selectOrEnterBreed")}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={true}>
          <CommandInput
            onValueChange={onChange}
            value={value}
            placeholder={t("admin.feedback.dialog.correctedLabelPlaceholder")}
          />
          <CommandList>
            <CommandEmpty>
              {t("admin.feedback.dialog.noBreedFound")}
            </CommandEmpty>
            <CommandGroup>
              {breeds.map((breed) => (
                <CommandItem
                  key={breed}
                  value={breed}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  {breed}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
const MediaDisplay = ({ url, alt }: { url: string; alt: string }) => {
  if (!url) return null;

  const isVideo = /\.(mp4|webm|ogg|mov|m4v)$/i.test(url);

  if (isVideo) {
    return (
      <div className="relative group">
        <video 
          src={url} 
          controls 
          className="max-h-32 w-auto rounded-md border bg-black"
        >
          Trình duyệt của bạn không hỗ trợ thẻ video.
        </video>
        {/* Nút mở tab mới cho video */}
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          title="Mở video trong tab mới"
        >
          <Eye className="h-3 w-3" />
        </a>
      </div>
    );
  }

  // Nếu là ảnh
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img 
        src={url} 
        alt={alt} 
        className="max-h-32 w-auto rounded-md border hover:opacity-80 transition-opacity object-contain" 
      />
    </a>
  );
};
export default function FeedbackManagement() {
  const { t } = useI18n();
  const [data, setData] = useState<AdminFeedbackResponse>(initialData);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isApproveAlertOpen, setIsApproveAlertOpen] = useState(false);
  const [isRejectAlertOpen, setIsRejectAlertOpen] = useState(false);
  const [selectedFeedbackForApproval, setSelectedFeedbackForApproval] =
    useState<Feedback | null>(null);
  const [selectedFeedbackForRejection, setSelectedFeedbackForRejection] =
    useState<Feedback | null>(null);
  const rejectionReasonRef = useRef<HTMLInputElement>(null);
  const [approvedBreeds, setApprovedBreeds] = useState<string[]>([]);
  const [correctedLabel, setCorrectedLabel] = useState("");

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchFeedback = useCallback(
    async (params: {
      page: number;
      status: string;
      search: string;
      startDate?: string;
      endDate?: string;
    }) => {
      setLoading(true);
      try {
        const statusParam = params.status === "all" ? undefined : params.status;
        const result = await getAdminFeedback({
          page: params.page,
          limit: 10,
          status: statusParam,
          search: params.search || undefined,
          startDate: params.startDate,
          endDate: params.endDate,
        });
        setData(result);
      } catch (error) {
        console.log(t("admin.feedback.errors.fetchFailed"), {
          description: (error as Error).message,
        });
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  const fetchApprovedBreeds = useCallback(async () => {
    // Don't set main loading state here to avoid flickering if it's independent
    try {
      const response = await browseAdminDatasets("dataset/approved");
      // directories have { id, name, type }
      const folders = response.directories.map((dir) => String(dir.name));
      setApprovedBreeds(folders);
    } catch (error) {
      console.error("Failed to fetch dataset folders:", error);
    }
  }, []);

  useEffect(() => {
    setPage(1); // Reset page when filters change
  }, [statusFilter, debouncedSearchQuery, dateRange]);

  useEffect(() => {
    fetchFeedback({
      page,
      status: statusFilter,
      search: debouncedSearchQuery,
      startDate: dateRange?.from?.toISOString(),
      endDate: dateRange?.to?.toISOString(),
    });
    fetchApprovedBreeds();
  }, [
    page,
    statusFilter,
    debouncedSearchQuery,
    dateRange,
    fetchFeedback,
    fetchApprovedBreeds,
  ]);

  const { stats, userStats, feedbacks } = data;
  const totalFeedback =
    stats.pending_review + stats.approved_for_training + stats.rejected;
  const accuracy =
    totalFeedback > 0
      ? ((stats.approved_for_training / totalFeedback) * 100).toFixed(1)
      : "0.0";

  useEffect(() => {
    if (selectedFeedbackForApproval) {
      setCorrectedLabel(
        selectedFeedbackForApproval.feedbackContent.isCorrect
          ? selectedFeedbackForApproval.aiPrediction?.class || ""
          : selectedFeedbackForApproval.feedbackContent.userSubmittedLabel || ""
      );
    }
  }, [selectedFeedbackForApproval]);

  const handleApprove = async () => {
    if (!selectedFeedbackForApproval) return;

    const feedbackId = selectedFeedbackForApproval.id;

    setIsApproveAlertOpen(false);
    console.log(t("admin.feedback.actions.approving"));

    try {
      const result = await approveAdminFeedback(feedbackId, { correctedLabel });
      console.log(result.message);
      // Cập nhật lại UI, bao gồm cả stats và danh sách
      setData((prevData) => {
        const newStats = { ...prevData.stats };
        newStats.pending_review = Math.max(0, newStats.pending_review - 1);
        newStats.approved_for_training += 1;

        return {
          ...prevData,
          stats: newStats,
          feedbacks: {
            ...prevData.feedbacks, // Cập nhật trạng thái của feedback đã được duyệt
            data: prevData.feedbacks.data.map((f) =>
              f.id === feedbackId
                ? { ...f, status: "approved_for_training" }
                : f
            ),
          },
        };
      });
    } catch (error) {
      console.log(t("admin.feedback.errors.approveFailed"), {
        description: (error as Error).message,
      });
    } finally {
      setSelectedFeedbackForApproval(null);
      setCorrectedLabel("");
    }
  };

  const handleReject = async () => {
    if (!selectedFeedbackForRejection) return;
    const feedbackId = selectedFeedbackForRejection.id;
    const reason = rejectionReasonRef.current?.value;
    setIsRejectAlertOpen(false);
    console.log(t("admin.feedback.actions.rejecting"));
    try {
      const result = await rejectAdminFeedback(feedbackId, { reason });
      console.log(result.message);
      // Cập nhật lại UI, bao gồm cả stats và danh sách
      setData((prevData) => {
        const newStats = { ...prevData.stats };
        newStats.pending_review = Math.max(0, newStats.pending_review - 1);
        newStats.rejected += 1;

        return {
          ...prevData,
          stats: newStats,
          feedbacks: {
            ...prevData.feedbacks,
            data: prevData.feedbacks.data.map((f) =>
              f.id === feedbackId ? { ...f, status: "rejected" } : f
            ),
          },
        };
      });
    } catch (error) {
      console.log(t("admin.feedback.errors.rejectFailed"), {
        description: (error as Error).message,
      });
    } finally {
      setSelectedFeedbackForRejection(null);
    }
  };
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          {t("admin.feedback.title")}
        </h2>
        <p className="text-muted-foreground">
          {t("admin.feedback.description")}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("admin.feedback.stats.pending")}
            </CardTitle>
            <Hourglass className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.pending_review}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("admin.feedback.stats.approved")}
            </CardTitle>
            <Check className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-green-600">
                {stats.approved_for_training}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("admin.feedback.stats.rejected")}
            </CardTitle>
            <X className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-red-600">
                {stats.rejected}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("admin.feedback.stats.approvalRate")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{accuracy}%</div>
            )}
            <p className="text-xs text-muted-foreground">
              {t("admin.feedback.errors.approvalRateDescription", {
                count: totalFeedback,
              })}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="feedbacks" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="feedbacks">
            {t("admin.feedback.tabs.list")}
          </TabsTrigger>
          <TabsTrigger value="user-stats">
            {t("admin.feedback.tabs.userStats")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="feedbacks">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t("admin.feedback.table.title")}</CardTitle>
                  <CardDescription>
                    {t("admin.feedback.table.description")}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t(
                        "admin.feedback.filters.searchPlaceholder"
                      )}
                      className="pl-10 w-64"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="date"
                        variant={"outline"}
                        className="w-[300px] justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "LLL dd, y")} -{" "}
                              {format(dateRange.to, "LLL dd, y")}
                            </>
                          ) : (
                            format(dateRange.from, "LLL dd, y")
                          )
                        ) : (
                          <span>{t("admin.feedback.filters.pickDate")}</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSearchQuery("");
                      setDateRange(undefined);
                    }}
                    className={!searchQuery && !dateRange ? "hidden" : ""}
                  >
                    {t("admin.feedback.filters.clear")}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Tabs để lọc theo trạng thái */}
              <div className="mb-4">
                <Tabs
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                  className="w-full"
                >
                  <TabsList>
                    <TabsTrigger value="all">
                      {t("admin.feedback.filters.all")}
                    </TabsTrigger>
                    <TabsTrigger value="pending_review">
                      {t("admin.feedback.filters.pending")}
                    </TabsTrigger>
                    <TabsTrigger value="approved_for_training">
                      {t("admin.feedback.filters.approved")}
                    </TabsTrigger>
                    <TabsTrigger value="rejected">
                      {t("admin.feedback.filters.rejected")}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {t("admin.feedback.table.headers.time")}
                    </TableHead>
                    <TableHead>
                      {t("admin.feedback.table.headers.user")}
                    </TableHead>
                    <TableHead>
                      {t("admin.feedback.table.headers.prediction")}
                    </TableHead>
                    <TableHead>
                      {t("admin.feedback.table.headers.result")}
                    </TableHead>
                    <TableHead>
                      {t("admin.feedback.table.headers.status")}
                    </TableHead>
                    <TableHead>
                      {t("admin.feedback.table.headers.action")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={6}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : feedbacks.data.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground py-8"
                      >
                        {t("admin.feedback.table.noFeedback")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    feedbacks.data.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="text-sm">
                          {new Date(f.feedbackTimestamp).toLocaleDateString(
                            "vi-VN",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            }
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {f.user?.name || t("common.guest")}
                        </TableCell>
                        <TableCell className="font-medium">
                          {f.aiPrediction?.class || "N/A"}
                        </TableCell>
                        <TableCell>
                          {f.feedbackContent.isCorrect ? (
                            <Badge
                              variant="default"
                              className="gap-1 bg-green-600"
                            >
                              <ThumbsUp className="h-3 w-3" />
                              {t("feedback.yes")}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <ThumbsDown className="h-3 w-3" />
                              {t("feedback.no")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {f.status === "pending_review" && (
                            <Badge
                              variant="outline"
                              className="border-yellow-500 text-yellow-600"
                            >
                              <Hourglass className="h-3 w-3 mr-1" />
                              {t("admin.feedback.filters.pending")}
                            </Badge>
                          )}
                          {f.status === "approved_for_training" && (
                            <Badge
                              variant="default"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Check className="h-3 w-3 mr-1" />
                              {t("admin.feedback.filters.approved")}
                            </Badge>
                          )}
                          {f.status === "rejected" && (
                            <Badge variant="destructive">
                              {t("admin.feedback.filters.rejected")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[600px]">
                              <DialogHeader>
                                <DialogTitle>
                                  {t("admin.feedback.dialog.title")}
                                </DialogTitle>
                                <DialogDescription>
                                  {t("admin.feedback.dialog.description")}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-start gap-4">
                                  <p className="text-right font-semibold">
                                    {t("admin.feedback.dialog.originalImage")}:
                                  </p>
                                  <div className="col-span-3 flex flex-wrap gap-4">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs text-muted-foreground">
                                        Original
                                      </span>
                                      <MediaDisplay
                                        url={f.originalMediaUrl}
                                        alt="Original"
                                      />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs text-muted-foreground">
                                        Processed
                                      </span>
                                      <MediaDisplay
                                        url={f.processedMediaUrl}
                                        alt="Processed"
                                      />
                                    </div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                  <p className="text-right font-semibold">
                                    {t("admin.feedback.dialog.aiPrediction")}:
                                  </p>
                                  <p className="col-span-3">
                                    {f.aiPrediction?.class || "N/A"} (
                                    {Math.round(
                                      (f.aiPrediction?.confidence || 0) * 100
                                    )}
                                    %)
                                  </p>
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                  <p className="text-right font-semibold">
                                    {t("admin.feedback.dialog.userSays")}:
                                  </p>
                                  <p className="col-span-3 font-bold">
                                    {f.feedbackContent.isCorrect
                                      ? t("feedback.yes")
                                      : `${t("feedback.no")}, ${t(
                                          "admin.feedback.dialog.mustBe"
                                        )}: ${
                                          f.feedbackContent.userSubmittedLabel
                                        }`}
                                  </p>
                                </div>
                                {f.feedbackContent.notes && (
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <p className="text-right font-semibold">
                                      {t("admin.feedback.dialog.notes")}:
                                    </p>
                                    <p className="col-span-3 text-sm text-muted-foreground italic">
                                      "{f.feedbackContent.notes}"
                                    </p>
                                  </div>
                                )}
                              </div>
                              <div className="flex justify-end gap-2 pt-4 border-t">
                                {f.status === "pending_review" && (
                                  <>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedFeedbackForRejection(f);
                                        setIsRejectAlertOpen(true);
                                      }}
                                    >
                                      <X className="h-4 w-4 mr-2" />
                                      {t("admin.feedback.actions.reject")}
                                    </Button>
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700"
                                      onClick={() => {
                                        setSelectedFeedbackForApproval(f);
                                        setIsApproveAlertOpen(true);
                                      }}
                                    >
                                      <Check className="h-4 w-4 mr-2" />
                                      {t("admin.feedback.actions.approve")}
                                    </Button>
                                  </>
                                )}
                                {f.status === "approved_for_training" && (
                                  <Badge
                                    variant="default"
                                    className="bg-green-600 gap-1"
                                  >
                                    <Check className="h-3 w-3" />
                                    {t("admin.feedback.status.approved")}
                                  </Badge>
                                )}
                                {f.status === "rejected" && (
                                  <Badge
                                    variant="destructive"
                                    className="gap-1"
                                  >
                                    <X className="h-3 w-3" />
                                    {t("admin.feedback.status.rejected")}
                                  </Badge>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {!loading && feedbacks.totalPages > 1 && (
                <Pagination className="mt-6">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setPage((p) => Math.max(1, p - 1));
                        }}
                        className={
                          feedbacks.page <= 1
                            ? "pointer-events-none opacity-50"
                            : ""
                        }
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <span className="px-4 py-2 text-sm">
                        {t("admin.userPageIndicator", {
                          page: feedbacks.page,
                          totalPages: feedbacks.totalPages,
                        })}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setPage((p) => Math.min(feedbacks.totalPages, p + 1));
                        }}
                        className={
                          feedbacks.page >= feedbacks.totalPages
                            ? "pointer-events-none opacity-50"
                            : ""
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="user-stats">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.feedback.userStats.title")}</CardTitle>
              <CardDescription>
                {t("admin.feedback.userStats.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {t("admin.feedback.userStats.headers.user")}
                    </TableHead>
                    <TableHead>
                      {t("admin.feedback.userStats.headers.total")}
                    </TableHead>
                    <TableHead>
                      {t("admin.feedback.userStats.headers.approved")}
                    </TableHead>
                    <TableHead>
                      {t("admin.feedback.userStats.headers.rejected")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ) : (
                    userStats.map((u) => (
                      <TableRow key={u.userId}>
                        <TableCell className="font-medium">
                          {u.username}
                        </TableCell>
                        <TableCell>{u.totalSubmissions}</TableCell>
                        <TableCell className="text-green-600">
                          {u.approvedCount}
                        </TableCell>
                        <TableCell className="text-red-600">
                          {u.rejectedCount}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approval Confirmation Dialog */}
      <AlertDialog
        open={isApproveAlertOpen}
        onOpenChange={setIsApproveAlertOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.feedback.dialog.approveTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.feedback.dialog.approveDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="correctedLabel">
              {t("admin.feedback.dialog.correctedLabel")}
            </Label>
            <BreedCombobox
              breeds={approvedBreeds}
              value={correctedLabel}
              onChange={setCorrectedLabel}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setSelectedFeedbackForApproval(null);
                setCorrectedLabel("");
              }}
            >
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              className="bg-green-600 hover:bg-green-700"
            >
              {t("admin.feedback.actions.approve")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rejection Confirmation Dialog */}
      <AlertDialog open={isRejectAlertOpen} onOpenChange={setIsRejectAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.feedback.dialog.rejectTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.feedback.dialog.rejectDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="rejectionReason">
              {t("admin.feedback.dialog.rejectionReason")}
            </Label>
            <Input
              id="rejectionReason"
              ref={rejectionReasonRef}
              placeholder={t(
                "admin.feedback.dialog.rejectionReasonPlaceholder"
              )}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setSelectedFeedbackForRejection(null)}
            >
              {t("common.cancel")}
            </AlertDialogCancel>
            <Button onClick={handleReject} variant="destructive">
              {t("admin.feedback.actions.reject")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
