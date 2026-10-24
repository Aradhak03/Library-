/**
 * Utilities for time string conversions, 12-hour formatting,
 * and overnight-aware interval overlap detection.
 */

export function timeStringToMinutes(timeStr: string | null): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

export function formatTime12Hour(timeStr: string | null): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  let hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 hour is 12 AM
  const minutesFormatted = minutes < 10 ? `0${minutes}` : minutes;
  return `${hours}:${minutesFormatted} ${ampm}`;
}

export interface TimeSegment {
  startMin: number;
  endMin: number;
  startPercent: number;
  widthPercent: number;
}

/**
 * Returns 1 or 2 visual segments across a 24-hour bar (1440 mins).
 * Handles overnight slots (e.g. 21:00 to 05:00) by creating two segments:
 * 1) 21:00 -> 24:00
 * 2) 00:00 -> 05:00
 */
export function getBookingSegments(
  startTimeStr: string | null,
  endTimeStr: string | null,
  is24Hour: boolean
): TimeSegment[] {
  if (is24Hour) {
    return [
      {
        startMin: 0,
        endMin: 1440,
        startPercent: 0,
        widthPercent: 100,
      },
    ];
  }

  if (!startTimeStr || !endTimeStr) return [];

  const startMin = timeStringToMinutes(startTimeStr);
  const endMin = timeStringToMinutes(endTimeStr);

  // Normal slot: start < end (e.g. 08:00 to 14:00)
  if (startMin < endMin) {
    const width = endMin - startMin;
    return [
      {
        startMin,
        endMin,
        startPercent: (startMin / 1440) * 100,
        widthPercent: (width / 1440) * 100,
      },
    ];
  }

  // Overnight slot: end <= start (e.g. 22:00 to 06:00)
  const seg1Width = 1440 - startMin;
  const seg2Width = endMin;

  return [
    {
      startMin,
      endMin: 1440,
      startPercent: (startMin / 1440) * 100,
      widthPercent: (seg1Width / 1440) * 100,
    },
    {
      startMin: 0,
      endMin,
      startPercent: 0,
      widthPercent: (seg2Width / 1440) * 100,
    },
  ];
}

/**
 * Checks whether two time slots overlap, correctly handling overnight hours.
 */
export function checkTimesOverlap(
  start1: string | null,
  end1: string | null,
  start2: string | null,
  end2: string | null
): boolean {
  if (!start1 || !end1 || !start2 || !end2) return false;

  const s1 = timeStringToMinutes(start1);
  const e1 = timeStringToMinutes(end1);
  const s2 = timeStringToMinutes(start2);
  const e2 = timeStringToMinutes(end2);

  const getIntervals = (start: number, end: number): Array<[number, number]> => {
    if (end <= start) {
      // Overnight (e.g. 22:00 - 06:00 -> 22:00 - 24:00 and 00:00 - 06:00)
      return [
        [start, 1440],
        [0, end],
      ];
    }
    return [[start, end]];
  };

  const intervals1 = getIntervals(s1, e1);
  const intervals2 = getIntervals(s2, e2);

  for (const [startA, endA] of intervals1) {
    for (const [startB, endB] of intervals2) {
      if (startA < endB && startB < endA) {
        return true;
      }
    }
  }

  return false;
}
