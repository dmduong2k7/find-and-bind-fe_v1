/** Body cho POST /api/Location */
export interface CreateLocationDto {
  name: string;
  description?: string;
  address: string;
  categoryId: number;
}

/** Body cho PUT /api/Location/{id} */
export type UpdateLocationDto = CreateLocationDto;

/** Item trong danh sách — GET /api/Location */
export interface LocationListDto {
  id: number;
  name: string;
  address: string;
  averageRating: number;
  latitude?: number | null;
  longitude?: number | null;
  categoryId: number;
  categoryName: string;
  /** Chỉ có khi BE bổ sung ReviewCount vào LocationListDto. */
  reviewCount?: number;
}

/** Chi tiết — GET /api/Location/{id} */
export interface LocationDetailDto {
  id: number;
  name: string;
  description: string;
  address: string;
  averageRating: number;
  reviewCount: number;
  latitude?: number | null;
  longitude?: number | null;
  categoryId: number;
  categoryName: string;
  createdAt: string;
  updatedAt?: string | null;
}

/** Query params cho GET /api/Location */
export interface LocationFilterDto {
  keyword?: string;
  categoryId?: number;
  minRating?: number;
  sortBy?: "name" | "rating" | string;
  sortDescending?: boolean; // default true
  pageIndex?: number; // default 1
  pageSize?: number; // default 10
}

/** Query cho GET /api/Location/nearby */
export interface NearbySearchFilterDto {
  lat: number; // -90..90
  lng: number; // -180..180
  radiusKm?: number; // 0.1..50, default 5
  keyword?: string;
  categoryId?: number;
  minRating?: number;
  limit?: number; // 1..100, default 50
}

/** Item địa điểm lân cận — GET /api/Location/nearby */
export interface NearbyLocationDto extends LocationListDto {
  distanceKm?: number;
}

/** Trạng thái yêu thích — POST/DELETE/GET /api/Location/{id}/favorite */
export interface FavoriteStatusDto {
  locationId: number;
  isFavorite: boolean;
}

/** Địa điểm đã lưu — GET /api/Location/favorites */
export interface FavoriteLocationDto extends LocationListDto {
  savedAt: string;
}

/** Query cho GET /api/Location/favorites */
export interface FavoriteFilterDto {
  pageIndex?: number; // default 1
  pageSize?: number; // default 10 (1..100)
}