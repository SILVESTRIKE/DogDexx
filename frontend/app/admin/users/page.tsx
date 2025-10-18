"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, UserPlus, MoreVertical, BarChart, Star, CheckCircle, Clock } from "lucide-react"
import { useEffect, useState, useCallback } from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { getAdminUsers, deleteUser, EnrichedUser, PaginatedUsersResponse } from "@/lib/admin-api"
import { useDebounce } from "@/hooks/use-debounce"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { AddUserDialog } from "./add-user-dialog"
import { EditUserDialog } from "./edit-user-dialog"

const initialData: PaginatedUsersResponse = {
  pagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
  users: [],
}

export default function UsersPage() {
  const [data, setData] = useState<PaginatedUsersResponse>(initialData)
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [editingUser, setEditingUser] = useState<EnrichedUser | null>(null)

  const debouncedSearch = useDebounce(searchQuery, 500)

  const fetchUsers = useCallback(async (currentPage: number, search: string) => {
    setLoading(true)
    try {
      const result = await getAdminUsers({ page: currentPage, limit: 10, search })
      setData(result)
    } catch (error) {
      toast.error("Failed to fetch users.", { description: (error as Error).message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Reset to page 1 whenever search query changes
    setPage(1)
    fetchUsers(1, debouncedSearch)
  }, [debouncedSearch, fetchUsers])

  useEffect(() => {
    // Fetch data for the current page
    fetchUsers(page, debouncedSearch)
  }, [page, fetchUsers, debouncedSearch])

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
      return
    }
    try {
      await deleteUser(userId)
      toast.success(`User "${username}" has been deleted.`)
      // Refetch users for the current page
      fetchUsers(page, debouncedSearch)
    } catch (error) {
      toast.error("Failed to delete user.", { description: (error as Error).message })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Quản lý người dùng</h2>
          <p className="text-muted-foreground">Quản lý và theo dõi người dùng đã đăng ký</p>
        </div>
        <AddUserDialog onUserAdded={() => fetchUsers(page, debouncedSearch)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tất cả người dùng</CardTitle>
          <CardDescription>Danh sách tất cả người dùng đã đăng ký trong hệ thống</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm người dùng theo tên hoặc email..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Người dùng</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Thống kê</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : data.users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Không tìm thấy người dùng nào
                  </TableCell>
                </TableRow>
              ) : (
                data.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-muted-foreground">
                        <Badge variant={user.role === 'admin' ? 'default' : user.role === 'premium' ? 'outline' : 'secondary'} className="capitalize">
                          {user.role}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <BarChart className="h-4 w-4" /> {user.stats.predictions} dự đoán
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Star className="h-4 w-4" /> {user.stats.collected} bộ sưu tập
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.status === "active" ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Đã xác thực
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                          <Clock className="h-3 w-3 mr-1" />
                          Chờ xác thực
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Xem chi tiết</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditingUser(user)}>Chỉnh sửa</DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteUser(user.id, user.name)}
                          >
                            Xóa người dùng
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <Pagination className="mt-4">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setPage((p) => Math.max(1, p - 1))
                  }}
                  className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="px-4 py-2 text-sm">
                  Page {data.pagination.page} of {data.pagination.totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setPage((p) => Math.min(data.pagination.totalPages, p + 1))
                  }}
                  className={page >= data.pagination.totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </CardContent>
      </Card>

      <EditUserDialog
        user={editingUser}
        isOpen={!!editingUser}
        onOpenChange={(isOpen) => !isOpen && setEditingUser(null)}
        onUserUpdated={() => fetchUsers(page, debouncedSearch)}
      />
    </div>
  )
}
