export type StickerCategory = "emoji" | "text" | "gaming" | "sports" | "animals" | "love" | "mood" | "food" | "travel" | "birthday" | "frames" | "shapes" | "fashion" | "retro" | "illustration";

export interface StickerItem {
  id: string;
  name: string;
  category: StickerCategory | string;
  thumbnailUrl: string;
  lottieUrl: string; // Required - Lottie JSON URL
  preview: string; // Required - .webm preview video URL
  isPremium?: boolean;
  tags?: string[];
}

import { getApiHeaders, getApiBaseUrl } from "@/lib/api";

const BASE = getApiBaseUrl();

export const STICKER_CATEGORIES: StickerCategory[] = ["emoji", "text", "gaming", "sports", "animals", "love", "mood", "food", "travel", "birthday", "frames", "shapes", "fashion", "retro", "illustration"];

export const StickersApi = {
  async getStickersIndex(): Promise<StickerItem[]> {
    try {
      const res = await fetch(`${BASE}/stickers`, {
        headers: getApiHeaders(),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => res.statusText);
        console.error(`[StickersApi] Failed to load stickers library:`, {
          status: res.status,
          statusText: res.statusText,
          error: errorText,
        });
        throw new Error(`HTTP ${res.status}: ${errorText || res.statusText}`);
      }

      return res.json();
    } catch (error) {
      console.error(`[StickersApi] Exception loading stickers library:`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Network error: ${String(error)}`);
    }
  },

  async getStickersByCategory(category: StickerCategory): Promise<StickerItem[]> {
    try {
      const res = await fetch(`${BASE}/stickers/${category}`, {
        headers: getApiHeaders(),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => res.statusText);
        console.error(`[StickersApi] Failed to load stickers category ${category}:`, {
          status: res.status,
          statusText: res.statusText,
          error: errorText,
        });
        throw new Error(`HTTP ${res.status}: ${errorText || res.statusText}`);
      }

      const data = await res.json();
      console.log(`[StickersApi] Successfully loaded ${data.length} stickers for category: ${category}`);
      return data;
    } catch (error) {
      console.error(`[StickersApi] Exception loading stickers category ${category}:`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Network error: ${String(error)}`);
    }
  },

  async getSticker(category: string, id: string): Promise<StickerItem> {
    try {
      const res = await fetch(`${BASE}/stickers/${category}/${id}`, {
        headers: getApiHeaders(),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => res.statusText);
        console.error(`[StickersApi] Failed to load sticker ${id}:`, {
          status: res.status,
          statusText: res.statusText,
          error: errorText,
        });
        throw new Error(`HTTP ${res.status}: ${errorText || res.statusText}`);
      }

      return res.json();
    } catch (error) {
      console.error(`[StickersApi] Exception loading sticker ${id}:`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Network error: ${String(error)}`);
    }
  },
};
