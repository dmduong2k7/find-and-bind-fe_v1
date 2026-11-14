import React, { createContext, useContext, useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
} from "lucide-react";
import { locationService } from "@/services/location/locationApi";
import { itineraryService } from "@/services/itinerary/itineraryApi";
import { reviewService } from "@/services/review/reviewApi";
import { userService } from "@/services/user/userApi";
import { authService } from "@/services/authentication/authApi";
import { categoryService } from "@/services/category/categoryApi";
import {
  mapDetailsToItinerary,
  buildItineraryPayload,
} from "@/services/itinerary/itineraryMapper";
import {
  getAccessToken,
  clearAuthTokens,
  isAuthenticated,
} from "@/shared/helper/callApi";
import { getAppRole } from "@/shared/helper/jwt";
import type { CategoryDto } from "@/services/category/categoryType";

const IS_DEV = import.meta.env.DEV;

/* ============================================================
 *  TYPES
 * ============================================================ */

export type Role = "user" | "merchant" | "admin" | "moderator";

export type ToastType = "success" | "error" | "info" | "warning";
export type ToastItem = { id: string; message: string; type: ToastType };

export type Review = {
  id: string;
  placeId: number;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
  verifiedVisit?: boolean;
  merchantReply?: string;
};

export type Place = {
  id: number;
  title: string;
  tag: string;
  rating: number;
  reviewsCount: number | string;
  imageClass: string;
  location: string;
  description: string;
  reasons: string[];
  price: string;
  priceConfidence?: number;
  openingHours?: string;
  openingHoursConfidence?: number;
  trustScore?: number;
  riskLevel?: "Bình thường" | "Thấp" | "Trung bình" | "Cao";
  riskReasons?: string[];
  ownerId?: string;
  lat?: number;
  lon?: number;
  categoryId?: number;
  categoryName?: string;
  isSponsored?: boolean;
  createdAt?: string;
  updatedAt?: string | null;
};

export type TripActivity = {
  time: string;
  endTime?: string;
  location: string;
  description: string;
  matchedLocationId?: number | null;
  isVerified?: boolean;
};

export type TripItem = { time: string; act: string; type: string };
export type TripDay = {
  day: number;
  title: string;
  items?: TripItem[];
  activities?: TripActivity[];
};
export type Trip = {
  id: number;
  name: string;
  date: string;
  location: string;
  status: string;
  days: number;
  itinerary: TripDay[];
  isPublished?: boolean;
  startDate?: string;
  endDate?: string;
  /** true khi `itinerary` đã được nạp từ GET /api/Itinerary/{id}. */
  detailLoaded?: boolean;
};

export type FeatureFlags = {
  priceForecast: boolean;
  visualSearch: boolean;
  sponsoredAds: boolean;
  guidebook: boolean;
  comparePois: boolean;
  tasteCollections: boolean;
  avoidList: boolean;
  quickReport: boolean;
  ekycSimulation: boolean;
  verifiedStay: boolean;
  merchantOnboarding: boolean;
  merchantConsole: boolean;
  globalKillSwitch: boolean;
};

export type ApiQuota = {
  geminiVisionCalls: number;
  vnptEkycCalls: number;
  budgetUsed: number;
  budgetLimit: number;
};

export type Appeal = {
  id: string;
  placeId: number;
  status:
    | "step1"
    | "step2"
    | "step3"
    | "step4_pending"
    | "approved"
    | "rejected";
  feeDeposited: boolean;
  evidence?: string;
  evidenceUrl?: string;
  caseId?: string;
};

export type Case = {
  id: string;
  poiTitle: string;
  reportType: string;
  createdAt: string;
  status: "pending" | "processing" | "resolved" | "rejected";
  logs?: { time: string; message: string }[];
  lat?: number;
  lon?: number;
  evidenceUrl?: string;
};

export type RescuePick = {
  id: number;
  title: string;
  tag: string;
  description: string;
  reasons: string[];
  imageClass: string;
  location: string;
  rating: number;
  reviewsCount: number;
  price: string;
  trustScore: number;
  lat: number;
  lon: number;
  status: "pending_mod" | "pending_admin" | "approved" | "rejected";
  dateAdded: string;
  expiryDate: string;
};

export type LamportEvent = {
  id: string;
  tripId: number;
  lamport: number;
  clientId: string;
  action: "add_item" | "delete_item" | "update_name";
  data: any;
};

export type PoiFingerprint = {
  id: string;
  title: string;
  lat: number;
  lon: number;
  layoutHash: string;
  taxId: string;
  bannedAt: string;
};

export type AuthMethod = "email" | "google" | "apple";

export type SessionUser = {
  loggedIn: boolean;
  email?: string;
  name?: string;
  avatar?: string;
  phone?: string;
  gender?: string;
  authMethod?: AuthMethod;
  isVerifiedL3?: boolean;
  ekycHash?: string;
};

export interface PendingDeletionAccount {
  email: string;
  name?: string;
  phone?: string;
  gender?: string;
  authMethod?: AuthMethod;
  isVerifiedL3?: boolean;
  ekycHash?: string;
  requestedAt: number;
  deleteAt: number;
  savedPlaceIds: number[];
  trips: Trip[];
}

/* ============================================================
 *  CẤU HÌNH MẶC ĐỊNH
 * ============================================================ */

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  priceForecast: true,
  visualSearch: true,
  sponsoredAds: true,
  guidebook: true,
  comparePois: true,
  tasteCollections: true,
  avoidList: true,
  quickReport: true,
  ekycSimulation: true,
  verifiedStay: true,
  merchantOnboarding: true,
  merchantConsole: true,
  globalKillSwitch: false,
};

const GRADIENTS = [
  "bg-gradient-nature",
  "bg-gradient-sunset",
  "bg-gradient-ocean",
  "bg-gradient-berry",
  "bg-gradient-lavender",
  "bg-gradient-mint",
];

const SESSION_KEY = "user_session";
const PENDING_DELETIONS_KEY = "find_bind_pending_deletions";

/* ============================================================
 *  CONTEXT TYPE
 * ============================================================ */

