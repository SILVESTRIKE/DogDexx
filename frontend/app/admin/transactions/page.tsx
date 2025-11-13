"use client"

import { useMemo } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useI18n } from "@/lib/i18n-context"
import { apiClient } from "@/lib/api-client"
import { ProtectedRoute } from "@/components/protected-route"
import { Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

// Interface cho một Giao dịch (Transaction)
interface Transaction {
  _id: string;
  user: {
    username: string;
    email: string;
  };
  plan: {
    name: string;
  };
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  paymentGateway: string;
  createdAt: string;
  orderId: string;
}

export default function TransactionsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { t } = useI18n()

  const page = searchParams.get("page") ?? "1"
  const limit = searchParams.get("limit") ?? "10"

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-transactions", { page, limit }],
    queryFn: () => apiClient.getAdminTransactions({ page: Number(page), limit: Number(limit) }),
  })

  const transactions = data?.data ?? []
  const pagination = data?.pagination

  const getStatusBadge = (status: Transaction["status"]) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">{t('admin.transactions.completed') || 'Completed'}</Badge>
      case 'pending':
        return <Badge variant="secondary">{t('admin.transactions.pending') || 'Pending'}</Badge>
      case 'failed':
        return <Badge variant="destructive">{t('admin.transactions.failed') || 'Failed'}</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams)
    params.set("page", String(newPage))
    router.push(`${pathname}?${params.toString()}`)
  }

  // useMemo to avoid re-calculating on every render
  const paginationItems = useMemo(() => {
    if (!pagination || pagination.totalPages <= 1) return null;

    const pageNumbers = [];
    const currentPage = pagination.page;
    const totalPages = pagination.totalPages;
    const pageRange = 2;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - pageRange && i <= currentPage + pageRange)) {
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
  }, [pagination, handlePageChange]);

  return (
    <ProtectedRoute requireAdmin>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.transactions.title") || "Transaction History"}</CardTitle>
            <CardDescription>{t("admin.transactions.description") || "View all payment transactions."}</CardDescription>
          </CardHeader>
          <CardContent>
            {isError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{(error as any)?.message || "Failed to load transactions"}</div>}

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin.transactions.user") || "User"}</TableHead>
                        <TableHead>{t("admin.transactions.plan") || "Plan"}</TableHead>
                        <TableHead className="text-right">{t("admin.transactions.amount") || "Amount"}</TableHead>
                        <TableHead>{t("admin.transactions.status") || "Status"}</TableHead>
                        <TableHead>{t("admin.transactions.gateway") || "Gateway"}</TableHead>
                        <TableHead>{t("admin.transactions.date") || "Date"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx: Transaction) => (
                        <TableRow key={tx._id}>
                          <TableCell>
                            <div className="font-medium">{tx.user.username}</div>
                            <div className="text-sm text-muted-foreground">{tx.user.email}</div>
                          </TableCell>
                          <TableCell>{tx.plan.name}</TableCell>
                          <TableCell className="text-right">{tx.amount.toLocaleString()} VND</TableCell>
                          <TableCell>{getStatusBadge(tx.status)}</TableCell>
                          <TableCell className="capitalize">{tx.paymentGateway}</TableCell>
                          <TableCell>{new Date(tx.createdAt).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {pagination && pagination.totalPages > 1 && (
                  <div className="mt-4 flex justify-center">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (pagination.page > 1) handlePageChange(pagination.page - 1); }} /></PaginationItem>
                        {paginationItems}
                        <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (pagination.page < pagination.totalPages) handlePageChange(pagination.page + 1); }} /></PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  )
}
