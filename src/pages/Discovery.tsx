import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Sparkles, MapPin, Star, Search, Clock, ShieldCheck, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppContext } from '../context/AppContext';
import { cn } from '../App';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { locationService } from '../services/location/locationApi';
import { reviewService } from '../services/review/reviewApi';
import type { ReviewStatsDto } from '../services/review/reviewType';

function RescueCountdown({ expiryDate }: { expiryDate: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calculateTime = () => {
      const diff = new Date(expiryDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Đã hết hạn");
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      
      setTimeLeft(`${days}n ${hours}g ${minutes}p ${seconds}s`);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [expiryDate]);

  return (
    <span className="text-[10.5px] font-black text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
      <Clock size={11} className="animate-pulse" />
      Còn: {timeLeft}
    </span>
  );
}

function removeVietnameseTones(str: string) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export default function Discovery() {
  const { places, rescuePicks, categories, upsertServerPlaces } = useAppContext();
  const [activeCategory, setActiveCategory] = useState("Tất cả");
  const [search, setSearch] = useState("");
  const [lotwStats, setLotwStats] = useState<ReviewStatsDto | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const categoryList = useMemo(
    () => ["Tất cả", ...categories.map((c) => c.name)],
    [categories],
  );

  // Tìm kiếm, lọc danh mục & làm mới ngầm (Stale-While-Revalidate) khi quay về trang Khám phá
  useEffect(() => {
    if (location.pathname !== "/") return;
    const keyword = search.trim();
    const selectedCat = categories.find((c) => c.name === activeCategory);

    const timer = setTimeout(() => {
      locationService
        .getAll({
          keyword: keyword || undefined,
          categoryId: selectedCat?.id,
          pageIndex: 1,
          pageSize: 50,
        })
        .then((res) => {
          if (!Array.isArray(res?.data)) return;
          const gradients = [
            "bg-gradient-nature",
            "bg-gradient-sunset",
            "bg-gradient-ocean",
            "bg-gradient-berry",
            "bg-gradient-lavender",
            "bg-gradient-mint",
          ];
          upsertServerPlaces(
            res.data.map((item) => ({
              id: item.id,
              title: item.name,
              tag: item.categoryName || "Địa điểm",
              rating: item.averageRating ?? 0,
              reviewsCount: item.reviewCount ?? 0,
              imageClass: gradients[item.id % gradients.length],
              location: item.address,
              description: "",
              reasons: [],
              price: "Liên hệ",
              lat: item.latitude ?? undefined,
              lon: item.longitude ?? undefined,
              categoryId: item.categoryId,
              categoryName: item.categoryName,
            })),
          );
        })
        .catch((err) => console.warn("Search places API error:", err));
    }, keyword ? 300 : 0);

    return () => clearTimeout(timer);
  }, [search, activeCategory, categories, location.pathname]);

  const featuredPlace = useMemo(() => {
    if (places.length === 0) return null;
    return [...places].sort(
      (a, b) =>
        b.rating * Math.max(1, Number(b.reviewsCount) || 1) -
        a.rating * Math.max(1, Number(a.reviewsCount) || 1),
    )[0];
  }, [places]);

  useEffect(() => {
    if (!featuredPlace?.id || location.pathname !== "/") return;
    reviewService
      .getStats(featuredPlace.id)
      .then((res) => {
        if (res?.data) setLotwStats(res.data);
      })
      .catch(() => setLotwStats(null));
  }, [featuredPlace?.id, location.pathname]);

  const lotwGrowthData = useMemo(() => {
    const base = Math.max(
      1,
      lotwStats?.totalCount ?? (Number(featuredPlace?.reviewsCount) || 1),
    );
    return [
      { name: "T1", visits: Math.max(1, Math.round(base * 0.4)) },
      { name: "T2", visits: Math.max(1, Math.round(base * 0.6)) },
      { name: "T3", visits: Math.max(1, Math.round(base * 0.8)) },
      { name: "T4", visits: base },
    ];
  }, [lotwStats, featuredPlace]);

  const positiveRate = useMemo(() => {
    const avg = lotwStats?.averageRating ?? featuredPlace?.rating ?? 0;
    return avg > 0 ? `${Math.round((avg / 5) * 100)}%` : "Mới";
  }, [lotwStats, featuredPlace]);

  const displayHiddenGems = useMemo(() => {
    const approved = (rescuePicks || []).filter((p) => p.status === "approved");
    if (approved.length > 0) return approved;
    return places
      .filter((p) => p.rating >= 4.0 && Number(p.reviewsCount || 0) <= 25)
      .slice(0, 6)
      .map((p) => ({
        id: p.id,
        title: p.title,
        tag: p.tag,
        description: p.description || `Điểm đến bản địa tại ${p.location}`,
        reasons:
          p.reasons && p.reasons.length > 0
            ? p.reasons
            : [`Đánh giá ${p.rating}★`, p.tag],
        imageClass: p.imageClass,
        location: p.location,
        rating: p.rating,
        reviewsCount: Number(p.reviewsCount) || 0,
        price: p.price,
        trustScore: p.trustScore ?? 90,
        lat: p.lat ?? 0,
        lon: p.lon ?? 0,
        status: "approved" as const,
        dateAdded: p.createdAt || new Date().toISOString(),
        expiryDate: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
      }));
  }, [rescuePicks, places]);

  const filteredPlaces = places.filter(p => {
    const rawSearch = search.trim();
    const matchesSearch = !rawSearch || 
      removeVietnameseTones(p.title).includes(removeVietnameseTones(rawSearch)) ||
      removeVietnameseTones(p.tag).includes(removeVietnameseTones(rawSearch)) ||
      removeVietnameseTones(p.location).includes(removeVietnameseTones(rawSearch));
    const matchesCat = activeCategory === "Tất cả" || 
      removeVietnameseTones(p.tag).includes(removeVietnameseTones(activeCategory));
    return matchesSearch && matchesCat;
  });

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="h-full overflow-y-auto no-scrollbar pb-32 bg-white"
    >
      <div className="relative pt-[max(3rem,env(safe-area-inset-top,24px))] pb-6 px-5">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-[32px] font-black text-slate-900 tracking-tight">Khám phá</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Trải nghiệm thiết kế riêng cho bạn</p>
          </div>
          <div 
            onClick={() => navigate('/profile')}
            className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-slate-100 shadow-sm relative cursor-pointer hover:shadow-md transition-all">
            <User className="text-slate-600" size={22} />
            <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-indigo-500 border-2 border-white rounded-full"></div>
          </div>
        </header>

        {/* Search Bar */}
        <div className="relative mb-8">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search size={18} className="text-slate-400" />
          </div>
          <input 
            type="text" 
            placeholder="Tìm kiếm điểm đến, nhà hàng, khách sạn..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-[20px] shadow-soft focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-semibold transition-all placeholder:font-medium"
          />
        </div>

        {/* Phase 2: Location of the Week (LOTW) (FR-31) */}
        {search === "" && featuredPlace && (
          <div 
            onClick={() => navigate(`/place/${featuredPlace.id}`)}
            className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-[32px] p-6 mb-8 border border-indigo-700/50 shadow-xl overflow-hidden relative text-left cursor-pointer group hover:shadow-2xl transition-all"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="flex justify-between items-start mb-4">
              <span className="bg-indigo-600/50 border border-indigo-400/40 text-indigo-100 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                <Sparkles size={12} className="text-yellow-400" />
                Điểm đến thịnh hành trong tuần
              </span>
              
              <div className="bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 text-[9.5px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg flex items-center gap-1">
                <ShieldCheck size={12} />
                Được cộng đồng đánh giá cao
              </div>
            </div>

            <div className="flex gap-4 items-center mb-5">
              <div className={cn("w-16 h-16 rounded-2xl shrink-0 shadow-inner border border-white/10", featuredPlace.imageClass)} />
              <div>
                <h3 className="text-xl font-black text-white leading-tight">{featuredPlace.title}</h3>
                <p className="text-xs text-indigo-300 font-bold mt-1 flex items-center gap-1">
                  <MapPin size={12} /> {featuredPlace.location}
                </p>
              </div>
              <div className="ml-auto text-right">
                <div className="flex items-center justify-end text-yellow-400 font-black text-sm gap-1">
                  {lotwStats?.averageRating ?? featuredPlace.rating} <Star size={14} className="fill-yellow-400" />
                </div>
                <p className="text-[10px] text-slate-400 font-bold mt-1">{lotwStats?.totalCount ?? featuredPlace.reviewsCount} đánh giá</p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="text-left shrink-0">
                <div className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider">Tỷ lệ đánh giá tích cực</div>
                <div className="text-2xl font-black text-emerald-400 mt-1 flex items-center gap-1">
                  <TrendingUp size={22} />
                  {positiveRate}
                </div>
                <p className="text-[9px] text-slate-400 font-medium mt-1">Dựa trên đánh giá và tương tác thực tế từ du khách</p>
              </div>
              
              <div className="w-full md:w-36 h-12 min-w-[120px] min-h-[48px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={48}>
                  <AreaChart data={lotwGrowthData}>
                    <defs>
                      <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.2}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="visits" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorVisits)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Phase 2: Hidden Gems (Quán quen bản địa & Trải nghiệm ít người biết) */}
        {search === "" && displayHiddenGems.length > 0 && (
          <div className="mb-8 text-left">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-black text-slate-900 text-xl tracking-tight flex items-center gap-2">
                  <span className="text-rose-500 animate-pulse">❤️</span> Quán quen bản địa (Hidden Gems)
                </h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">Những điểm đến chất lượng mộc mạc và giàu bản sắc văn hóa địa phương</p>
              </div>
              <span className="bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg">
                Gợi ý: {displayHiddenGems.length} quán
              </span>
            </div>

            <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-6 px-6 py-2">
              {displayHiddenGems.map(pick => (
                  <div 
                    key={pick.id}
                    onClick={() => {
                      navigate(`/place/${pick.id}`);
                    }}
                    className="w-[280px] bg-slate-50 border border-slate-100 rounded-[28px] p-4 flex-shrink-0 cursor-pointer shadow-soft hover:border-rose-100 transition-all hover:shadow-md text-left"
                  >
                    <div className={cn("w-full h-32 rounded-[20px] mb-3 relative overflow-hidden", pick.imageClass)}>
                      <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                        <Star size={10} className="text-yellow-500 fill-yellow-500" />
                        <span className="text-[10px] font-black">{pick.rating}</span>
                      </div>
                      
                      {/* Countdown Timer */}
                      <div className="absolute bottom-2 right-2">
                        <RescueCountdown expiryDate={pick.expiryDate} />
                      </div>
                    </div>

                    <div className="text-[9px] uppercase font-black text-rose-500 tracking-wider mb-1">{pick.tag}</div>
                    <h4 className="font-extrabold text-slate-900 text-sm leading-tight mb-1 truncate">{pick.title}</h4>
                    <div className="text-[10px] text-slate-400 font-bold mb-2">{pick.location}</div>
                    
                    <div className="bg-rose-50/40 border border-rose-100/30 rounded-xl p-2 mb-3">
                      <p className="text-[10.5px] text-slate-600 font-semibold leading-relaxed line-clamp-2">
                        {pick.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {pick.reasons.slice(0, 2).map((r, i) => (
                        <span key={i} className="bg-white border border-slate-100 text-slate-500 text-[8.5px] font-bold px-2 py-0.5 rounded-md truncate max-w-[240px]">
                          🛡️ {r}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-8 -mx-6 px-6">
          {categoryList.map(cat => (
            <button 
              key={cat} 
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300",
                activeCategory === cat 
                  ? "bg-slate-900 text-white shadow-soft" 
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Recommendations */}
        <div>
          <div className="flex justify-between items-end mb-5">
            <h3 className="font-bold text-slate-900 text-xl tracking-tight">
              {search ? 'Kết quả tìm kiếm' : 'Gợi ý cho bạn'}
            </h3>
          </div>
          
          <div className="flex flex-col gap-5">
            {filteredPlaces.length === 0 && (
               <div className="text-center py-10 text-slate-500 font-medium text-sm">Không tìm thấy địa điểm nào.</div>
            )}
            {filteredPlaces.map((item, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={item.id} 
                onClick={() => navigate(`/place/${item.id}`)}
                className="bg-white rounded-[28px] p-2 pr-4 shadow-soft border border-slate-100 flex gap-4 group cursor-pointer hover:border-indigo-100 transition-all hover:shadow-md"
              >
                <div className={cn("w-28 h-36 rounded-[22px] flex-shrink-0 relative overflow-hidden", item.imageClass)}>
                  <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1">
                    <Star size={10} className="text-yellow-500 fill-yellow-500" />
                    <span className="text-[10px] font-bold">{item.rating}</span>
                  </div>
                </div>
                
                <div className="py-2 flex flex-col justify-center flex-1 overflow-hidden">
                  <div className="text-[10px] uppercase font-bold text-indigo-500 tracking-wider mb-1 truncate">{item.tag}</div>
                  <h4 className="font-bold text-slate-900 text-base leading-tight mb-1 group-hover:text-indigo-600 transition-colors truncate">{item.title}</h4>
                  <div className="text-xs text-slate-500 font-medium mb-3">{item.reviewsCount} đánh giá</div>
                  
                  <div className="space-y-1.5">
                    {item.reasons.slice(0, 2).map((reason, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0" />
                        <span className="truncate">{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