type AppContextType = {
  role: Role;
  /** Chỉ có tác dụng khi chạy `vite dev` (để thử giao diện). Role thật lấy từ JWT. */
  setRole: (role: Role) => void;
  places: Place[];
  addPlace: (place: Omit<Place, "id" | "rating" | "reviewsCount">) => void;
  addPlaceWithOwner: (
    place: Omit<Place, "id" | "rating" | "reviewsCount"> & { ownerId: string },
  ) => void;
  /** Thêm/cập nhật địa điểm lấy từ BE (giữ nguyên id thật). */
  upsertServerPlaces: (incoming: Place[]) => void;
  trips: Trip[];
  addTrip: (trip: Omit<Trip, "id">) => void;
  updateTrip: (id: number, updated: Partial<Trip>) => void;
  savedPlaceIds: number[];
  toggleSavedPlace: (id: number) => Promise<void>;
  reviews: Review[];
  addReview: (review: Omit<Review, "id" | "date">) => void;
  addReviewReply: (reviewId: string, reply: string) => void;
  user: SessionUser | null;
  login: (
    email: string,
    name?: string,
    phone?: string,
    gender?: string,
    authMethod?: AuthMethod,
  ) => void;
  logout: () => Promise<void>;
  deleteAccount: () => void;
  scheduleAccountDeletion: () => boolean;
  checkPendingDeletion: (
    email: string,
  ) => {
    isPending: boolean;
    isExpired: boolean;
    deleteAt?: number;
    daysRemaining?: number;
    email: string;
  } | null;
  restoreAccount: (email: string) => boolean;
  privacySettings: { trackLocation: boolean; allowShareData: boolean };
  updatePrivacySettings: (settings: {
    trackLocation: boolean;
    allowShareData: boolean;
  }) => void;
  cases: Case[];
  addCase: (poiTitle: string, reportType: string) => void;
  addCaseWithCoords: (
    poiTitle: string,
    reportType: string,
    lat: number,
    lon: number,
    evidenceUrl?: string,
    customId?: string,
  ) => void;
  updateCaseStatus: (
    id: string,
    status: "resolved" | "rejected",
    reasonText: string,
  ) => void;
  updatePlaceTag: (id: number, newTag: string) => void;
  updatePlaceTrust: (
    id: number,
    score: number,
    risk: "Bình thường" | "Thấp" | "Trung bình" | "Cao",
    reasons?: string[],
  ) => void;

  featureFlags: FeatureFlags;
  updateFeatureFlags: (flags: FeatureFlags) => void;
  apiQuota: ApiQuota;
  incrementQuota: (api: "geminiVision" | "vnptEkyc") => void;
  avoidList: number[];
  addToAvoidList: (id: number) => void;
  removeFromAvoidList: (id: number) => void;
  tasteCollections: string[];
  addTasteCollection: (name: string) => void;
  savedPlacesCollection: { [placeId: number]: string };
  savePlaceToCollection: (placeId: number, colName: string) => void;
  merchantWalletBalance: number;
  updateMerchantWallet: (val: number) => void;
  appeals: Appeal[];
  submitAppeal: (appeal: Omit<Appeal, "id" | "status">) => void;
  updateAppealStatus: (id: string, status: "approved" | "rejected") => void;
  verifyEkycL3: (hash: string) => void;

  categories: CategoryDto[];
  refreshPlaces: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  refreshTrips: () => Promise<void>;
  /** Nạp chi tiết (hoạt động theo ngày) của 1 chuyến đi từ BE. */
  loadTripDetail: (id: number) => Promise<void>;
  togglePublishTrip: (tripId: number, isPublished: boolean) => Promise<boolean>;
  clonePublishedTrip: (publishedId: number) => Promise<boolean>;

  rescuePicks: RescuePick[];
  bannedFingerprints: PoiFingerprint[];
  lamportEvents: LamportEvent[];
  legalHoldActive: boolean;
  setLegalHoldActive: (val: boolean) => void;
  purgeLogs: string[];
  approveRescuePick: (id: number, stage: "moderator" | "admin") => void;
  rejectRescuePick: (id: number) => void;
  submitRescuePick: (
    pick: Omit<RescuePick, "id" | "status" | "dateAdded" | "expiryDate">,
  ) => void;
  addLamportEvent: (event: Omit<LamportEvent, "id">) => void;
  syncLamportEvents: (arg1: any, arg2?: any) => any[];
  checkPoiFingerprint: (
    arg1: any,
    arg2?: any,
    arg3?: any,
    arg4?: any,
  ) => {
    match: boolean;
    matchedBanned: boolean;
    reason?: string;
    matchedFingerprint?: PoiFingerprint & { reason: string };
    confidence: number;
  };
  runPurgeWorker: () => void;

  showToast: (message: string, type?: ToastType) => void;

  /** true => ẩn thanh điều hướng dưới cùng (vd. khi popup chi tiết lịch trình đang mở). */
  hideBottomNav: boolean;
  setHideBottomNav: (hidden: boolean) => void;

  addActivityToTrip: (
    tripId: number,
    dayNumber: number,
    activity: TripActivity,
  ) => void;
  deleteActivityFromTrip: (
    tripId: number,
    dayNumber: number,
    activityIndex: number,
  ) => void;
};

const AppContext = createContext<AppContextType | null>(null);

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("Missing AppProvider");
  return ctx;
};

/* ============================================================
 *  HELPERS
 * ============================================================ */

