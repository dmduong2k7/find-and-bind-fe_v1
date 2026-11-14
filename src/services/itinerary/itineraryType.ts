/**
 * Khớp với Find_And_Bind_BE.src.Module.Itinerary.ItineraryDtos (backend)
 * DateTime (C#)  -> string ISO 8601 ở FE
 * TimeSpan? (C#) -> string "HH:mm:ss" ở FE (hoặc null)uỗi.
 */

export enum TravelCompanionEnum {
  Solo = 0,
  Friends = 1,
  Family = 2,
  Couple = 3,
}

export enum TravalStyleEnum {
  Relax = 0,
  Culture = 1,
  Adventure = 2,
}

export enum ExpenseCategoryEnum {
  Accommodation = 0,
  Food = 1,
  Ticket = 2,
  Transport = 3,
  Shopping = 4,
  Other = 5,
}

/** Input cho AI lập kế hoạch chuyến đi — POST /api/Itinerary/ai-plan */
export interface TripPlanRequestDto {
  destination: string;
  travelWith: TravelCompanionEnum;
  style: TravalStyleEnum;
  budget: string;
  days: number; // 1..30
  additionalNotes?: string | null;
}

export interface ActivityDto {
  time: string;
  location: string;
  description: string;
  matchedLocationId?: number | null;
  isVerified: boolean;
}

export interface ItineraryDayDto {
  day: number;
  activities: ActivityDto[];
}

/** Kết quả AI trả về — data của ApiResponse<AiItineraryResultDto> */
export interface AiItineraryResultDto {
  itinerary: ItineraryDayDto[];
}

/** Body cho POST /api/Itinerary và PUT /api/Itinerary/{id} */
export interface CreateItineraryDto {
  title: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  coverImageUrl?: string | null;
  itinerary: ItineraryDayDto[];
}

/**
 * Item trong danh sách — GET /api/Itinerary hoặc GET /api/Itinerary/published.
 * `isPublished` chỉ có khi BE bổ sung field này vào ItineraryListDto.
 */
export interface ItineraryListDto {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
  coverImageUrl?: string | null;
  totalDays: number;
  totalActivities: number;
  isPublished?: boolean;
  createdAt: string;
}

/** Khớp ItineraryActivityDto của BE */
export interface ItineraryActivityDto {
  id?: number;
  locationId?: number | null;
  /** Tên Location thật, hoặc tên AI đề xuất nếu chưa xác thực (BE đã gộp sẵn). */
  locationName: string;
  locationAddress?: string | null;
  isVerified?: boolean;
  dayIndex: number;
  sortOrder?: number;
  plannedTime?: string | null; // "HH:mm:ss"
  notes?: string | null;
  /** @deprecated BE không trả field này; đã gộp vào locationName. Xoá khi Planner.tsx được sửa. */
  unverifiedLocationName?: string | null;
}

/** Chi tiết — GET /api/Itinerary/{id} hoặc GET /api/Itinerary/published/{id} */
export interface ItineraryDetailDto {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
  coverImageUrl?: string | null;
  isPublished?: boolean;
  createdAt: string;
  updatedAt?: string | null;
  details?: ItineraryActivityDto[];
  /** @deprecated BE không trả field này, dùng `details` + mapDetailsToItinerary. Xoá khi Planner.tsx được sửa. */
  itinerary?: ItineraryDayDto[];
}

/** Query params cho GET /api/Itinerary và GET /api/Itinerary/published */
export interface ItineraryFilterDto {
  pageIndex?: number; // default 1
  pageSize?: number; // default 10
}

// ───────── Publish ─────────
/** Body cho PATCH /api/Itinerary/{id}/publish */
export interface SetPublishedDto {
  isPublished: boolean;
}

// ───────── Kéo thả sắp xếp ─────────

export interface ReorderDayDto {
  day: number; // 1..366
  /** Id hoạt động (ItineraryActivityDto.id) của ngày này theo thứ tự mới */
  activityIds: number[];
}

/** Body cho PUT /api/Itinerary/{id}/activities/order — phải gửi ĐỦ mọi hoạt động */
export interface ReorderActivitiesDto {
  days: ReorderDayDto[];
  reassignTimeSlots?: boolean; // default false
}

// ───────── Chi phí ─────────

/** Body cho POST / PUT expenses */
export interface SaveExpenseDto {
  title: string; // max 200
  category: ExpenseCategoryEnum;
  amount: number; // > 0
  spentAt?: string | null; // bỏ trống = hiện tại
  note?: string | null; // max 500
}

export interface ExpenseDto {
  id: number;
  title: string;
  category: ExpenseCategoryEnum;
  amount: number;
  spentAt: string;
  note?: string | null;
  createdAt: string;
}

export interface ExpenseCategorySummaryDto {
  category: ExpenseCategoryEnum;
  totalAmount: number;
  count: number;
}

export interface ExpenseSummaryDto {
  totalAmount: number;
  count: number;
  byCategory: ExpenseCategorySummaryDto[];
}

export interface ItineraryExpensesDto {
  itineraryId: number;
  summary: ExpenseSummaryDto;
  items: ExpenseDto[];
}

/** data của POST / PUT expense */
export interface ExpenseResultDto {
  expense: ExpenseDto;
  summary: ExpenseSummaryDto;
}