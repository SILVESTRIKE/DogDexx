// --- CHANGES FOR frontend/lib/types.ts ---

// Add these interfaces:

export interface DogProfile {
    id: string;
    owner_id: string;
    name: string;
    breed: string;
    birthday?: string;
    gender: "male" | "female";
    avatarPath?: string;
    photos: string[];
    isLost: boolean;
    lastSeenLocation?: {
        lat: number;
        lng: number;
        address?: string;
    };
    attributes: {
        color?: string;
        pattern?: string;
        size?: string;
    };
    createdAt: string;
    updatedAt: string;
}

export interface HealthRecord {
    id: string;
    dog_id: string;
    type: "vaccine" | "checkup" | "medicine" | "surgery" | "other";
    title: string;
    date: string;
    nextDueDate?: string;
    notes?: string;
    vetName?: string;
    createdAt: string;
}
