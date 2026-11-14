import * as api from "@/shared/helper/callApi";
import controllerName from "@/shared/helper/controllerName";
import * as DTO from "@/services/category/categoryType";

// Route BE: CategoryController -> "api/Category"
// GET: [AllowAnonymous]. POST / PUT / DELETE: [Authorize]
export const categoryService = {
  /** GET /api/Category (public) */
  getAll: () =>
    api.getApi<DTO.CategoryDto[]>(controllerName.category) as Promise<api.ApiResult<DTO.CategoryDto[]>>,

  /** GET /api/Category/{id} (public) */
  getById: (id: number) =>
    api.getApi<DTO.CategoryDto>(`${controllerName.category}/${id}`) as Promise<api.ApiResult<DTO.CategoryDto>>,

  /** POST /api/Category */
  create: (data: DTO.CreateCategoryDto) =>
    api.postApi<DTO.CategoryDto>(controllerName.category, { data, requiresAuth: true }),

  /** PUT /api/Category/{id} */
  update: (id: number, data: DTO.UpdateCategoryDto) =>
    api.putApi<DTO.CategoryDto>(`${controllerName.category}/${id}`, { data, requiresAuth: true }),

  /** DELETE /api/Category/{id} (409 nếu còn địa điểm đang dùng) */
  remove: (id: number) =>
    api.deleteApi<boolean>(`${controllerName.category}/${id}`, { requiresAuth: true }),
};