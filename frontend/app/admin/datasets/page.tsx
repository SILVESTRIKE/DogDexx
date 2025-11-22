"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Folder, ChevronRight, Home, Search, Download, File as FileIcon, Image as ImageIcon, Video as VideoIcon } from "lucide-react"
import { useI18n } from "@/lib/i18n-context"
import { browseAdminDatasets, downloadAdminDataset } from "@/lib/admin-api"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"

interface FileSystemItem {
  id: string
  name: string
  type: "folder" | "image" | "video" | "file"
  url?: string
  createdAt?: string
  size?: number
}

interface Breadcrumb {
  name: string
  path: string
}

export default function DatasetsPage() {
  const { t } = useI18n()

  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ name: "Dataset Root", path: "" }]);
  const currentPath = useMemo(() => breadcrumbs[breadcrumbs.length - 1].path, [breadcrumbs]);

  const [items, setItems] = useState<FileSystemItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<FileSystemItem | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const loadFileSystem = useCallback(async (path: string, signal: AbortSignal) => {
    try {
      setIsLoading(true);
      const response = await browseAdminDatasets(path, { signal });

      if (signal.aborted) return;

      const directories: FileSystemItem[] = response.directories.map((dir: any) => ({
        id: dir.id,
        name: dir.name,
        type: "folder",
      }));

      const files: FileSystemItem[] = response.files.map((file: any) => ({
        id: file.id,
        name: file.name,
        type: file.type,
        url: file.url,
        createdAt: file.createdAt,
        size: file.size,
      }));

      setItems([...directories, ...files].sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      }));

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Fetch aborted');
      } else {
        console.error("Error loading dataset file system:", error);
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

  const handleFolderClick = (folder: FileSystemItem) => {
    setIsLoading(true);
    setItems([]);
    setSearchQuery("");
    setBreadcrumbs(prev => [...prev, { name: folder.name, path: folder.id }]);
  }
  
  const handleBreadcrumbClick = (index: number) => {
    if (index === breadcrumbs.length - 1) return;
    setIsLoading(true);
    setItems([]);
    setSearchQuery("");
    setBreadcrumbs(prev => prev.slice(0, index + 1));
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      // 1. Gọi API để lấy URL tải về
      const response = await downloadAdminDataset();
      const downloadUrl = response.downloadUrl;

      // 2. Mở URL trong một tab mới, trình duyệt sẽ tự động tải file
      window.open(downloadUrl, '_blank');
      
    } catch (error) {
        console.log("Tải xuống thất bại", { description: (error as Error).message });
    } finally {
      setIsDownloading(false);
    }
  };
  
  const filteredItems = useMemo(() =>
    items.filter((item) =>
      item && item.name && item.name.toLowerCase().includes(searchQuery.toLowerCase())
    ), [items, searchQuery]);

  const renderItemIcon = (item: FileSystemItem) => {
    const commonClass = "h-12 w-12 text-muted-foreground";
    switch(item.type) {
      case "folder":
        return <Folder className={`${commonClass} text-blue-500`} />;
      case "image":
        return <ImageIcon className={`${commonClass} text-green-500`} />;
      case "video":
        return <VideoIcon className={`${commonClass} text-purple-500`} />;
      default:
        return <FileIcon className={commonClass} />;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Quản lý Dataset</h2>
          <p className="text-muted-foreground">
            Duyệt và tải về các bộ dữ liệu đã được xử lý.
          </p>
        </div>
        <Button onClick={handleDownload} disabled={isDownloading}>
          <Download className="mr-2 h-4 w-4" />
          {isDownloading ? "Đang lấy link..." : "Tải toàn bộ Dataset (.zip)"}
        </Button>
      </div>

      <Card>
        <CardContent className="p-2">
          <div className="flex items-center gap-2 flex-wrap">
            {breadcrumbs.map((breadcrumb, index) => (
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

      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("common.search") || "Search files..."} className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.folderContents") || "Contents"}</CardTitle>
          <CardDescription>
            Đang hiển thị {filteredItems.length} mục trong thư mục "{breadcrumbs[breadcrumbs.length - 1]?.name || "Root"}"
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
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="border rounded-lg hover:shadow-md hover:border-primary cursor-pointer transition-all group relative flex flex-col"
                  onClick={() => item.type === "folder" ? handleFolderClick(item) : (setSelectedItem(item), setShowPreview(true))}>
                  <div className="aspect-square bg-muted rounded-t-lg flex items-center justify-center overflow-hidden shrink-0">
                    {item.type === 'image' && item.url ? (
                      <img src={item.url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" crossOrigin="anonymous" />
                    ) : (
                      renderItemIcon(item)
                    )}
                  </div>
                  
                  <CardContent className="p-3 grow flex flex-col items-start w-full">
                    <p className="text-sm font-medium truncate w-full" title={item.name}>{item.name}</p>
                    {item.createdAt && <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</p>}
                    {item.size && <p className="text-xs text-muted-foreground">{(item.size / 1024 / 1024).toFixed(2)} MB</p>}
                  </CardContent>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
         <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate pr-8" title={selectedItem?.name}>{selectedItem?.name}</DialogTitle>
            <DialogDescription>{selectedItem?.createdAt ? new Date(selectedItem.createdAt).toLocaleString() : ''}</DialogDescription>
          </DialogHeader>
          <div className="bg-black/90 rounded-lg grow flex items-center justify-center overflow-hidden">
            {selectedItem?.type === "image" ? (
              <img src={selectedItem.url} alt={selectedItem.name} className="max-w-full max-h-full object-contain"/>
            ) : selectedItem?.type === "video" ? (
              <video src={selectedItem?.url} controls autoPlay className="max-w-full max-h-full" />
            ) : (
              <p className="text-white">Không thể xem trước loại tệp này.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
