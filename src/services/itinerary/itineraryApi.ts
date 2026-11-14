import * as api from "@/shared/helper/callApi";
import controllerName from "@/shared/helper/controllerName";
import * as DTO from "@/services/itinerary/itineraryType";

const normalizeBody = (data: DTO.CreateItineraryDto): DTO.CreateItineraryDto => ({
  ...data,
  coverImageUrl: data.coverImageUrl ?? "",
});

export const itineraryService = {
  /** POST /api/Itinerary/ai-plan */
  generateTripPlan: (data: DTO.TripPlanRequestDto) =>
    api.postApi<DTO.AiItineraryResultDto>(`${controllerName.Itinerary}/ai-plan`, { data, requiresAuth: true }),

  // ── CRUD lịch trình riêng tư ──

  /** POST /api/Itinerary */
  create: (data: DTO.CreateItineraryDto) =>
    api.postApi<DTO.ItineraryDetailDto>(controllerName.Itinerary, { data: normalizeBody(data), requiresAuth: true }),

  /** GET /api/Itinerary?pageIndex=&pageSize= */
  getAll: (filter: DTO.ItineraryFilterDto = {}) =>
    api.getApi<DTO.ItineraryListDto>(controllerName.Itinerary, {
      params: { pageIndex: 1, pageSize: 10, ...filter },
      requiresAuth: true,
    }) as Promise<api.ApiPageResult<DTO.ItineraryListDto>>,

  /** GET /api/Itinerary/{id} */
  getById: (id: number) =>
    api.getApi<DTO.ItineraryDetailDto>(`${controllerName.Itinerary}/${id}`, { requiresAuth: true }) as Promise<
      api.ApiResult<DTO.ItineraryDetailDto>
    >,

  /** PUT /api/Itinerary/{id} (409 nếu đang công khai) */
  update: (id: number, data: DTO.CreateItineraryDto) =>
    api.putApi<DTO.ItineraryDetailDto>(`${controllerName.Itinerary}/${id}`, { data: normalizeBody(data), requiresAuth: true }),

  /** DELETE /api/Itinerary/{id} */
  remove: (id: number) => api.deleteApi<boolean>(`${controllerName.Itinerary}/${id}`, { requiresAuth: true }),

  // ── Kéo thả sắp xếp ──

  /** PUT /api/Itinerary/{id}/activities/order (409 nếu đang công khai hoặc thiếu hoạt động) */
  reorderActivities: (id: number, data: DTO.ReorderActivitiesDto) =>
    api.putApi<DTO.ItineraryDetailDto>(`${controllerName.Itinerary}/${id}/activities/order`, { data, requiresAuth: true }),

  // ── Publish / mẫu công khai ──

  /** PATCH /api/Itinerary/{id}/publish */
  setPublished: (id: number, isPublished: boolean) => {
    const body: DTO.SetPublishedDto = { isPublished };
    return api.patchApi<boolean>(`${controllerName.Itinerary}/${id}/publish`, { data: body, requiresAuth: true });
  },

  /** GET /api/Itinerary/published?pageIndex=&pageSize= (public) */
  getPublishedList: (filter: DTO.ItineraryFilterDto = {}) =>
    api.getApi<DTO.ItineraryListDto>(`${controllerName.Itinerary}/published`, {
      params: { pageIndex: 1, pageSize: 10, ...filter },
    }) as Promise<api.ApiPageResult<DTO.ItineraryListDto>>,

  /** GET /api/Itinerary/published/{id} (public) */
  getPublishedById: (id: number) =>
    api.getApi<DTO.ItineraryDetailDto>(`${controllerName.Itinerary}/published/${id}`) as Promise<
      api.ApiResult<DTO.ItineraryDetailDto>
    >,

  /** POST /api/Itinerary/published/{id}/clone — tạo bản sao riêng tư để tự sửa */
  clonePublished: (publishedId: number) =>
    api.postApi<DTO.ItineraryDetailDto>(`${controllerName.Itinerary}/published/${publishedId}/clone`, { requiresAuth: true }),

  // ── Chi phí chuyến đi (chỉ chủ sở hữu) ──

  /** GET /api/Itinerary/{id}/expenses */
  getExpenses: (id: number) =>
    api.getApi<DTO.ItineraryExpensesDto>(`${controllerName.Itinerary}/${id}/expenses`, { requiresAuth: true }) as Promise<
      api.ApiResult<DTO.ItineraryExpensesDto>
    >,

  /** POST /api/Itinerary/{id}/expenses */
  addExpense: (id: number, data: DTO.SaveExpenseDto) =>
    api.postApi<DTO.ExpenseResultDto>(`${controllerName.Itinerary}/${id}/expenses`, { data, requiresAuth: true }),

  /** PUT /api/Itinerary/{id}/expenses/{expenseId} */
  updateExpense: (id: number, expenseId: number, data: DTO.SaveExpenseDto) =>
    api.putApi<DTO.ExpenseResultDto>(`${controllerName.Itinerary}/${id}/expenses/${expenseId}`, { data, requiresAuth: true }),

  /** DELETE /api/Itinerary/{id}/expenses/{expenseId} -> trả tổng hợp mới */
  removeExpense: (id: number, expenseId: number) =>
    api.deleteApi<DTO.ExpenseSummaryDto>(`${controllerName.Itinerary}/${id}/expenses/${expenseId}`, { requiresAuth: true }),
};