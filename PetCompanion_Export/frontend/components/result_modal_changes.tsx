// --- CHANGES FOR frontend/components/result-modal.tsx ---

// 1. Import Search icon
import { Loader2, Save, X, Search } from "lucide-react";

// 2. Add "Search Lost" button in the actions area (inside the return statement):

/*
<div className="flex gap-3 mt-2">
    <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSaving}>
        Hủy bỏ
    </Button>
    
    {/* --- NEW BUTTON START --- *\/}
    <Button
        variant="secondary"
        className="flex-1 gap-2"
        onClick={() => {
            router.push(`/community/lost-found?breed=${encodeURIComponent(detection.detectedBreed)}`);
            onClose();
        }}
        disabled={isSaving}
    >
        <Search className="w-4 h-4" />
        Search Lost
    </Button>
    {/* --- NEW BUTTON END --- *\/}

    <Button 
        className="flex-1 gap-2 font-bold"
        onClick={drawAndSave}
        disabled={isSaving}
    >
        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Lưu & Xem chi tiết
    </Button>
</div>
*/
