import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Sparkles,
  ChevronLeft,
  User,
  Heart,
  Users,
  ArrowRight,
  Calendar,
  DollarSign,
  Clock,
  Compass,
  AlertTriangle,
  Search,
  CheckCircle2,
  Copy,
  X,
  RefreshCw,
  Eye,
} from "lucide-react";
import { useAppContext, Trip } from "../context/AppContext";
import { cn } from "../App";
import { itineraryService } from "@/services/itinerary/itineraryApi";
import { locationService } from "@/services/location/locationApi";
import { buildItineraryPayload } from "@/services/itinerary/itineraryMapper";
import {
  TravelCompanionEnum,
  TravalStyleEnum,
} from "@/services/itinerary/itineraryType";
import { getAccessToken } from "@/shared/helper/callApi";

const COMPANION_MAP: Record<string, TravelCompanionEnum> = {
  "Một mình": TravelCompanionEnum.Solo,
  "Cặp đôi": TravelCompanionEnum.Couple,
  "Gia đình": TravelCompanionEnum.Family,
  "Nhóm bạn": TravelCompanionEnum.Friends,
};

const STYLE_MAP: Record<string, TravalStyleEnum> = {
  "Nghỉ dưỡng & Thư giãn": TravalStyleEnum.Relax,
  "Khám phá Văn hóa": TravalStyleEnum.Culture,
  "Thiên nhiên & Mạo hiểm": TravalStyleEnum.Adventure,
};

