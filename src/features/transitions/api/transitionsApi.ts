/**
 * Transitions API Client
 * Handles all API calls for transition effects from the Clypra API.
 *
 * All transition data lives in Cloudflare R2, served through the API.
 * Use transitionCacheManager to persist definitions locally after fetching.
 */

import type { TransitionAsset, TransitionCategory } from "../types";
import { getApiHeaders, getApiBaseUrl } from "@/lib/api";

const API_BASE_URL = getApiBaseUrl();

export class TransitionsApi {
  /**
   * Get the transitions manifest (category list + counts).
   * Lightweight — use this for initial panel population.
   */
  static async getManifest(): Promise<{
    categories: Array<{ id: string; name: string; count: number }>;
    totalCount: number;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/transitions/manifest`, {
        headers: getApiHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error(`[TransitionsApi] Failed to fetch manifest:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error(`[TransitionsApi] Exception fetching manifest:`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Network error: ${String(error)}`);
    }
  }

  /**
   * Get all transition categories with descriptions.
   */
  static async getCategories(): Promise<TransitionCategory[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/transitions/categories`, {
        headers: getApiHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error(`[TransitionsApi] Failed to fetch categories:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error(`[TransitionsApi] Exception fetching categories:`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Network error: ${String(error)}`);
    }
  }

  /**
   * Get transitions by category.
   * Returns only published transitions for non-admin callers.
   */
  static async getByCategory(category: string): Promise<TransitionAsset[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/transitions/${category}`, {
        headers: getApiHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error(`[TransitionsApi] Failed to fetch category ${category}:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const data = await response.json();
      console.log(`[TransitionsApi] Successfully loaded ${data.length} transitions for category: ${category}`);
      return data;
    } catch (error) {
      console.error(`[TransitionsApi] Exception fetching category ${category}:`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Network error: ${String(error)}`);
    }
  }

  /**
   * Get a specific transition by category and ID.
   */
  static async getById(category: string, id: string): Promise<TransitionAsset> {
    try {
      const response = await fetch(`${API_BASE_URL}/transitions/${category}/${id}`, {
        headers: getApiHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error(`[TransitionsApi] Failed to fetch transition ${id}:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error(`[TransitionsApi] Exception fetching transition ${id}:`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Network error: ${String(error)}`);
    }
  }

  /**
   * Search transitions across all categories.
   */
  static async search(query: string): Promise<TransitionAsset[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/transitions/search?q=${encodeURIComponent(query)}`, {
        headers: getApiHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error(`[TransitionsApi] Failed to search transitions:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          query,
        });
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error(`[TransitionsApi] Exception searching transitions:`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Network error: ${String(error)}`);
    }
  }
}
