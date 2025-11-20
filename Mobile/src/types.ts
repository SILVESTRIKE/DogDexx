export interface ScanItem {
  id: string;
  timestamp: string;
  label: string;
  percentage: string;
  furtherMatches: string;
  imageUrl?: string;
}

export interface DogBreed {
  id: string;
  name: string;
  fciNumber?: string;
  imageUrl: string;
}

export interface BreedListProps {
  breeds: DogBreed[];
  onSearch?: (query: string) => void;
  onBreedPress?: (breed: DogBreed) => void;
}