export default function AICreator() {
  const navigate = useNavigate();
  const routeLocation = useLocation();
  // Điểm đến truyền từ trang chi tiết địa điểm ("Thêm vào Kế hoạch") => bỏ qua bước chọn điểm đến.
  const presetDest = React.useMemo(() => {
    const d = (routeLocation.state as { destination?: unknown } | null)
      ?.destination;
    return typeof d === "string" ? d.trim() : "";
  }, [routeLocation.key]);
  const hasPresetDest = presetDest.length > 0;
  const stepOffset = hasPresetDest ? 1 : 0; // số bước bị bỏ qua (để hiển thị "Bước x / y")
  const { trips, places, addTrip, updateTrip, refreshTrips, showToast } =
    useAppContext();
  const [step, setStep] = useState(hasPresetDest ? 2 : 1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] = useState<
    "generating" | "scanning" | "idle"
  >("idle");
  const [customDest, setCustomDest] = useState("");

  // Duplicate Trip Detection Modal State
  const [duplicateModalInfo, setDuplicateModalInfo] = useState<{
    existingTrip: Trip;
    destination: string;
    totalDays: number;
    mappedItinerary: any[];
  } | null>(null);

  // Budget Slider Value (VNĐ per person/day)
  const [budgetTier, setBudgetTier] = useState<
    "Tiết kiệm" | "Trung bình" | "Thoải mái"
  >("Trung bình");
  const [budgetValue, setBudgetValue] = useState<number>(1000000);

  // Swipe-to-back gesture
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    if (deltaX > 75) {
      handleGoBack();
    }
    setTouchStartX(null);
  };

  const handleGoBack = () => {
    if (step > (hasPresetDest ? 2 : 1)) {
      setStep((prev) => prev - 1);
    } else if (hasPresetDest && window.history.length > 1) {
      navigate(-1); // quay lại trang địa điểm vừa bấm "Thêm vào Kế hoạch"
    } else {
      navigate("/plan");
    }
  };

  const handleTierChange = (tier: "Tiết kiệm" | "Trung bình" | "Thoải mái") => {
    setBudgetTier(tier);
    let defaultVal = 1000000;
    if (tier === "Tiết kiệm") defaultVal = 300000;
    else if (tier === "Trung bình") defaultVal = 1000000;
    else defaultVal = 3500000;
    setBudgetValue(defaultVal);
    setChoices((prev) => ({
      ...prev,
      budget: `${tier} (~${defaultVal.toLocaleString("vi-VN")}đ/ngày)`,
    }));
  };

  const getSliderBounds = () => {
    if (budgetTier === "Tiết kiệm")
      return { min: 50000, max: 500000, step: 25000 };
    if (budgetTier === "Trung bình")
      return { min: 500000, max: 2500000, step: 50000 };
    return { min: 2500000, max: 10000000, step: 250000 };
  };

  const [choices, setChoices] = useState({
    dest: presetDest,
    days: 3,
    budget: "Trung bình",
    who: "Một mình",
    style: "Nghỉ dưỡng & Thư giãn",
  });

  // Helper to persist trip
  const saveTripToStorage = async (
    tripName: string,
    mappedItinerary: any[],
    destination: string,
  ) => {
    const token = getAccessToken();
    if (token) {
      try {
        const itineraryPayload = mappedItinerary.map((d: any) => ({
          day: d.day,
          activities: (d.activities || []).map((act: any) => ({
            time: act.time || "08:00",
            location: act.location || destination,
            description: act.description || "Tham quan và trải nghiệm",
            matchedLocationId: act.matchedLocationId ?? null,
            isVerified: !!act.isVerified,
          })),
        }));

        await itineraryService.create({
          title: tripName,
          startDate: new Date().toISOString(),
          endDate: new Date(
            Date.now() + mappedItinerary.length * 24 * 3600 * 1000,
          ).toISOString(),
          coverImageUrl: null,
          itinerary: itineraryPayload,
        });

        await refreshTrips();
      } catch (saveErr) {
        console.warn(
          "Saving itinerary to BE failed, saving to local store:",
          saveErr,
        );
        addTrip({
          name: tripName,
          date: "Sắp tới",
          location: destination,
          status: "Mới tạo",
          days: mappedItinerary.length,
          itinerary: mappedItinerary,
        });
      }
    } else {
      addTrip({
        name: tripName,
        date: "Sắp tới",
        location: destination,
        status: "Mới tạo",
        days: mappedItinerary.length,
        itinerary: mappedItinerary,
      });
    }
  };

  const executePlanGeneration = async (finalChoices: typeof choices) => {
    if (isGenerating) return;
    setIsGenerating(true);
    setGenerationPhase("generating");

    const destination = finalChoices.dest.trim() || "Đà Lạt";
    const travelWith =
      COMPANION_MAP[finalChoices.who] ?? TravelCompanionEnum.Solo;
    const style = STYLE_MAP[finalChoices.style] ?? TravalStyleEnum.Relax;
    const totalDays = Number(finalChoices.days) || 3;
    const budget = finalChoices.budget || "Trung bình";

    try {
      let aiDays: any[] = [];
      try {
        const aiRes: any = await itineraryService.generateTripPlan({
          destination,
          travelWith,
          style,
          budget,
          days: totalDays,
        });

        if (aiRes?.data?.itinerary && Array.isArray(aiRes.data.itinerary)) {
          aiDays = aiRes.data.itinerary;
        } else if (Array.isArray(aiRes?.data)) {
          aiDays = aiRes.data;
        }
      } catch (aiErr) {
        console.warn(
          "AI Trip Plan API request failed or returned error, using dynamic fallback:",
          aiErr,
        );
      }

      // Nếu AI API chưa trả về kết quả, truy vấn các địa điểm thực tế từ BE theo điểm đến
      let fallbackDays: any[] = [];
      if (aiDays.length === 0) {
        let destPlaces: {
          id: number;
          name: string;
          address: string;
          categoryName?: string;
        }[] = [];
        try {
          const locRes = await locationService.getAll({
            keyword: destination,
            pageIndex: 1,
            pageSize: Math.max(12, totalDays * 4),
          });
          if (Array.isArray(locRes?.data) && locRes.data.length > 0) {
            destPlaces = locRes.data;
          }
        } catch (locErr) {
          console.warn("Fetch destination locations error:", locErr);
        }

        if (destPlaces.length === 0 && places.length > 0) {
          destPlaces = places.map((p) => ({
            id: p.id,
            name: p.title,
            address: p.location,
            categoryName: p.tag,
          }));
        }

        const timeSlots = ["08:30", "11:30", "15:00", "19:00"];
        fallbackDays = Array.from({ length: totalDays }, (_, idx) => {
          const dayNum = idx + 1;
          const dayActivities = timeSlots.map((time, slotIdx) => {
            const pick =
              destPlaces.length > 0
                ? destPlaces[(idx * timeSlots.length + slotIdx) % destPlaces.length]
                : null;
            return {
              time,
              location: pick ? pick.name : destination,
              description: pick
                ? `${pick.categoryName || "Trải nghiệm"} tại ${pick.address || destination}`
                : `Khám phá ${destination}`,
              matchedLocationId: pick ? pick.id : null,
              isVerified: Boolean(pick),
            };
          });
          return {
            day: dayNum,
            title: `Ngày ${dayNum}: Khám phá ${destination}`,
            activities: dayActivities,
            items: dayActivities.map((act) => ({
              time: act.time,
              act: `${act.location} - ${act.description}`,
              type: act.isVerified ? "verified" : "explore",
            })),
          };
        });
      }

      // Convert AI response into UI TripDay format
      const mappedItinerary =
        aiDays.length > 0
          ? aiDays.map((d: any, idx: number) => ({
              day: d.day || idx + 1,
              title: `Ngày ${d.day || idx + 1}: Khám phá ${destination}`,
              activities: (d.activities || []).map((act: any) => ({
                time: act.time || "08:30",
                location: act.location || destination,
                description: act.description || "Tham quan và trải nghiệm",
                matchedLocationId: act.matchedLocationId || null,
                isVerified: !!act.isVerified,
              })),
              items: (d.activities || []).map((act: any) => ({
                time: act.time || "08:30",
                act: `${act.location ? act.location + " - " : ""}${act.description || "Tham quan điểm du lịch"}`,
                type: act.isVerified ? "verified" : "explore",
              })),
            }))
          : fallbackDays;

      // STEP 2: SCANNING PHASE - Short delay to scan for duplicates
      setGenerationPhase("scanning");
      await new Promise((resolve) => setTimeout(resolve, 1800));

      // Check if duplicate trip exists (matching destination name & duration)
      const cleanDest = destination
        .toLowerCase()
        .replace(/^(khám phá|lịch trình)\s*/i, "")
        .trim();
      const existingDupe = trips.find((t) => {
        const cleanTripLoc = (t.location || t.name)
          .toLowerCase()
          .replace(/^(khám phá|lịch trình)\s*/i, "")
          .trim();
        const isLocMatch =
          cleanTripLoc.includes(cleanDest) || cleanDest.includes(cleanTripLoc);
        const isDaysMatch = Number(t.days) === totalDays;
        return isLocMatch && isDaysMatch;
      });

      if (existingDupe) {
        // DUPLICATE DETECTED: Show alert dialog, don't automatically duplicate
        setIsGenerating(false);
        setGenerationPhase("idle");
        setDuplicateModalInfo({
          existingTrip: existingDupe,
          destination,
          totalDays,
          mappedItinerary,
        });
        showToast(
          "Phát hiện lịch trình tương tự đã tồn tại trong danh sách chuyến đi!",
          "warning",
        );
        return;
      }

      // NO DUPLICATE: Save normally
      await saveTripToStorage(
        `Khám phá ${destination} (${mappedItinerary.length}N)`,
        mappedItinerary,
        destination,
      );
      showToast(
        `Quét hoàn tất: Lịch trình độc nhất, đã tạo thành công!`,
        "success",
      );

      setTimeout(() => {
        setIsGenerating(false);
        setGenerationPhase("idle");
        navigate("/plan");
      }, 1000);
    } catch (error) {
      console.error("Plan generation failed:", error);
      setIsGenerating(false);
      setGenerationPhase("idle");
      showToast("Không thể tạo lịch trình, vui lòng thử lại!", "error");
      navigate("/plan");
    }
  };

  const handleOverwriteDuplicate = async () => {
    if (!duplicateModalInfo) return;
    const { existingTrip, mappedItinerary, destination } = duplicateModalInfo;
    const updatedName = `Khám phá ${destination} (${mappedItinerary.length}N - Đã cập nhật)`;
    updateTrip(existingTrip.id, {
      name: updatedName,
      itinerary: mappedItinerary,
      date: new Date().toLocaleDateString("vi-VN"),
      detailLoaded: true,
    });
    if (getAccessToken()) {
      try {
        const payload = buildItineraryPayload({
          title: updatedName,
          startDate: existingTrip.startDate,
          endDate: existingTrip.endDate,
          totalDays: mappedItinerary.length,
          isPublished: existingTrip.isPublished,
          days: mappedItinerary,
          places,
        });
        await itineraryService.update(existingTrip.id, payload);
        await refreshTrips();
      } catch (err) {
        console.warn("Update duplicate itinerary on BE error:", err);
      }
    }
    showToast(
      `Đã ghi đè & cập nhật mới lên chuyến đi '${existingTrip.name}'!`,
      "success",
    );
    setDuplicateModalInfo(null);
    navigate("/plan");
  };

  const handleCreateNewDuplicateCopy = async () => {
    if (!duplicateModalInfo) return;
    const { destination, mappedItinerary } = duplicateModalInfo;
    const newName = `Khám phá ${destination} (${mappedItinerary.length}N - Bản mới)`;
    await saveTripToStorage(newName, mappedItinerary, destination);
    showToast(`Đã lưu thêm bản sao mới cho chuyến đi!`, "success");
    setDuplicateModalInfo(null);
    navigate("/plan");
  };

  const handleViewExistingDuplicate = () => {
    setDuplicateModalInfo(null);
    navigate("/plan");
    showToast("Đang hiển thị lịch trình có sẵn của bạn.", "info");
  };

  const handleNextStep = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      executePlanGeneration(choices);
    }
  };

  const handleCustomDestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDest.trim()) return;
    setChoices((prev) => ({ ...prev, dest: customDest.trim() }));
    handleNextStep();
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="absolute inset-0 z-40 bg-white flex flex-col"
    >
      {/* Header with Safe Back Button */}
      <div className="pt-12 px-6 pb-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
        <button
          onClick={handleGoBack}
          className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-full flex items-center justify-center text-slate-600 active:scale-95 transition-all cursor-pointer"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].filter((i) => i > stepOffset).map((i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === step
                  ? "w-8 bg-indigo-600"
                  : i < step
                    ? "w-4 bg-indigo-300"
                    : "w-1.5 bg-slate-200",
              )}
            />
          ))}
        </div>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-6 flex flex-col justify-between">
        <AnimatePresence mode="wait">
          {!isGenerating ? (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col justify-between"
            >
              {/* STEP 1 */}
              {step === 1 && (
                <div>
                  <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider block mb-2">
                    Bước 1 / 4
                  </span>
                  <h2 className="text-2xl font-black text-slate-900 mb-2">
                    Bạn muốn đi đâu?
                  </h2>
                  <p className="text-slate-400 font-medium text-xs mb-6">
                    Chọn điểm đến phổ biến hoặc nhập địa điểm yêu thích của bạn.
                  </p>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {[
                      { name: "Đà Lạt, Lâm Đồng", tag: "Khí hậu mát mẻ" },
                      {
                        name: "Phú Quốc, Kiên Giang",
                        tag: "Biển đảo nhiệt đới",
                      },
                      { name: "Hà Giang", tag: "Cung đường hùng vĩ" },
                      { name: "Hội An, Quảng Nam", tag: "Di sản cổ kính" },
                      { name: "Nha Trang, Khánh Hòa", tag: "Thiên đường biển" },
                      {
                        name: "Sa Pa, Lào Cai",
                        tag: "Sương mù & ruộng bậc thang",
                      },
                    ].map((dest, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setChoices({ ...choices, dest: dest.name });
                          handleNextStep();
                        }}
                        className={cn(
                          "p-4 rounded-2xl border-2 text-left transition-all active:scale-95 cursor-pointer",
                          choices.dest === dest.name
                            ? "border-indigo-600 bg-indigo-50/30"
                            : "border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-200",
                        )}
                      >
                        <div className="font-bold text-slate-800 text-sm mb-1">
                          {dest.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium">
                          {dest.tag}
                        </div>
                      </button>
                    ))}
                  </div>

                  <form
                    onSubmit={handleCustomDestSubmit}
                    className="relative mt-2"
                  >
                    <input
                      type="text"
                      placeholder="Hoặc nhập địa điểm khác (Vd: Huế, Cần Thơ)..."
                      value={customDest}
                      onChange={(e) => setCustomDest(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 pr-12"
                    />
                    <button
                      type="submit"
                      className="absolute right-2 top-2 bottom-2 px-3 bg-indigo-600 text-white rounded-xl flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                    >
                      <ArrowRight size={14} />
                    </button>
                  </form>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full mb-3">
                    <Compass size={13} />
                    <span>Điểm đến: {choices.dest || "Đã chọn"}</span>
                  </div>

                  <h2 className="text-2xl font-black text-slate-900 mb-2">
                    Thời gian & Ngân sách dự kiến?
                  </h2>

                  {/* SỐ NGÀY CHUYẾN ĐI */}
                  <div className="mb-6 mt-4">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3 flex items-center gap-1.5">
                      <Clock size={14} /> Số ngày chuyến đi
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { days: 1, desc: "Đi về trong ngày" },
                        { days: 2, desc: "Cuối tuần" },
                        { days: 3, desc: "Tiêu chuẩn" },
                        { days: 4, desc: "Khám phá" },
                        { days: 5, desc: "Nghỉ dưỡng" },
                        { days: 7, desc: "Dài ngày" },
                      ].map((item) => (
                        <button
                          key={item.days}
                          type="button"
                          onClick={() =>
                            setChoices({ ...choices, days: item.days })
                          }
                          className={cn(
                            "p-3.5 rounded-2xl border-2 text-left transition-all active:scale-95 cursor-pointer",
                            choices.days === item.days
                              ? "border-indigo-600 bg-indigo-50/40 text-indigo-900 shadow-sm"
                              : "border-slate-100 bg-slate-50/50 hover:bg-white",
                          )}
                        >
                          <div className="font-bold text-sm leading-tight">
                            {item.days} ngày
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium mt-1">
                            {item.desc}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* MỨC CHI TIÊU MONG MUỐN */}
                  <div className="mb-6">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3 flex items-center gap-1.5">
                      <DollarSign size={14} /> Mức chi tiêu mong muốn
                    </label>
                    <div className="grid grid-cols-3 gap-2.5 mb-3">
                      {(["Tiết kiệm", "Trung bình", "Thoải mái"] as const).map(
                        (tier) => (
                          <button
                            key={tier}
                            type="button"
                            onClick={() => handleTierChange(tier)}
                            className={cn(
                              "py-3 px-2 rounded-2xl border-2 text-center text-xs font-bold transition-all active:scale-95 cursor-pointer",
                              budgetTier === tier
                                ? "border-indigo-600 bg-indigo-50/40 text-indigo-900 shadow-sm"
                                : "border-slate-100 bg-slate-50/50 text-slate-600 hover:bg-white",
                            )}
                          >
                            {tier}
                          </button>
                        ),
                      )}
                    </div>

                    {/* RANGE SLIDER BOX */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[11px] font-bold text-slate-600">
                          Hạn mức chi tiêu mỗi ngày:
                        </span>
                        <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                          {budgetValue.toLocaleString("vi-VN")} đ / ngày
                        </span>
                      </div>

                      <input
                        type="range"
                        min={getSliderBounds().min}
                        max={getSliderBounds().max}
                        step={getSliderBounds().step}
                        value={budgetValue}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setBudgetValue(val);
                          setChoices((prev) => ({
                            ...prev,
                            budget: `${budgetTier} (~${val.toLocaleString("vi-VN")}đ/ngày)`,
                          }));
                        }}
                        className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer my-2"
                      />

                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                        <span>
                          {getSliderBounds().min.toLocaleString("vi-VN")} đ
                        </span>
                        <span className="font-bold text-indigo-600">
                          Ước tính cả chuyến:{" "}
                          {(budgetValue * choices.days).toLocaleString("vi-VN")}{" "}
                          đ
                        </span>
                        <span>
                          {getSliderBounds().max.toLocaleString("vi-VN")} đ
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleNextStep}
                    className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20"
                  >
                    <span>Tiếp tục</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <div>
                  <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider block mb-2">
                    Bước {3 - stepOffset} / {4 - stepOffset}
                  </span>
                  <h2 className="text-2xl font-black text-slate-900 mb-2">
                    Bạn đồng hành cùng ai?
                  </h2>
                  <p className="text-slate-400 font-medium text-xs mb-6">
                    AI sẽ lựa chọn các địa điểm thích hợp cho thành phần đoàn.
                  </p>

                  <div className="space-y-3 mb-6">
                    {[
                      {
                        title: "Một mình",
                        icon: User,
                        desc: "Trải nghiệm tự do, khám phá cá nhân",
                      },
                      {
                        title: "Cặp đôi",
                        icon: Heart,
                        desc: "Lãng mạn, riêng tư, chụp ảnh kỷ niệm",
                      },
                      {
                        title: "Gia đình",
                        icon: Users,
                        desc: "Tiện nghi, an toàn cho trẻ nhỏ và người lớn tuổi",
                      },
                      {
                        title: "Nhóm bạn",
                        icon: Users,
                        desc: "Sôi động, trải nghiệm vui nhộn, ẩm thực đường phố",
                      },
                    ].map((opt, i) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            setChoices({ ...choices, who: opt.title });
                            handleNextStep();
                          }}
                          className={cn(
                            "w-full text-left p-4 rounded-2xl border-2 flex items-center gap-4 transition-all active:scale-[0.99] cursor-pointer",
                            choices.who === opt.title
                              ? "border-indigo-600 bg-indigo-50/30"
                              : "border-slate-100 bg-slate-50/50 hover:bg-white",
                          )}
                        >
                          <div
                            className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                              choices.who === opt.title
                                ? "bg-indigo-600 text-white"
                                : "bg-white text-slate-400 border border-slate-100",
                            )}
                          >
                            <Icon size={20} />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm">
                              {opt.title}
                            </div>
                            <div className="text-xs text-slate-400 font-medium mt-0.5">
                              {opt.desc}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 4 */}
              {step === 4 && (
                <div>
                  <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider block mb-2">
                    Bước {4 - stepOffset} / {4 - stepOffset}
                  </span>
                  <h2 className="text-2xl font-black text-slate-900 mb-2">
                    Phong cách chuyến đi bạn thích?
                  </h2>
                  <p className="text-slate-400 font-medium text-xs mb-6">
                    Chọn phong cách chủ đạo để AI sắp xếp lộ trình phù hợp.
                  </p>

                  <div className="space-y-3">
                    {[
                      {
                        title: "Nghỉ dưỡng & Thư giãn",
                        desc: "Spa, cà phê đẹp, thưởng thức ẩm thực, không vội vã",
                      },
                      {
                        title: "Khám phá Văn hóa",
                        desc: "Bảo tàng, di tích lịch sử, phố cổ, đời sống và phong tục địa phương",
                      },
                      {
                        title: "Thiên nhiên & Mạo hiểm",
                        desc: "Trekking, ngắm cảnh, cắm trại, trải nghiệm ngoài trời",
                      },
                    ].map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const updated = { ...choices, style: opt.title };
                          setChoices(updated);
                          executePlanGeneration(updated);
                        }}
                        className="w-full text-left p-5 rounded-2xl border-2 border-slate-100 hover:border-indigo-600 transition-all active:scale-[0.99] group bg-slate-50/40 hover:bg-white cursor-pointer shadow-sm"
                      >
                        <div className="font-bold text-slate-900 group-hover:text-indigo-600 mb-1">
                          {opt.title}
                        </div>
                        <div className="text-xs text-slate-500 font-medium">
                          {opt.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            /* DYNAMIC LOADING & DUPLICATE SCANNING SCREEN */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-white z-20"
            >
              {generationPhase === "generating" ? (
                <>
                  <div className="relative mb-8">
                    <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-30 rounded-full animate-pulse"></div>
                    <div className="w-24 h-24 bg-gradient-to-tr from-indigo-600 to-purple-500 rounded-full flex items-center justify-center text-white shadow-xl relative z-10 animate-bounce">
                      <Sparkles size={40} className="animate-spin-slow" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-3">
                    AI đang phân tích sở thích...
                  </h3>
                  <p className="text-slate-500 font-medium text-sm leading-relaxed max-w-[280px]">
                    Đang thiết kế lịch trình {choices.days} ngày tại{" "}
                    <strong>{choices.dest || "điểm đến"}</strong>...
                  </p>

                  <div className="mt-8 w-full max-w-[220px] h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "65%" }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full"
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* SCANNING PHASE FOR DUPLICATES */}
                  <div className="relative mb-8">
                    <div className="absolute inset-0 bg-amber-500 blur-xl opacity-35 rounded-full animate-ping"></div>
                    <div className="w-24 h-24 bg-gradient-to-tr from-amber-500 to-indigo-600 rounded-full flex items-center justify-center text-white shadow-xl relative z-10">
                      <Search size={38} className="animate-pulse" />
                    </div>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">
                    Đang quét lịch trình trùng lặp...
                  </h3>
                  <p className="text-slate-500 font-medium text-xs leading-relaxed max-w-[280px]">
                    Hệ thống đang đối chiếu dữ liệu với các chuyến đi hiện có
                    trong tài khoản của bạn để tránh tạo trùng...
                  </p>

                  <div className="mt-8 w-full max-w-[220px] h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: "65%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 1.8, ease: "easeInOut" }}
                      className="h-full bg-gradient-to-r from-amber-500 to-indigo-600 rounded-full"
                    />
                  </div>
                  <span className="text-[10px] text-indigo-600 font-bold mt-3 block">
                    Đang quét điểm đến & số ngày...
                  </span>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* DUPLICATE TRIP WARNING MODAL */}
      <AnimatePresence>
        {duplicateModalInfo && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDuplicateModalInfo(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 relative z-10 shadow-2xl text-left flex flex-col"
            >
              {/* Header */}
              <div className="flex items-start gap-3.5 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
                  <AlertTriangle size={24} />
                </div>
                <div className="flex-1">
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-block mb-1">
                    Cảnh báo trùng lặp
                  </span>
                  <h3 className="font-black text-slate-900 text-lg leading-tight">
                    Phát hiện lịch trình đã tồn tại!
                  </h3>
                </div>
                <button
                  onClick={() => setDuplicateModalInfo(null)}
                  className="p-1 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Duplicate Details */}
              <p className="text-xs text-slate-600 font-medium leading-relaxed mb-4">
                Bạn đã có một chuyến đi khám phá{" "}
                <strong>{duplicateModalInfo.destination}</strong> (
                {duplicateModalInfo.totalDays} ngày) trong danh sách chuyến đi
                của mình:
              </p>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 mb-5 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold">
                    Chuyến đi hiện có:
                  </span>
                  <span className="font-extrabold text-slate-900">
                    {duplicateModalInfo.existingTrip.name}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold">Thời gian:</span>
                  <span className="font-semibold text-slate-700">
                    {duplicateModalInfo.existingTrip.days} ngày
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold">
                    Lịch trình mới tạo:
                  </span>
                  <span className="font-extrabold text-indigo-600">
                    Khám phá {duplicateModalInfo.destination} (
                    {duplicateModalInfo.totalDays} ngày)
                  </span>
                </div>
              </div>

              {/* Action Options */}
              <div className="space-y-2.5">
                <button
                  onClick={handleViewExistingDuplicate}
                  className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-2xl text-xs active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-slate-900/10"
                >
                  <Eye size={15} />
                  <span>Xem chuyến đi đã có sẵn</span>
                </button>

                <button
                  onClick={handleOverwriteDuplicate}
                  className="w-full py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-2xl text-xs active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-indigo-200"
                >
                  <RefreshCw size={15} />
                  <span>Ghi đè & Cập nhật mới (Không tạo thêm)</span>
                </button>

                <button
                  onClick={handleCreateNewDuplicateCopy}
                  className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-2xl text-xs active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
                >
                  <Copy size={15} />
                  <span>Vẫn tạo thêm bản mới (Đổi tên phân biệt)</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
