import * as api from "@/shared/helper/callApi";
import controllerName from "@/shared/helper/controllerName";
import * as DTO from "@/services/location/locationType";

// Route backend: LocationController -> "api/Location", CategoryController -> "api/Category"
// GET list / GET by id / GET nearby / GET categories: [AllowAnonymous]
// POST / PUT / DELETE / favorites: [Authorize] -> requiresAuth: true
export const locationService = {
  /** GET /api/Location?... (public, phân trang) */
  getAll: (filter: DTO.LocationFilterDto = {}) =>
    api.getApi<DTO.LocationListDto>(controllerName.Location, {
      params: { pageIndex: 1, pageSize: 10, sortDescending: true, ...filter },
    }) as Promise<api.ApiPageResult<DTO.LocationListDto>>,

  /** GET /api/Location/nearby?lat=&lng=&radiusKm=... (public) */
  searchNearby: (filter: DTO.NearbySearchFilterDto) =>
    api.getApi<DTO.NearbyLocationDto[]>(`${controllerName.Location}/nearby`, {
      params: { radiusKm: 5, limit: 50, ...filter },
    }) as Promise<api.ApiResult<DTO.NearbyLocationDto[]>>,

  /** GET /api/Location/{id} (public) */
  getById: (id: number) =>
    api.getApi<DTO.LocationDetailDto>(`${controllerName.Location}/${id}`) as Promise<
      api.ApiResult<DTO.LocationDetailDto>
    >,

  /** POST /api/Location */
  create: (data: DTO.CreateLocationDto) =>
    api.postApi<DTO.LocationDetailDto>(controllerName.Location, { data, requiresAuth: true }),

  /** PUT /api/Location/{id} */
  update: (id: number, data: DTO.UpdateLocationDto) =>
    api.putApi<DTO.LocationDetailDto>(`${controllerName.Location}/${id}`, { data, requiresAuth: true }),

  /** DELETE /api/Location/{id} */
  remove: (id: number) =>
    api.deleteApi<boolean>(`${controllerName.Location}/${id}`, { requiresAuth: true }),

  // ── Favorites (theo tài khoản) ──

  /** GET /api/Location/favorites?pageIndex=&pageSize= */
  getMyFavorites: (filter: DTO.FavoriteFilterDto = {}) =>
    api.getApi<DTO.FavoriteLocationDto>(`${controllerName.Location}/favorites`, {
      params: { pageIndex: 1, pageSize: 10, ...filter },
      requiresAuth: true,
    }) as Promise<api.ApiPageResult<DTO.FavoriteLocationDto>>,

  /** GET /api/Location/{id}/favorite */
  getFavoriteStatus: (id: number) =>
    api.getApi<DTO.FavoriteStatusDto>(`${controllerName.Location}/${id}/favorite`, {
      requiresAuth: true,
    }) as Promise<api.ApiResult<DTO.FavoriteStatusDto>>,

  /** POST /api/Location/{id}/favorite (idempotent) */
  addFavorite: (id: number) =>
    api.postApi<DTO.FavoriteStatusDto>(`${controllerName.Location}/${id}/favorite`, { requiresAuth: true }),

  /** DELETE /api/Location/{id}/favorite (idempotent) */
  removeFavorite: (id: number) =>
    api.deleteApi<DTO.FavoriteStatusDto>(`${controllerName.Location}/${id}/favorite`, { requiresAuth: true }),
};