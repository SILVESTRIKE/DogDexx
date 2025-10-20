import { PredictionHistoryDoc } from "../../models/prediction_history.model";

export interface DirectoryItem {
  id: string;
  name: string | number;
  type: "folder" | "user" | "year" | "month" | "day";
  isVirtual?: boolean;
}

export interface BrowseResult {
  directories: DirectoryItem[];
  histories: PredictionHistoryDoc[];
  meta?: {
    availableBreeds?: string[];
  };
}