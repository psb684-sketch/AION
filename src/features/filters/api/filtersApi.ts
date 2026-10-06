/**
 * Filters API Client
 * Handles all API calls for color grading filters
 */

import type { FilterAsset, FilterCategory } from "../types";
import { getApiHeaders, getApiBaseUrl } from "@/lib/api";

const API_BASE_URL = getApiBaseUrl();

export class FiltersApi {
  /**
   * Get filters manifest with category counts
   */
  static async getManifest(): Promise<{ categories: Array<{ id: string; name: string; count: number }>; totalFilters: number }> {
    try {
      const response = await fetch(`${API_BASE_URL}/filters/manifest`, {
        headers: getApiHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error(`[FiltersApi] Failed to fetch manifest:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error(`[FiltersApi] Exception fetching manifest:`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Network error: ${String(error)}`);
    }
  }

  /**
   * Get all filter categories
   */
  static async getCategories(): Promise<FilterCategory[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/filters/categories`, {
        headers: getApiHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error(`[FiltersApi] Failed to fetch categories:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error(`[FiltersApi] Exception fetching categories:`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Network error: ${String(error)}`);
    }
  }

  /**
   * Get filters by category
   */
  static async getByCategory(category: string): Promise<FilterAsset[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/filters/${category}`, {
        headers: getApiHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error(`[FiltersApi] Failed to fetch category ${category}:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const data = await response.json();
      console.log(`[FiltersApi] Successfully loaded ${data.length} filters for category: ${category}`);
      return data;
    } catch (error) {
      console.error(`[FiltersApi] Exception fetching category ${category}:`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Network error: ${String(error)}`);
    }
  }

  /**
   * Get a specific filter by category and ID
   */
  static async getById(category: string, id: string): Promise<FilterAsset> {
    try {
      const response = await fetch(`${API_BASE_URL}/filters/${category}/${id}`, {
        headers: getApiHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error(`[FiltersApi] Failed to fetch filter ${id}:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error(`[FiltersApi] Exception fetching filter ${id}:`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Network error: ${String(error)}`);
    }
  }

  /**
   * Search filters
   */
  static async search(query: string): Promise<FilterAsset[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/filters/search?q=${encodeURIComponent(query)}`, {
        headers: getApiHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error(`[FiltersApi] Failed to search filters:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          query,
        });
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error(`[FiltersApi] Exception searching filters:`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Network error: ${String(error)}`);
    }
  }
}
