/**
 * iCalendar (.ics) Export Engine for 28 Lunar Mansions (Manāzil al-Qamar)
 * Generates RFC 5545 compliant calendar data for Google Calendar, Apple Calendar,
 * Microsoft Outlook, and standard calendar applications.
 *
 * Grounded in Zij as-Sindhind & Qasida fi 'Ilm an-Nujum.
 */

import { calculateSindhindPositions, ZODIAC_SIGNS } from './sindhindEngine';
import {
  calculateActiveManzil,
  ACTIVITY_CATEGORIES,
  ActivityCategoryKey,
} from './manzilCalculatorEngine';
import { DetailedManzil } from '../data/manzilDetailedData';
import { jdnToGregorian, jdnToHijri } from './calendarConverter';

export type IcsRangeSpan = 7 | 14 | 28 | 30 | 60;
export type IcsDirection = 'forward' | 'centered' | 'backward';

export interface ManzilIcsExportOptions {
  startJdn: number;
  daysCount: IcsRangeSpan;
  direction?: IcsDirection; // default 'forward' (starting from current date)
  categoryFilter?: ActivityCategoryKey; // 'all' or specific category
  includeAlarm?: boolean; // default true
  includeVerses?: boolean; // default true
  includeHijri?: boolean; // default true
  latitude?: number;
  longitude?: number;
  calendarName?: string;
}

export interface ManzilCalendarDayEvent {
  dayIndex: number;
  dayOffset: number;
  jdn: number;
  startDateStr: string; // YYYYMMDD
  endDateStr: string; // YYYYMMDD
  gregorianFormatted: string; // e.g. "23 Sep 2026"
  hijriFormatted: string; // e.g. "11 Rabi' al-Awwal 1448 H"
  mansion: DetailedManzil;
  fortuneLabel: string;
  signNameLatin: string;
  signNameArabic: string;
  signDegree: number;
  signMinute: number;
  dynamicMuhibbahScore: number;
  recommendedActions: string[];
  avoidedActions: string[];
  summary: string;
  description: string;
}

const GREG_MONTHS_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/**
 * Escapes characters according to RFC 5545
 */
