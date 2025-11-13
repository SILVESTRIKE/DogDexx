"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Subscription } from "@/lib/types"; // Ensure this type is defined in @/lib/types
import { format } from "date-fns";

const SubscriptionStatusBadge = ({ status }: { status: string }) => {
  const variant = useMemo(() => {
    switch (status) {
      case "active":
        return "default"; // FIX: Changed from "success"
      case "pending":
        return "secondary";
      case "cancelled":
      case "expired":
        return "destructive"; // FIX: Changed from "warning" for 'cancelled'
      default:
        return "outline";
    }
  }, [status]);

  return (
    <Badge variant={variant} className="capitalize">
      {status}
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
    const pageRange = 2; // Number of pages to show around the current page

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
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Manage Subscriptions</h1>

      <div className="flex items-center mb-4">
        <Input
          placeholder="Search by user email or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm mr-2"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch}>Search</Button>
      </div>

      <div className="rounded-md border">
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
            {isLoading && <TableRow key="loading"><TableCell colSpan={5} className="text-center">Loading...</TableCell></TableRow>}
            {isError && <TableRow key="error"><TableCell colSpan={5} className="text-center text-red-500">Failed to load data.</TableCell></TableRow>}
            {!isLoading && !isError && (
              subscriptions.length > 0 ? (
                subscriptions.map((sub: Subscription) => (
                  <TableRow key={sub._id}>
                    <TableCell>{sub.userId?.name || 'N/A'} ({sub.userId?.email || 'N/A'})</TableCell>
                    <TableCell>{sub.planId?.name || 'N/A'}</TableCell>
                    <TableCell>
                      <SubscriptionStatusBadge status={sub.status} />
                    </TableCell>
                    <TableCell>{sub.startDate ? format(new Date(sub.startDate), "PPP") : "N/A"}</TableCell>
                    <TableCell>{sub.endDate ? format(new Date(sub.endDate), "PPP") : "N/A"}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow key="no-data"><TableCell colSpan={5} className="text-center">No subscriptions found.</TableCell></TableRow>
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