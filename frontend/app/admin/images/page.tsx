"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Folder, Trash2, Eye, ChevronRight, MoreVertical, Video, Home, Search, Download, FileQuestion, Image as ImageIcon } from "lucide-react"
import { useI18n } from "@/lib/i18n-context"
import { browseAdminMedia, deleteAdminMedia } from "@/lib/admin-api"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

// Định nghĩa kiểu dữ liệu rõ ràng
interface MediaItem {
  id: string      // SẼ LÀ PATH ĐỂ GỌI API
  name: string
  type: "folder" | "image" | "video"
  url: string
  createdAt?: string
  size?: number
}

interface Breadcrumb {
  name: string
  path: string
}

export default function ImagesPage() {
  const { t } = useI18n()

  // THAY ĐỔI 1: Quản lý breadcrumbs bằng state để lưu cả tên và path
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ name: t('admin.imageManagementRoot') || "Root", path: "" }]);
  
  // `currentPath` bây giờ được suy ra từ breadcrumb cuối cùng
  const currentPath = useMemo(() => breadcrumbs[breadcrumbs.length - 1].path, [breadcrumbs]);

  const [items, setItems] = useState<MediaItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const loadFileSystem = useCallback(async (path: string, signal: AbortSignal) => {
    try {
      setIsLoading(true);
      const response = await browseAdminMedia(path, { signal });

      if (signal.aborted) return;

      const directories: MediaItem[] = response.directories.map((dir: any) => ({
        id: dir.id, // ID từ backend giờ chính là path đầy đủ
        name: dir.name,
        type: "folder",
        url: '',
      }));

      const mediaFiles: MediaItem[] = response.media.map((media: any) => ({
        id: media.id,
        name: media.name,
        type: media.type,
        url: media.url,
        createdAt: media.createdAt,
        size: media.size,
      }));

      setItems([...directories, ...mediaFiles].sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      }));

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Fetch aborted');
      } else {
        console.error("Error loading file system:", error);
        toast.error("Tải dữ liệu thất bại", { description: (error as Error).message });
      }
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    loadFileSystem(currentPath, signal);

    return () => {
      controller.abort();
    };
  }, [currentPath, loadFileSystem]);

  // THAY ĐỔI 2: Cập nhật logic điều hướng để làm việc với state breadcrumbs
  const handleFolderClick = (folder: MediaItem) => {
    setIsLoading(true);
    setItems([]); // Xóa item cũ ngay lập tức
    setSearchQuery(""); // Reset tìm kiếm
    setBreadcrumbs(prev => [...prev, { name: folder.name, path: folder.id }]);
  }
  
  const handleBreadcrumbClick = (index: number) => {
    if (index === breadcrumbs.length - 1) return; // Không làm gì nếu click vào breadcrumb hiện tại
    setIsLoading(true);
    setItems([]);
    setSearchQuery("");
    setBreadcrumbs(prev => prev.slice(0, index + 1));
  };

  const handleDelete = async (item: MediaItem) => {
    if (!window.confirm(`Bạn có chắc muốn xóa "${item.name}" không? Hành động này không thể hoàn tác.`)) return;

    try {
      if (item.type === "image" || item.type === "video") {
        await deleteAdminMedia(item.id);
        toast.success(`Đã xóa "${item.name}" thành công.`);
        setItems(prevItems => prevItems.filter(i => i.id !== item.id));
      }
    } catch (error) {
      toast.error("Xóa thất bại", { description: (error as Error).message });
    }
  }
  
  const filteredItems = useMemo(() =>
    items.filter((item) =>
      item && item.name && item.name.toLowerCase().includes(searchQuery.toLowerCase())
    ), [items, searchQuery]);

  const hasMediaFiles = useMemo(() => items.some(item => item.type !== 'folder'), [items]);

  const handleDownloadFolder = () => {
    toast.info("Tính năng tải xuống thư mục đang được phát triển.");
  };
  
  const renderItemIcon = (item: MediaItem) => {
    const commonClass = "h-12 w-12";
    // Hiển thị icon cụ thể cho thư mục ảo
    if (item.type === "folder") {
        if (item.name === 'images') return <ImageIcon className={`${commonClass} text-green-500`} />;
        if (item.name === 'videos') return <Video className={`${commonClass} text-purple-500`} />;
        return <Folder className={`${commonClass} text-blue-500`} />;
    }
    
    switch(item.type) {
      case "image":
        return <img src={item.url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />;
      case "video":
        return (
          <div className="w-full h-full flex items-center justify-center bg-black relative">
            <Video className={`${commonClass} text-purple-400`} />
          </div>
        );
      default:
        return <FileQuestion className={`${commonClass} text-muted-foreground`} />;
    }
  }

  return (
    <div className="space-y-6">
      {/* ... Phần header không đổi ... */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t("admin.imageManagement") || "File Manager"}</h2>
          <p className="text-muted-foreground">
            {t("admin.imageManagementDescription") || "Manage user media files and folders"}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-2">
          {/* THAY ĐỔI 3: Render breadcrumbs từ state */}
          <div className="flex items-center gap-2 flex-wrap">
            {breadcrumbs.map((breadcrumb, index) => ( // Sử dụng breadcrumb.path làm key
              <div key={index} className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleBreadcrumbClick(index)}
                  className={`capitalize ${index === breadcrumbs.length - 1 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                  {index === 0 ? <Home className="h-4 w-4 mr-1" /> : null}
                  {breadcrumb.name}
                </Button>
                {index < breadcrumbs.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
<div className="flex justify-between items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("common.search") || "Search files..."} className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        {hasMediaFiles && (
          <Button variant="outline" onClick={handleDownloadFolder}>
            <Download className="mr-2 h-4 w-4" />
            Tải xuống thư mục
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.folderContents") || "Contents"}</CardTitle>
          <CardDescription>
            {t('admin.showingDescription', { 
              count: filteredItems.length, 
              folderName: breadcrumbs[breadcrumbs.length - 1]?.name || t('admin.imageManagementRoot') 
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="font-semibold mb-2">
                {searchQuery ? `Không tìm thấy kết quả cho "${searchQuery}"` : "Thư mục này trống"}
              </p>
              <p className="text-sm">Hãy thử tìm kiếm với từ khóa khác hoặc quay lại sau.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="border rounded-lg hover:shadow-md hover:border-primary cursor-pointer transition-all group relative flex flex-col"
                  // THAY ĐỔI 4: Gọi đúng hàm điều hướng khi click vào thư mục
                  onClick={() => item.type === "folder" ? handleFolderClick(item) : (setSelectedItem(item), setShowPreview(true))}>
                  <div className="aspect-square bg-muted rounded-t-lg flex items-center justify-center overflow-hidden shrink-0">
                    {renderItemIcon(item)}
                  </div>
                  
                  <CardFooter className="p-3 grow flex flex-col items-start w-full">
                    <p className="text-sm font-medium truncate w-full" title={item.name}>{item.name}</p>
                    {item.createdAt && <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</p>}
                    {item.size && <p className="text-xs text-muted-foreground">{(item.size / 1024 / 1024).toFixed(2)} MB</p>}
                  </CardFooter>

                  {item.type !== "folder" && (
                    <div className="absolute top-2 right-2">
                       {/* Dropdown Menu không đổi */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 bg-background/50 hover:bg-background/80">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedItem(item); setShowPreview(true); }}>
                            <Eye className="h-4 w-4 mr-2" /> Xem
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(item); }} className="text-destructive focus:text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Xóa
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Dialog Preview không đổi */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
         <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate pr-8" title={selectedItem?.name}>{selectedItem?.name}</DialogTitle>
            <DialogDescription>{selectedItem?.createdAt ? new Date(selectedItem.createdAt).toLocaleString() : ''}</DialogDescription>
          </DialogHeader>
          <div className="bg-black/90 rounded-lg grow flex items-center justify-center overflow-hidden">
            {selectedItem?.type === "image" ? (
              <img src={selectedItem.url} alt={selectedItem.name} className="max-w-full max-h-full object-contain"/>
            ) : (
              <video src={selectedItem?.url} controls autoPlay className="max-w-full max-h-full" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}