function readSession(): SessionUser | null {
  try {
    // Không còn token => không coi là đã đăng nhập, dọn session cũ.
    if (!isAuthenticated()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

function readFeatureFlags(): FeatureFlags {
  try {
    const raw = localStorage.getItem("feature_flags");
    return raw
      ? { ...DEFAULT_FEATURE_FLAGS, ...JSON.parse(raw) }
      : DEFAULT_FEATURE_FLAGS;
  } catch {
    return DEFAULT_FEATURE_FLAGS;
  }
}

function readPendingDeletions(): PendingDeletionAccount[] {
  try {
    const raw = localStorage.getItem(PENDING_DELETIONS_KEY);
    return raw ? (JSON.parse(raw) as PendingDeletionAccount[]) : [];
  } catch {
    return [];
  }
}

function writePendingDeletions(list: PendingDeletionAccount[]) {
  localStorage.setItem(PENDING_DELETIONS_KEY, JSON.stringify(list));
}

/* ============================================================
 *  PROVIDER
 * ============================================================ */

export function AppProvider({ children }: { children: React.ReactNode }) {
  // ---- Dữ liệu thật từ BE: bắt đầu rỗng, nạp qua refresh* ----
  const [places, setPlaces] = useState<Place[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [savedPlaceIds, setSavedPlaceIds] = useState<number[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  // ---- Phiên đăng nhập & role ----
  const [user, setUser] = useState<SessionUser | null>(readSession);
  const [role, setRoleState] = useState<Role>(() =>
    getAppRole(getAccessToken()),
  );
  const setRole = (r: Role) => {
    if (IS_DEV) setRoleState(r);
  };

  const [privacySettings, setPrivacySettings] = useState({
    trackLocation: localStorage.getItem("gps_consented") === "true",
    allowShareData: true,
  });

  // ---- Trạng thái mở rộng ----
  const [cases, setCases] = useState<Case[]>([]);
  const [featureFlags, setFeatureFlags] =
    useState<FeatureFlags>(readFeatureFlags);
  const [apiQuota, setApiQuota] = useState<ApiQuota>({
    geminiVisionCalls: 0,
    vnptEkycCalls: 0,
    budgetUsed: 0,
    budgetLimit: 20.0,
  });
  const [avoidList, setAvoidList] = useState<number[]>([]);
  const [tasteCollections, setTasteCollections] = useState<string[]>([
    "Mặc định",
    "Cafe chill",
    "Yêu thiên nhiên",
  ]);
  const [savedPlacesCollection, setSavedPlacesCollection] = useState<{
    [placeId: number]: string;
  }>({});
  const [merchantWalletBalance, setMerchantWalletBalance] = useState<number>(0);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [rescuePicks, setRescuePicks] = useState<RescuePick[]>([]);
  const [bannedFingerprints] = useState<PoiFingerprint[]>([]);
  const [lamportEvents, setLamportEvents] = useState<LamportEvent[]>([]);
  const [legalHoldActive, setLegalHoldActive] = useState<boolean>(false);
  const [purgeLogs, setPurgeLogs] = useState<string[]>([]);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [hideBottomNav, setHideBottomNav] = useState<boolean>(false);

  /* ---------------- Toast ---------------- */

  const showToast = (message: string, type: ToastType = "info") => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    // Chống spam: cùng nội dung đang hiện thì bỏ qua; luôn chỉ giữ 1 toast.
    setToasts((prev) =>
      prev.some((t) => t.message === message) ? prev : [{ id, message, type }],
    );
    setTimeout(
      () => setToasts((curr) => curr.filter((t) => t.id !== id)),
      3000,
    );
  };

  const removeToast = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  /* ---------------- Nạp dữ liệu từ BE ---------------- */

  const refreshCategories = async () => {
    try {
      const res = await categoryService.getAll();
      if (Array.isArray(res?.data) && res.data.length > 0)
        setCategories(res.data);
    } catch (err) {
      console.warn("Fetch categories error:", err);
    }
  };

  const refreshPlaces = async () => {
    try {
      const res = await locationService.getAll({ pageIndex: 1, pageSize: 50 });
      if (!Array.isArray(res?.data)) return;

      const serverPlaces: Place[] = res.data.map((item) => ({
        id: item.id,
        title: item.name,
        tag: item.categoryName || "Địa điểm",
        rating: item.averageRating,
        reviewsCount: item.reviewCount ?? 0,
        imageClass: GRADIENTS[item.id % GRADIENTS.length],
        location: item.address,
        description: "",
        reasons: [],
        price: "Liên hệ",
        lat: item.latitude ?? undefined,
        lon: item.longitude ?? undefined,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
      }));

      // Server là nguồn sự thật: không trộn với dữ liệu giả.
      setPlaces(serverPlaces);
    } catch (err) {
      console.warn("Fetch places error:", err);
    }
  };

  const upsertServerPlaces = (incoming: Place[]) => {
    if (incoming.length === 0) return;
    setPlaces((prev) => {
      const map = new Map<number, Place>();
      prev.forEach((p) => map.set(p.id, p));
      incoming.forEach((p) => {
        const existing = map.get(p.id);
        map.set(p.id, existing ? { ...existing, ...p } : p);
      });
      return Array.from(map.values());
    });
  };

  const refreshTrips = async () => {
    if (!isAuthenticated()) {
      setTrips([]);
      return;
    }
    try {
      const res = await itineraryService.getAll({ pageIndex: 1, pageSize: 50 });
      if (!Array.isArray(res?.data)) return;

      setTrips((prev) =>
        res.data.map((t): Trip => {
          const cached = prev.find((p) => p.id === t.id);
          return {
            id: t.id,
            name: t.title,
            date: t.startDate
              ? new Date(t.startDate).toLocaleDateString("vi-VN")
              : "",
            location:
              t.title.replace(/^(Khám phá|Lịch trình)\s*/i, "") || "Việt Nam",
            status: "Sắp tới",
            days: t.totalDays,
            isPublished: t.isPublished ?? cached?.isPublished ?? false,
            startDate: t.startDate,
            endDate: t.endDate,
            itinerary: cached?.itinerary ?? [],
            detailLoaded: cached?.detailLoaded ?? false,
          };
        }),
      );
    } catch (err) {
      console.warn("Fetch trips error:", err);
    }
  };

  const loadTripDetail = async (id: number) => {
    const res = await itineraryService.getById(id);
    const detail = res?.data;
    if (!detail) return;
    setTrips((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              name: detail.title,
              isPublished: detail.isPublished ?? t.isPublished,
              startDate: detail.startDate,
              endDate: detail.endDate,
              itinerary: mapDetailsToItinerary(detail.details),
              detailLoaded: true,
            }
          : t,
      ),
    );
  };

  const loadFavorites = async () => {
    try {
      const res = await locationService.getMyFavorites({
        pageIndex: 1,
        pageSize: 100,
      });
      if (Array.isArray(res?.data)) {
        setSavedPlaceIds(res.data.map((f) => f.id));
        const favPlaces: Place[] = res.data.map((f) => ({
          id: f.id,
          title: f.name,
          tag: f.categoryName || "Địa điểm",
          rating: f.averageRating ?? 0,
          reviewsCount: f.reviewCount ?? 0,
          imageClass: GRADIENTS[f.id % GRADIENTS.length],
          location: f.address,
          description: "",
          reasons: [],
          price: "Liên hệ",
          lat: f.latitude ?? undefined,
          lon: f.longitude ?? undefined,
          categoryId: f.categoryId,
          categoryName: f.categoryName,
        }));
        upsertServerPlaces(favPlaces);
      }
    } catch (err) {
      console.warn("Fetch favorites error:", err);
    }
  };

  const loadMyReviews = async () => {
    try {
      const res = await reviewService.getMyReviews();
      if (Array.isArray(res?.data)) {
        const mapped: Review[] = res.data.map((r) => ({
          id: String(r.id),
          placeId: r.locationId,
          userId: String(r.userProfileId),
          userName: r.userFullName || "Người dùng",
          rating: r.ratingValue,
          comment: r.comment || "",
          date: r.createdAt
            ? new Date(r.createdAt).toLocaleDateString("vi-VN")
            : new Date().toLocaleDateString("vi-VN"),
          verifiedVisit: true,
        }));
        setReviews(mapped);
      }
    } catch (err) {
      console.warn("Fetch my reviews error:", err);
    }
  };

  const togglePublishTrip = async (
    tripId: number,
    isPublished: boolean,
  ): Promise<boolean> => {
    await itineraryService.setPublished(tripId, isPublished);
    setTrips((prev) =>
      prev.map((t) => (t.id === tripId ? { ...t, isPublished } : t)),
    );
    return true;
  };

  const clonePublishedTrip = async (publishedId: number): Promise<boolean> => {
    const res = await itineraryService.clonePublished(publishedId);
    if (res?.data) {
      await refreshTrips();
      return true;
    }
    return false;
  };

  /* ---------------- Effects ---------------- */

  useEffect(() => {
    refreshCategories();
    refreshPlaces();
  }, []);

  // Lưu / xoá session theo state `user` (một nơi duy nhất).
  useEffect(() => {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  }, [user]);

  // Đăng nhập / đăng xuất: nạp dữ liệu cá nhân và cập nhật role từ JWT.
  useEffect(() => {
    if (!user?.loggedIn) {
      setRoleState("user");
      return;
    }
    setRoleState(getAppRole(getAccessToken()));

    if (!isAuthenticated()) return; // đăng nhập giả (chưa có token) thì không gọi API cá nhân

    refreshTrips();
    loadFavorites();
    loadMyReviews();
    userService
      .getMyProfile()
      .then((res) => {
        const p = res?.data;
        if (!p) return;
        setUser((prev) =>
          prev
            ? {
                ...prev,
                email: p.email || prev.email,
                name: p.fullName || prev.name,
                avatar: p.avatar || prev.avatar,
              }
            : prev,
        );
      })
      .catch((err) => console.warn("Get profile API err:", err));
  }, [user?.loggedIn]);

  // Refresh token hết hạn / bị thu hồi: callApi phát sự kiện này.
  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setTrips([]);
      setSavedPlaceIds([]);
      setRoleState("user");
    };
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  /* ---------------- Auth ---------------- */

  const login = (
    email: string,
    name?: string,
    phone?: string,
    gender?: string,
    authMethod: AuthMethod = "email",
  ) => {
    setUser((prev) => {
      // Chỉ kế thừa hồ sơ cũ khi cùng một email, tránh lẫn dữ liệu giữa hai tài khoản.
      const base = prev?.email === email ? prev : undefined;
      return {
        ...base,
        loggedIn: true,
        email,
        name: name || base?.name || email.split("@")[0],
        phone: phone ?? base?.phone ?? "",
        gender: gender || base?.gender || "Nam",
        authMethod,
        isVerifiedL3: base?.isVerifiedL3 ?? false,
      };
    });
  };

  const resetSessionState = () => {
    clearAuthTokens();
    setUser(null);
    setTrips([]);
    setSavedPlaceIds([]);
    setRoleState("user");
  };

  const logout = async () => {
    try {
      if (getAccessToken()) await authService.logout();
    } catch {
      // Vẫn dọn local dù BE lỗi.
    }
    resetSessionState();
  };

  const verifyEkycL3 = (hash: string) => {
    setUser((prev) =>
      prev ? { ...prev, isVerifiedL3: true, ekycHash: hash } : prev,
    );
  };

  /**
   * Xoá tài khoản "bảo lưu 7 ngày": hiện CHỈ lưu ở trình duyệt, BE chưa có endpoint tương ứng.
   * Chỉ nên bật khi BE hỗ trợ (IsActive=false + thu hồi token).
   */
  const scheduleAccountDeletion = (): boolean => {
    if (!user || !user.email) return false;

    const requestedAt = Date.now();
    const pendingItem: PendingDeletionAccount = {
      email: user.email.toLowerCase().trim(),
      name: user.name,
      phone: user.phone,
      gender: user.gender,
      authMethod: user.authMethod,
      isVerifiedL3: user.isVerifiedL3,
      ekycHash: user.ekycHash,
      requestedAt,
      deleteAt: requestedAt + 7 * 24 * 60 * 60 * 1000,
      savedPlaceIds: [...savedPlaceIds],
      trips: [...trips],
    };

    const list = readPendingDeletions().filter(
      (item) => item.email.toLowerCase() !== pendingItem.email,
    );
    list.push(pendingItem);
    writePendingDeletions(list);

    if (getAccessToken()) authService.logout().catch(() => {});
    resetSessionState();
    return true;
  };

  const checkPendingDeletion = (email: string) => {
    if (!email) return null;
    const cleanEmail = email.toLowerCase().trim();
    let list = readPendingDeletions();

    const found = list.find((item) => item.email.toLowerCase() === cleanEmail);
    if (!found) return null;

    const now = Date.now();
    if (now >= found.deleteAt) {
      list = list.filter((item) => item.email.toLowerCase() !== cleanEmail);
      writePendingDeletions(list);
      return { isPending: false, isExpired: true, email: cleanEmail };
    }

    const daysRemaining = Math.max(
      1,
      Math.ceil((found.deleteAt - now) / (24 * 60 * 60 * 1000)),
    );
    return {
      isPending: true,
      isExpired: false,
      deleteAt: found.deleteAt,
      daysRemaining,
      email: cleanEmail,
    };
  };

  const restoreAccount = (email: string): boolean => {
    if (!email) return false;
    const cleanEmail = email.toLowerCase().trim();
    const list = readPendingDeletions();
    const index = list.findIndex(
      (item) => item.email.toLowerCase() === cleanEmail,
    );
    if (index === -1) return false;

    const item = list[index];
    if (Array.isArray(item.savedPlaceIds)) setSavedPlaceIds(item.savedPlaceIds);
    if (Array.isArray(item.trips)) setTrips(item.trips);
    login(
      item.email,
      item.name,
      item.phone,
      item.gender,
      item.authMethod || "email",
    );

    list.splice(index, 1);
    writePendingDeletions(list);
    return true;
  };

  const deleteAccount = () => {
    scheduleAccountDeletion();
  };

  const updatePrivacySettings = (settings: {
    trackLocation: boolean;
    allowShareData: boolean;
  }) => {
    setPrivacySettings(settings);
    localStorage.setItem(
      "gps_consented",
      settings.trackLocation ? "true" : "false",
    );
  };

  /* ---------------- Địa điểm đã lưu (BE favorites) ---------------- */

  const toggleSavedPlace = async (id: number) => {
    if (!isAuthenticated()) {
      showToast("Vui lòng đăng nhập để lưu địa điểm.", "warning");
      return;
    }
    const wasSaved = savedPlaceIds.includes(id);
    // Cập nhật lạc quan, lỗi thì hoàn tác.
    setSavedPlaceIds((prev) =>
      wasSaved ? prev.filter((x) => x !== id) : [...prev, id],
    );
    try {
      if (wasSaved) await locationService.removeFavorite(id);
      else await locationService.addFavorite(id);
    } catch {
      setSavedPlaceIds((prev) =>
        wasSaved ? [...prev, id] : prev.filter((x) => x !== id),
      );
      showToast("Không cập nhật được danh sách yêu thích.", "error");
    }
  };

  const savePlaceToCollection = (placeId: number, colName: string) => {
    setSavedPlacesCollection((prev) => ({ ...prev, [placeId]: colName }));
    if (!savedPlaceIds.includes(placeId)) {
      setSavedPlaceIds((prev) => [...prev, placeId]);
      if (isAuthenticated())
        locationService.addFavorite(placeId).catch(() => {});
    }
  };

  /* ---------------- Reviews (kết nối BE Review API) ---------------- */

  const addReview = (review: Omit<Review, "id" | "date">) => {
    const newRev: Review = {
      ...review,
      id: Date.now().toString(),
      date: new Date().toLocaleDateString("vi-VN"),
    };
    setReviews((prev) => [newRev, ...prev]);

    if (isAuthenticated() && review.placeId) {
      reviewService
        .create({
          locationId: Number(review.placeId),
          ratingValue: review.rating,
          comment: review.comment,
        })
        .then(() => {
          loadMyReviews();
          refreshPlaces();
        })
        .catch((err) => console.warn("Create review API error:", err));
    }
  };

  const addReviewReply = (reviewId: string, reply: string) => {
    setReviews((prev) =>
      prev.map((rev) =>
        rev.id === reviewId ? { ...rev, merchantReply: reply } : rev,
      ),
    );
  };

  /* ---------------- Trips (kết nối BE Itinerary API) ---------------- */

  const syncTripToBackend = (trip: Trip) => {
    if (!isAuthenticated() || !trip.id) return;
    const payload = buildItineraryPayload({
      title: trip.name,
      startDate: trip.startDate,
      endDate: trip.endDate,
      totalDays: trip.days,
      isPublished: trip.isPublished,
      days: trip.itinerary,
      places,
    });
    itineraryService
      .update(trip.id, payload)
      .catch((err) => console.warn("Sync trip to BE error:", err));
  };

  const addTrip = (trip: Omit<Trip, "id">) => {
    const tempId = Date.now();
    setTrips((prev) => [{ ...trip, id: tempId }, ...prev]);

    if (isAuthenticated()) {
      const payload = buildItineraryPayload({
        title: trip.name,
        startDate: trip.startDate,
        endDate: trip.endDate,
        totalDays: trip.days,
        isPublished: trip.isPublished,
        days: trip.itinerary,
        places,
      });
      itineraryService
        .create(payload)
        .then((res) => {
          const created = res?.data;
          if (created?.id) {
            setTrips((prev) =>
              prev.map((t) =>
                t.id === tempId
                  ? {
                      ...t,
                      id: created.id,
                      name: created.title || t.name,
                      startDate: created.startDate || t.startDate,
                      endDate: created.endDate || t.endDate,
                      itinerary: Array.isArray(created.details)
                        ? mapDetailsToItinerary(created.details)
                        : t.itinerary,
                      detailLoaded: true,
                    }
                  : t,
              ),
            );
          }
        })
        .catch((err) => console.warn("Create trip API error:", err));
    }
  };

  const updateTrip = (id: number, updated: Partial<Trip>) => {
    setTrips((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const merged = { ...t, ...updated };
        syncTripToBackend(merged);
        return merged;
      }),
    );
  };

  const addActivityToTrip = (
    tripId: number,
    dayNumber: number,
    activity: TripActivity,
  ) => {
    const newItem: TripItem = {
      time: activity.time,
      act: `${activity.location} - ${activity.description}`,
      type: activity.isVerified ? "verified" : "explore",
    };

    setTrips((prev) =>
      prev.map((t) => {
        if (t.id !== tripId) return t;
        const days = [...(t.itinerary || [])];
        const idx = days.findIndex((d) => d.day === dayNumber);
        if (idx === -1) {
          days.push({
            day: dayNumber,
            title: `Ngày ${dayNumber}`,
            activities: [activity],
            items: [newItem],
          });
          days.sort((a, b) => a.day - b.day);
        } else {
          days[idx] = {
            ...days[idx],
            activities: [...(days[idx].activities || []), activity],
            items: [...(days[idx].items || []), newItem],
          };
        }
        const updatedTrip = { ...t, itinerary: days };
        syncTripToBackend(updatedTrip);
        return updatedTrip;
      }),
    );
    showToast(
      `Đã thêm "${activity.location}" vào Ngày ${dayNumber} của chuyến đi!`,
      "success",
    );
  };

  const deleteActivityFromTrip = (
    tripId: number,
    dayNumber: number,
    activityIndex: number,
  ) => {
    setTrips((prev) =>
      prev.map((t) => {
        if (t.id !== tripId) return t;
        const days = (t.itinerary || []).map((d) => {
          if (d.day !== dayNumber) return d;
          return {
            ...d,
            activities: (d.activities || []).filter(
              (_, i) => i !== activityIndex,
            ),
            items: (d.items || []).filter((_, i) => i !== activityIndex),
          };
        });
        const updatedTrip = { ...t, itinerary: days };
        syncTripToBackend(updatedTrip);
        return updatedTrip;
      }),
    );
    showToast("Đã xóa hoạt động khỏi lịch trình.", "info");
  };

  /* ---------------- Places (kết nối BE Location API) ---------------- */

  const addPlaceWithOwner = (
    place: Omit<Place, "id" | "rating" | "reviewsCount"> & { ownerId: string },
  ) => {
    const tempId = Date.now();
    const matchedCat =
      categories.find((c) => c.id === place.categoryId) ||
      categories.find(
        (c) => c.name.toLowerCase() === (place.tag || "").toLowerCase(),
      ) ||
      categories[0];

    setPlaces((prev) => [
      {
        ...place,
        id: tempId,
        rating: 0,
        reviewsCount: 0,
        lat: place.lat,
        lon: place.lon,
        categoryId: place.categoryId ?? matchedCat?.id,
        categoryName: place.categoryName ?? matchedCat?.name ?? place.tag,
      },
      ...prev,
    ]);

    if (isAuthenticated()) {
      locationService
        .create({
          name: place.title,
          description: place.description,
          address: place.location,
          categoryId: place.categoryId ?? matchedCat?.id ?? 1,
        })
        .then((res) => {
          const created = res?.data;
          if (created?.id) {
            setPlaces((prev) =>
              prev.map((p) =>
                p.id === tempId
                  ? {
                      ...p,
                      id: created.id,
                      title: created.name,
                      tag: created.categoryName || p.tag,
                      rating: created.averageRating ?? 0,
                      reviewsCount: created.reviewCount ?? 0,
                      location: created.address,
                      description: created.description || p.description,
                      lat: created.latitude ?? p.lat,
                      lon: created.longitude ?? p.lon,
                      categoryId: created.categoryId,
                      categoryName: created.categoryName,
                      createdAt: created.createdAt,
                      updatedAt: created.updatedAt,
                    }
                  : p,
              ),
            );
          }
        })
        .catch((err) => console.warn("Create location API error:", err));
    }
  };

  const addPlace = (place: Omit<Place, "id" | "rating" | "reviewsCount">) => {
    addPlaceWithOwner({ ...place, ownerId: user?.email || "system" });
  };

  const updatePlaceTag = (id: number, newTag: string) => {
    const matchedCat = categories.find(
      (c) => c.name.toLowerCase() === newTag.toLowerCase(),
    );
    setPlaces((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const updatedPlace = {
          ...p,
          tag: newTag,
          categoryId: matchedCat?.id ?? p.categoryId,
          categoryName: matchedCat?.name ?? newTag,
        };
        if (isAuthenticated()) {
          locationService
            .update(id, {
              name: updatedPlace.title,
              description: updatedPlace.description || undefined,
              address: updatedPlace.location,
              categoryId: updatedPlace.categoryId ?? 1,
            })
            .catch((err) => console.warn("Update place tag API error:", err));
        }
        return updatedPlace;
      }),
    );
  };

  const updatePlaceTrust = (
    id: number,
    score: number,
    risk: "Bình thường" | "Thấp" | "Trung bình" | "Cao",
    reasons?: string[],
  ) => {
    setPlaces((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              trustScore: score,
              riskLevel: risk,
              riskReasons: reasons || [],
            }
          : p,
      ),
    );
  };

  /* ---------------- Feature flags / quota / collections (demo) ---------------- */

  const updateFeatureFlags = (flags: FeatureFlags) => {
    setFeatureFlags(flags);
    localStorage.setItem("feature_flags", JSON.stringify(flags));
  };

  const incrementQuota = (api: "geminiVision" | "vnptEkyc") => {
    setApiQuota((prev) => {
      const isVision = api === "geminiVision";
      const cost = isVision ? 0.05 : 0.2;
      return {
        ...prev,
        geminiVisionCalls: prev.geminiVisionCalls + (isVision ? 1 : 0),
        vnptEkycCalls: prev.vnptEkycCalls + (!isVision ? 1 : 0),
        budgetUsed: Math.round((prev.budgetUsed + cost) * 100) / 100,
      };
    });
  };

  const addToAvoidList = (id: number) =>
    setAvoidList((prev) => (prev.includes(id) ? prev : [...prev, id]));
  const removeFromAvoidList = (id: number) =>
    setAvoidList((prev) => prev.filter((pid) => pid !== id));
  const addTasteCollection = (name: string) =>
    setTasteCollections((prev) =>
      prev.includes(name) ? prev : [...prev, name],
    );
  const updateMerchantWallet = (val: number) => setMerchantWalletBalance(val);

  /* ---------------- Cases (demo) ---------------- */

  const addCaseWithCoords = (
    poiTitle: string,
    reportType: string,
    lat: number,
    lon: number,
    evidenceUrl?: string,
    customId?: string,
  ) => {
    const recent = cases.find(
      (c) => c.poiTitle === poiTitle && c.reportType === reportType,
    );
    if (recent && Date.now() - new Date(recent.createdAt).getTime() < 20000) {
      showToast(
        "Báo cáo cho địa điểm này đã được gửi trước đó và đang được xử lý.",
        "info",
      );
      return;
    }

    const now = new Date().toLocaleString("vi-VN");
    const newCase: Case = {
      id: customId || `RP-${Math.floor(1000 + Math.random() * 9000)}`,
      poiTitle,
      reportType,
      createdAt: new Date().toISOString(),
      status: "pending",
      lat,
      lon,
      evidenceUrl,
      logs: [
        {
          time: now,
          message: `Báo cáo mới được khởi tạo kèm vị trí GPS: [${lat.toFixed(4)}, ${lon.toFixed(4)}]`,
        },
        ...(evidenceUrl
          ? [
              {
                time: now,
                message: "Đã đính kèm ảnh bằng chứng / hóa đơn thanh toán.",
              },
            ]
          : []),
      ],
    };
    setCases((prev) => [newCase, ...prev]);
  };

  const addCase = (poiTitle: string, reportType: string) => {
    addCaseWithCoords(poiTitle, reportType, 10.7719, 106.6983);
  };

  const updateCaseStatus = (
    id: string,
    status: "resolved" | "rejected",
    reasonText: string,
  ) => {
    setCases((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status,
              logs: [
                ...(c.logs || []),
                {
                  time: new Date().toLocaleString("vi-VN"),
                  message: reasonText,
                },
              ],
            }
          : c,
      ),
    );
  };

  /* ---------------- Appeals (demo) ---------------- */

  const submitAppeal = (appeal: Omit<Appeal, "id" | "status">) => {
    const newAppeal: Appeal = {
      ...appeal,
      id: `AP-${Math.floor(1000 + Math.random() * 9000)}`,
      status: "step4_pending",
    };
    setAppeals((prev) => [newAppeal, ...prev]);

    if (appeal.caseId) {
      setCases((prev) =>
        prev.map((c) =>
          c.id === appeal.caseId
            ? {
                ...c,
                logs: [
                  ...(c.logs || []),
                  {
                    time: new Date().toLocaleString("vi-VN"),
                    message:
                      "Đối tác đã nộp đơn kháng cáo và đóng lệ phí. Đang chờ Mod xét duyệt.",
                  },
                ],
              }
            : c,
        ),
      );
    }
  };

  const updateAppealStatus = (id: string, status: "approved" | "rejected") => {
    const target = appeals.find((ap) => ap.id === id);
    if (!target) return;

    setAppeals((prev) =>
      prev.map((ap) => (ap.id === id ? { ...ap, status } : ap)),
    );

    if (status === "approved") {
      updatePlaceTrust(target.placeId, 90, "Bình thường", []);
      if (target.caseId) {
        updateCaseStatus(
          target.caseId,
          "rejected",
          "Kháng cáo thành công. Bác bỏ báo cáo và phục hồi danh tiếng.",
        );
      }
    }
  };

  /* ---------------- Rescue picks (demo) ---------------- */

  const approveRescuePick = (id: number, stage: "moderator" | "admin") => {
    const approvedCount = rescuePicks.filter(
      (p) => p.status === "approved",
    ).length;
    if (stage === "admin" && approvedCount >= 20) {
      showToast(
        "Đã đạt giới hạn số lượng địa điểm giải cứu tối đa (tối đa 20 địa điểm)!",
        "warning",
      );
      return;
    }

    setRescuePicks((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (stage === "moderator" && p.status === "pending_mod")
          return { ...p, status: "pending_admin" };
        if (stage === "admin" && p.status === "pending_admin") {
          return {
            ...p,
            status: "approved",
            dateAdded: new Date().toISOString(),
            expiryDate: new Date(
              Date.now() + 14 * 24 * 3600 * 1000,
            ).toISOString(),
          };
        }
        return p;
      }),
    );
  };

  const rejectRescuePick = (id: number) => {
    setRescuePicks((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "rejected" } : p)),
    );
  };

  const submitRescuePick = (
    pick: Omit<RescuePick, "id" | "status" | "dateAdded" | "expiryDate">,
  ) => {
    const newPick: RescuePick = {
      ...pick,
      id: Date.now(),
      status: "pending_mod",
      dateAdded: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
    };
    setRescuePicks((prev) => [newPick, ...prev]);
  };

  /* ---------------- Lamport sync (demo) ---------------- */

  const addLamportEvent = (event: Omit<LamportEvent, "id">) => {
    const newEvent: LamportEvent = {
      ...event,
      id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    setLamportEvents((prev) => [...prev, newEvent]);
  };

  const syncLamportEvents = (arg1: any, arg2?: any): any[] => {
    let incomingEvents: any[] = [];
    let targetTripId = 1;

    if (Array.isArray(arg1)) {
      incomingEvents = arg1;
    } else if (typeof arg1 === "number") {
      targetTripId = arg1;
      incomingEvents = Array.isArray(arg2) ? arg2 : [];
    }

    setLamportEvents((prev) => {
      const all = [...prev];
      incomingEvents.forEach((ie: any) => {
        const mapped: LamportEvent = {
          id: ie.id || `evt-${Date.now()}-${Math.random()}`,
          tripId: ie.tripId || targetTripId,
          lamport: ie.clock || ie.lamport || 1,
          clientId: ie.clientId || "client-local",
          action:
            ie.type === "add_activity" ? "add_item" : ie.action || "add_item",
          data: ie.payload ||
            ie.data || { act: "Hoạt động", time: "12:00", type: "activity" },
        };
        if (!all.find((e) => e.id === mapped.id)) all.push(mapped);
      });

      // Sắp theo Lamport timestamp, hoà thì so sánh clientId.
      all.sort((a, b) =>
        a.lamport !== b.lamport
          ? a.lamport - b.lamport
          : a.clientId.localeCompare(b.clientId),
      );
      return all;
    });

    return [...incomingEvents].sort((a: any, b: any) => {
      const clockA = a.clock || a.lamport || 0;
      const clockB = b.clock || b.lamport || 0;
      if (clockA !== clockB) return clockA - clockB;
      return (a.clientId || "").localeCompare(b.clientId || "");
    });
  };

  /* ---------------- Fingerprint (demo) ---------------- */

  const checkPoiFingerprint = (
    arg1: any,
    arg2?: any,
    arg3?: any,
    arg4?: any,
  ) => {
    let lat = 0;
    let lon = 0;
    let layoutHash = "";
    let taxId = "";
    let gpsNear = false;

    if (typeof arg1 === "object" && arg1 !== null) {
      taxId = arg1.taxId || "";
      layoutHash = arg1.layoutHash || "";
      gpsNear =
        arg1.gpsDistance !== undefined && Number(arg1.gpsDistance) <= 50;
    } else {
      lat = Number(arg1) || 0;
      lon = Number(arg2) || 0;
      layoutHash = String(arg3 || "");
      taxId = String(arg4 || "");
    }

    const same = (a: string, b: string) =>
      Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

    const match = bannedFingerprints.find((bf) => {
      const geoMatch =
        gpsNear ||
        (lat !== 0 &&
          Math.abs(bf.lat - lat) < 0.0005 &&
          Math.abs(bf.lon - lon) < 0.0005);
      return (
        geoMatch || same(bf.layoutHash, layoutHash) || same(bf.taxId, taxId)
      );
    });

    if (!match) return { match: false, matchedBanned: false, confidence: 0.05 };

    let reason: string;
    if (same(match.taxId, taxId))
      reason = `Mã số thuế trùng khớp với thực thể bị cấm (${match.title})`;
    else if (same(match.layoutHash, layoutHash))
      reason = `Bản vẽ cấu trúc mặt bằng trùng khớp với thực thể bị cấm (${match.title})`;
    else
      reason = `Tọa độ GPS trùng khớp cực cận (<50m) với thực thể bị cấm (${match.title})`;

    return {
      match: true,
      matchedBanned: true,
      reason,
      matchedFingerprint: { ...match, reason },
      confidence: 0.98,
    };
  };

  const runPurgeWorker = () => {
    if (legalHoldActive) {
      showToast(
        "Hệ thống đang ở chế độ Đóng băng Pháp lý (Legal Hold). Tạm hoãn mọi tiến trình dọn dẹp dữ liệu.",
        "info",
      );
      return;
    }

    const now = new Date();
    const purgedItems: string[] = [];

    const expired = rescuePicks.filter(
      (p) => p.status === "approved" && new Date(p.expiryDate) < now,
    );
    expired.forEach((e) =>
      purgedItems.push(
        `[Rescue Picks] Đã ẩn & xóa booth giải cứu hết hạn của "${e.title}".`,
      ),
    );
    if (expired.length > 0) {
      setRescuePicks((prev) =>
        prev.filter(
          (p) => !(p.status === "approved" && new Date(p.expiryDate) < now),
        ),
      );
    }

    purgedItems.push(
      "[Auto-Purge] Đã dọn dẹp các bản ghi log tạm thời và session hết hạn (Nghị định 13).",
    );

    if (!privacySettings.allowShareData) {
      purgedItems.push(
        "[Nghị định 13] Rút quyền chia sẻ: Đã xóa toàn bộ cache lịch sử duyệt, vị trí và hành trình nhóm.",
      );
    }

    setPurgeLogs((prev) => [...purgedItems, ...prev]);
    showToast(
      `Đã dọn dẹp ${purgedItems.length} mục dữ liệu riêng tư thành công!`,
      "success",
    );
  };

  /* ============================================================
   *  RENDER
   * ============================================================ */

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        places,
        addPlace,
        addPlaceWithOwner,
        upsertServerPlaces,
        trips,
        addTrip,
        updateTrip,
        savedPlaceIds,
        toggleSavedPlace,
        reviews,
        addReview,
        addReviewReply,
        user,
        login,
        logout,
        deleteAccount,
        scheduleAccountDeletion,
        checkPendingDeletion,
        restoreAccount,
        privacySettings,
        updatePrivacySettings,
        cases,
        addCase,
        addCaseWithCoords,
        updateCaseStatus,
        updatePlaceTag,
        updatePlaceTrust,

        categories,
        refreshPlaces,
        refreshCategories,
        refreshTrips,
        loadTripDetail,
        togglePublishTrip,
        clonePublishedTrip,

        featureFlags,
        updateFeatureFlags,
        apiQuota,
        incrementQuota,
        avoidList,
        addToAvoidList,
        removeFromAvoidList,
        tasteCollections,
        addTasteCollection,
        savedPlacesCollection,
        savePlaceToCollection,
        merchantWalletBalance,
        updateMerchantWallet,
        appeals,
        submitAppeal,
        updateAppealStatus,
        verifyEkycL3,

        rescuePicks,
        bannedFingerprints,
        lamportEvents,
        legalHoldActive,
        setLegalHoldActive,
        purgeLogs,
        approveRescuePick,
        rejectRescuePick,
        submitRescuePick,
        addLamportEvent,
        syncLamportEvents,
        checkPoiFingerprint,
        runPurgeWorker,

        showToast,
        hideBottomNav,
        setHideBottomNav,
        addActivityToTrip,
        deleteActivityFromTrip,
      }}
    >
      {children}

      {/* Toast container */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-9999 flex flex-col gap-2 w-11/12 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => {
            const isSuccess = toast.type === "success";
            const isError = toast.type === "error";
            const isWarn = toast.type === "warning";

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl shadow-xl backdrop-blur-xl border transition-all ${
                  isSuccess
                    ? "bg-emerald-950/90 text-white border-emerald-500/30 shadow-emerald-950/20"
                    : isError
                      ? "bg-rose-950/90 text-white border-rose-500/30 shadow-rose-950/20"
                      : isWarn
                        ? "bg-amber-950/90 text-white border-amber-500/30 shadow-amber-950/20"
                        : "bg-slate-900/90 text-white border-white/20 shadow-slate-950/30"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="shrink-0">
                    {isSuccess && (
                      <CheckCircle2 size={18} className="text-emerald-400" />
                    )}
                    {isError && (
                      <AlertCircle size={18} className="text-rose-400" />
                    )}
                    {isWarn && (
                      <AlertTriangle size={18} className="text-amber-400" />
                    )}
                    {!isSuccess && !isError && !isWarn && (
                      <Info size={18} className="text-indigo-400" />
                    )}
                  </div>
                  <span className="text-xs font-semibold leading-tight line-clamp-2">
                    {toast.message}
                  </span>
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="p-1 text-white/50 hover:text-white rounded-lg transition-colors shrink-0 cursor-pointer"
                  aria-label="Đóng thông báo"
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </AppContext.Provider>
  );
}