export function escapeIcsText(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Maps fortune to clean Indonesian title prefix
 */
function getFortuneLabel(fortune: string): string {
  switch (fortune) {
    case "Sa'd Mahd":
      return "Sa'd Maḥḍ (Sangat Beruntung)";
    case "Sa'd":
      return "Sa'd (Beruntung)";
    case 'Muntasif':
      return 'Muntaṣif (Netral)';
    case 'Nahs':
      return 'Naḥs (Perlu Waspada)';
    case 'Nahs Mahd':
      return 'Naḥs Maḥḍ (Sangat Kritis)';
    default:
      return fortune;
  }
}

/**
 * Calculates events data for preview and generation
 */
export function generateManzilEventsData(options: ManzilIcsExportOptions): ManzilCalendarDayEvent[] {
  const {
    startJdn,
    daysCount,
    direction = 'forward',
    categoryFilter = 'all',
    includeVerses = true,
    includeHijri = true,
    latitude = 33.3152,
    longitude = 44.3661,
  } = options;

  const events: ManzilCalendarDayEvent[] = [];

  for (let i = 0; i < daysCount; i++) {
    let dayOffset = i;
    if (direction === 'backward') {
      dayOffset = -(daysCount - 1 - i);
    } else if (direction === 'centered') {
      dayOffset = i - Math.floor(daysCount / 2);
    }

    const dayJdn = startJdn + dayOffset;
    const greg = jdnToGregorian(dayJdn);
    const nextGreg = jdnToGregorian(dayJdn + 1);
    const hijri = jdnToHijri(dayJdn);

    const positionsResult = calculateSindhindPositions(dayJdn, latitude, longitude);
    const moonPos = positionsResult.positions.moon;
    const analysis = calculateActiveManzil(moonPos, positionsResult.positions, positionsResult.aspects);
    const mansion = analysis.mansion;

    // Filter by affinity category if requested
    const matchesCategory =
      categoryFilter === 'all' ||
      mansion.primaryAffinities.includes(categoryFilter as any);

    const startYear = greg.year;
    const startMonth = String(greg.month).padStart(2, '0');
    const startDay = String(greg.day).padStart(2, '0');
    const startDateStr = `${startYear}${startMonth}${startDay}`;

    const endYear = nextGreg.year;
    const endMonth = String(nextGreg.month).padStart(2, '0');
    const endDay = String(nextGreg.day).padStart(2, '0');
    const endDateStr = `${endYear}${endMonth}${endDay}`;

    const monthName = GREG_MONTHS_NAMES[greg.month - 1] || `${greg.month}`;
    const gregorianFormatted = `${greg.day} ${monthName} ${greg.year}`;
    const hijriFormatted = `${hijri.day} ${hijri.monthNameLatin} ${hijri.year} H`;

    const signIdx = moonPos.coordinate?.signIndex ?? Math.floor(moonPos.trueLongitude / 30);
    const sign = ZODIAC_SIGNS[signIdx % 12];
    const signDegree = moonPos.coordinate?.signDegree ?? Math.floor(moonPos.trueLongitude % 30);
    const signMinute = moonPos.coordinate?.minutes ?? Math.floor(((moonPos.trueLongitude % 30) - signDegree) * 60);

    const fortuneLabel = getFortuneLabel(mansion.fortune);

    // Build human-friendly summary
    const affinityLabels = mansion.primaryAffinities
      .map((aff) => {
        const cat = ACTIVITY_CATEGORIES.find((c) => c.key === aff);
        return cat ? cat.label.split(' ')[0] : aff;
      })
      .slice(0, 2)
      .join(' & ');

    const categoryBadge = matchesCategory && categoryFilter !== 'all' ? ` [FOKUS]` : '';
    const summary = `[Manzil #${mansion.number} ${mansion.transliteration}] ${mansion.fortune} - ${affinityLabels} | Bulan di ${sign?.arabicName || 'الحمل'}${categoryBadge}`;

    // Build structured description
    const descLines: string[] = [];
    descLines.push(`══════════════════════════════════════════`);
    descLines.push(`MANZIL AL-QAMAR #${mansion.number}: ${mansion.transliteration.toUpperCase()} (${mansion.arabicName})`);
    descLines.push(`Makna: "${mansion.meaningId}"`);
    descLines.push(`══════════════════════════════════════════`);
    descLines.push(`📅 Penanggalan: ${gregorianFormatted} M`);
    if (includeHijri) {
      descLines.push(`🌙 Kalender Hijriah: ${hijriFormatted}`);
    }
    descLines.push(`🪐 Posisi Bulan: ${sign?.latinName || 'Aries'} (${sign?.arabicName || 'الحمل'}) ${signDegree}° ${signMinute}'`);
    descLines.push(`⭐ Gugus Bintang: ${mansion.starGroup} (${mansion.constellation})`);
    descLines.push(`✨ Derajat Keberuntungan: ${fortuneLabel}`);
    descLines.push(`🔥 Anasir & Tabi'at: ${mansion.elementLabel} • ${mansion.temperamentLabel}`);
    descLines.push(`💖 Sifat Muhibbah: ${mansion.muhibbahNature} (Skor: ${analysis.dynamicMuhibbahScore}/100)`);
    descLines.push(`🎯 Bidang Afinitas: ${mansion.primaryAffinities.join(', ')}`);
    descLines.push(``);
    descLines.push(`✅ AKTIVITAS SANGAT DIANJURKAN (AL-MUSTAHABB):`);
    mansion.recommendedActions.forEach((act) => {
      descLines.push(`  • ${act}`);
    });
    descLines.push(``);
    descLines.push(`⚠️ AKTIVITAS YANG HARUS DIHINDARI (AL-MAKRUH):`);
    mansion.avoidedActions.forEach((act) => {
      descLines.push(`  • ${act}`);
    });

    if (includeVerses) {
      descLines.push(``);
      descLines.push(`📜 BAIT SYAIR KLASIK (QASIDA FI 'ILM AN-NUJUM):`);
      descLines.push(`"${mansion.classicalVerseArabic}"`);
      descLines.push(`Artinya: ${mansion.classicalVerseTranslation}`);
    }

    descLines.push(``);
    descLines.push(`📖 Catatan Naskah: ${mansion.classicalCommentary}`);
    descLines.push(``);
    descLines.push(`─── Disarikan dari Zij as-Sindhind & Manāzil al-Qamar ───`);

    events.push({
      dayIndex: i,
      dayOffset,
      jdn: dayJdn,
      startDateStr,
      endDateStr,
      gregorianFormatted,
      hijriFormatted,
      mansion,
      fortuneLabel,
      signNameLatin: sign?.latinName || 'Aries',
      signNameArabic: sign?.arabicName || 'الحمل',
      signDegree,
      signMinute,
      dynamicMuhibbahScore: analysis.dynamicMuhibbahScore,
      recommendedActions: mansion.recommendedActions,
      avoidedActions: mansion.avoidedActions,
      summary,
      description: descLines.join('\n'),
    });
  }

  return events;
}

/**
 * Generates raw RFC 5545 .ics calendar content string
 */
export function generateManzilIcsString(options: ManzilIcsExportOptions): string {
  const events = generateManzilEventsData(options);
  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const calName = options.calendarName || 'Jadwal 28 Manzil & Ikhtiyarat Falak';
  const calDesc = 'Jadwal transit Bulan di 28 Manzil dan rekomendasi aktivitas harian klasik (Al-Ikhtiyarat) berdasar naskah Zij as-Sindhind';

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zij as-Sindhind//Manzil Calculator//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calName)}`,
    `X-WR-CALDESC:${escapeIcsText(calDesc)}`,
    'X-WR-TIMEZONE:UTC',
  ];

  events.forEach((ev) => {
    const uid = `manzil-${ev.mansion.number}-${ev.startDateStr}-${Math.random().toString(36).substring(2, 9)}@zij-sindhind`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${ev.startDateStr}`);
    lines.push(`DTEND;VALUE=DATE:${ev.endDateStr}`);
    lines.push(`SUMMARY:${escapeIcsText(ev.summary)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
    lines.push('CATEGORIES:MANZIL,IKHTIYARAT,FALAK,ASTROLOGI ISLAM');
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:TRANSPARENT'); // Doesn't block user's busy availability

    // Optional Alarm: 07:00 AM on the day of event
    if (options.includeAlarm !== false) {
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:${escapeIcsText(`Manzil Hari Ini: #${ev.mansion.number} ${ev.mansion.transliteration} (${ev.mansion.fortune})`)}`);
      lines.push('TRIGGER:-P0DT0H0M0S'); // Triggers at start of the day
      lines.push('END:VALARM');
    }

    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Triggers a browser download of the generated .ics file
 */
export function downloadIcsFile(filename: string, icsContent: string): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Copies the raw iCal content to the clipboard
 */
export async function copyIcsToClipboard(icsContent: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(icsContent);
      return true;
    }
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = icsContent;
    textarea.style.position = 'fixed';
    textarea.style.left = '-999999px';
    document.body.appendChild(textarea);
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  } catch (err) {
    console.error('Failed to copy iCal string:', err);
    return false;
  }
}
