"use client";

import { useState, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query"; 
import { apiClient } from "@/lib/api-client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { format } from "date-fns";

// Định nghĩa lại Interface cho khớp với dữ liệu Backend trả về
interface Subscription {
  _id: string;
  userId: {
    _id: string;
    username?: string;
    email: string;
  } | null; // userId có thể null nếu user bị xóa
  planId: {
    name: string;
  } | null;
  status: string;
  // SỬA LỖI DATE: Dùng đúng tên trường trong DB
  currentPeriodStart: string; 
  currentPeriodEnd: string;
}

const SubscriptionStatusBadge = ({ status }: { status: string }) => {
  const variant = useMemo(() => {
    switch (status) {
      case "active":
        return "default"; // Xanh lá/Đen tùy theme
      case "pending":
      case "trialing":
        return "secondary"; // Xám
      case "cancelled":
      case "expired":
      case "past_due":
        return "destructive"; // Đỏ
      default:
        return "outline";
    }
  }, [status]);

  return (
    <Badge variant={variant} className="capitalize">
      {status.replace('_', ' ')}
    </Badge>
  );
};

export default function AdminSubscriptionsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = searchParams.get("page") ?? "1";
  const limit = searchParams.get("limit") ?? "10";
  const search = searchParams.get("search") ?? "";

  const [searchTerm, setSearchTerm] = useState(search);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-subscriptions", { page, limit, search }],
    queryFn: () => apiClient.getAdminSubscriptions({ page: Number(page), limit: Number(limit), search }),
  });

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams);
    params.set("page", "1");
    params.set("search", searchTerm);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(newPage));
    router.push(`${pathname}?${params.toString()}`);
  };

  const subscriptions = data?.data ?? [];
  const pagination = data?.pagination;

  const renderPagination = () => {
    if (!pagination || pagination.totalPages <= 1) return null;

    const pageNumbers = [];
    const currentPage = pagination.page;
    const totalPages = pagination.totalPages;
    const pageRange = 2;

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - pageRange && i <= currentPage + pageRange)
      ) {
        pageNumbers.push(i);
      }
    }

    const paginationItems = [];
    let lastPage = 0;
    for (const pageNum of pageNumbers) {
      if (lastPage !== 0 && pageNum > lastPage + 1) {
        paginationItems.push(<PaginationItem key={`ellipsis-${lastPage}`}><PaginationEllipsis /></PaginationItem>);
      }
      paginationItems.push(<PaginationItem key={pageNum}><PaginationLink href="#" onClick={(e) => { e.preventDefault(); handlePageChange(pageNum); }} isActive={currentPage === pageNum}>{pageNum}</PaginationLink></PaginationItem>);
      lastPage = pageNum;
    }
    return paginationItems;
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Manage Subscriptions</h1>
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Search by email or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch}>Search</Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow key="loading"><TableCell colSpan={5} className="text-center py-8">Loading data...</TableCell></TableRow>}
            {isError && <TableRow key="error"><TableCell colSpan={5} className="text-center text-red-500 py-8">Failed to load data.</TableCell></TableRow>}
            
            {!isLoading && !isError && (
              subscriptions.length > 0 ? (
                subscriptions.map((sub: Subscription) => (
                  <TableRow key={sub._id}>
                    <TableCell>
                      {/* SỬA LỖI NAME: Ưu tiên Name -> Username -> Email prefix */}
                      <div className="font-medium">
                        {sub.userId?.username || sub.userId?.username || 'Unknown User'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {sub.userId?.email || 'No Email'}
                      </div>
                    </TableCell>
                    <TableCell>
                        <Badge variant="outline">
                            {sub.planId?.name || 'Unknown Plan'}
                        </Badge>
                    </TableCell>
                    <TableCell>
                      <SubscriptionStatusBadge status={sub.status} />
                    </TableCell>
                    <TableCell>
                        {/* SỬA LỖI DATE: Dùng currentPeriodStart */}
                        {sub.currentPeriodStart ? format(new Date(sub.currentPeriodStart), "dd/MM/yyyy") : "N/A"}
                    </TableCell>
                    <TableCell>
                        {/* SỬA LỖI DATE: Dùng currentPeriodEnd */}
                        {sub.currentPeriodEnd ? format(new Date(sub.currentPeriodEnd), "dd/MM/yyyy") : "N/A"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow key="no-data"><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No subscriptions found.</TableCell></TableRow>
              )
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (pagination.page > 1) handlePageChange(pagination.page - 1); }} /></PaginationItem>
              {renderPagination()}
              <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (pagination.page < pagination.totalPages) handlePageChange(pagination.page + 1); }} /></PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}