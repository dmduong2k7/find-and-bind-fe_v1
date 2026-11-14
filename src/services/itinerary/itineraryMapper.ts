import type { Place, TripActivity, TripDay } from '@/context/AppContext';
import type { CreateItineraryDto, ItineraryActivityDto } from './itineraryType';

/** "08:30:00" | "08:30" | null -> "08:30" */
export function toHHmm(value?: string | null, fallback = '08:00'): string {
  if (!value) return fallback;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return fallback;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

/**
 * BE trả danh sách phẳng `details` (có dayIndex + sortOrder).
 * Hàm này gom theo ngày để UI (TripDay[]) dùng được.
 */
export function mapDetailsToItinerary(details: ItineraryActivityDto[] = []): TripDay[] {
  const byDay = new Map<number, TripActivity[]>();

  [...details]
    .sort((a, b) => a.dayIndex - b.dayIndex || (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .forEach((d) => {
      const list = byDay.get(d.dayIndex) ?? [];
      list.push({
        time: toHHmm(d.plannedTime),
        location: d.locationName,
        description: d.notes ?? '',
        matchedLocationId: d.locationId ?? null,
        isVerified: d.isVerified ?? d.locationId != null,
      });
      byDay.set(d.dayIndex, list);
    });

  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, activities]) => ({
      day,
      title: `Ngày ${day}`,
      activities,
      items: activities.map((a) => ({
        time: a.time,
        act: a.description ? `${a.location} - ${a.description}` : a.location,
        type: a.isVerified ? 'verified' : 'explore',
      })),
    }));
}

export function buildItineraryPayload(params: {
  title: string;
  startDate?: string;
  endDate?: string;
  totalDays?: number;
  isPublished?: boolean;
  days?: TripDay[];
  places?: Place[];
}): CreateItineraryDto {
  const days = params.days ?? [];
  const totalDays = params.totalDays || days.length || 1;
  const start = params.startDate || new Date().toISOString();
  const end =
    params.endDate ||
    new Date(new Date(start).getTime() + totalDays * 24 * 3600 * 1000).toISOString();

  return {
    title: params.title,
    startDate: start,
    endDate: end,
    coverImageUrl: null,
    itinerary: days.map((d) => {
      const rawActivities =
        d.activities && d.activities.length > 0
          ? d.activities
          : (d.items || []).map((it) => ({
              time: it.time,
              location: it.act.split(' - ')[0] || it.act,
              description: it.act.split(' - ')[1] || it.act,
              matchedLocationId: null,
              isVerified: it.type === 'verified',
            }));

      return {
        day: d.day,
        activities: rawActivities.map((act) => {
          const matched =
            act.matchedLocationId ??
            params.places?.find(
              (p) => p.title.toLowerCase() === (act.location || '').toLowerCase(),
            )?.id ??
            null;
          return {
            time: toHHmm(act.time),
            location: act.location || params.title,
            description: act.description || '',
            matchedLocationId: matched,
            isVerified: Boolean(act.isVerified || matched != null),
          };
        }),
      };
    }),
  };
}