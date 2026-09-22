import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { ThemeMode, HistoricalDateInfo, PlanetaryPosition, PlanetKey } from '../types';
import {
  ObserverLocation,
  HISTORICAL_OBSERVATORIES,
  SkyDomeData,
  computeSkyDomeData,
  ProjectedStar,
  ProjectedManzil,
  ProjectedPlanet,
} from '../lib/starMapEngine';
import { LUNAR_MANSIONS } from '../lib/sindhindEngine';
import {
  Compass,
  MapPin,
  Eye,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  BookmarkPlus,
  Navigation,
  Info,
  ChevronRight,
  Sun,
  Moon,
  Crosshair,
  SlidersHorizontal,
  Check,
  Globe2,
} from 'lucide-react';

interface StarMapViewProps {
  currentDateInfo: HistoricalDateInfo;
  positions: Record<PlanetKey, PlanetaryPosition>;
  theme: ThemeMode;
  onAnnotateStar?: (title: string, content: string) => void;
  onLocationChange?: (lat: number, lon: number, locationName: string) => void;
}

export const StarMapView: React.FC<StarMapViewProps> = ({
  currentDateInfo,
  positions,
  theme,
  onAnnotateStar,
  onLocationChange,
}) => {
  const isNight = theme === 'night';
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Observer Location State (Default: Baghdad)
  const [selectedObserver, setSelectedObserver] = useState<ObserverLocation>(
    HISTORICAL_OBSERVATORIES[0]
  );
  const [customLat, setCustomLat] = useState<number>(selectedObserver.latitude);
  const [customLon, setCustomLon] = useState<number>(selectedObserver.longitude);
  const [isCustomLocOpen, setIsCustomLocOpen] = useState<boolean>(false);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);

  // Layer toggles
  const [showManzils, setShowManzils] = useState<boolean>(true);
  const [showStars, setShowStars] = useState<boolean>(true);
  const [showPlanets, setShowPlanets] = useState<boolean>(true);
  const [showAlmucantars, setShowAlmucantars] = useState<boolean>(true);
  const [showEcliptic, setShowEcliptic] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [filterVisibleOnly, setFilterVisibleOnly] = useState<boolean>(true);

  // Inspector state
  const [selectedObject, setSelectedObject] = useState<{
    type: 'star' | 'manzil' | 'planet';
    data: ProjectedStar | ProjectedManzil | ProjectedPlanet;
  } | null>(null);

  // Canvas dimensions
  const width = 640;
  const height = 640;
  const radius = 260; // Horizon radius in SVG units

  // Compute sky dome coordinates based on date, observer, and Sindhind positions
  const skyData: SkyDomeData = useMemo(() => {
    return computeSkyDomeData(currentDateInfo.jdn, selectedObserver, positions, radius);
  }, [currentDateInfo.jdn, selectedObserver, positions]);

  // Handle GPS detection
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      setGeoStatus('Peramban tidak mendukung geolokasi');
      return;
    }
    setGeoStatus('Mendeteksi koordinat GPS...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(4));
        const lon = parseFloat(pos.coords.longitude.toFixed(4));
        const newLoc: ObserverLocation = {
          id: 'user_gps',
          name: `Lokasi Pengguna (${lat > 0 ? `${lat}°U` : `${Math.abs(lat)}°S`}, ${lon > 0 ? `${lon}°T` : `${Math.abs(lon)}°B`})`,
          arabicName: 'المَوْقِعُ المَحَلِّيُّ لِلْمُسْتَخْدِمِ',
          latitude: lat,
          longitude: lon,
          description: 'Koordinat astronomis riil berdasarkan GPS peramban lokal Anda.',
          era: 'Pengamatan Waktu Nyata',
        };
        setSelectedObserver(newLoc);
        setCustomLat(lat);
        setCustomLon(lon);
        setGeoStatus('Koordinat berhasil disinkronkan!');
        if (onLocationChange) onLocationChange(lat, lon, newLoc.name);
        setTimeout(() => setGeoStatus(null), 3000);
      },
      (err) => {
        setGeoStatus(`Gagal mendeteksi lokasi: ${err.message}`);
        setTimeout(() => setGeoStatus(null), 4000);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Handle manual custom coordinate apply
  const handleApplyCustomCoord = () => {
    const newLoc: ObserverLocation = {
      id: 'custom_manual',
      name: `Kustom (${customLat > 0 ? `${customLat}°U` : `${Math.abs(customLat)}°S`}, ${customLon > 0 ? `${customLon}°T` : `${Math.abs(customLon)}°B`})`,
      arabicName: 'إِحْدَاثِيَّاتٌ مُخَصَّصَةٌ',
      latitude: customLat,
      longitude: customLon,
      description: 'Koordinat kustom yang dimasukkan secara manual oleh peneliti.',
    };
    setSelectedObserver(newLoc);
    setIsCustomLocOpen(false);
    if (onLocationChange) onLocationChange(customLat, customLon, newLoc.name);
  };

  // Render D3 Star Map Visualization
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Definitions (Gradients & Filters)
    const defs = svg.append('defs');

    // Radial gradient for deep celestial dome
    const skyGradient = defs
      .append('radialGradient')
      .attr('id', 'skyDomeGrad')
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '50%');

    if (skyData.twilightState === 'Day') {
      skyGradient.append('stop').attr('offset', '0%').attr('stop-color', '#1e3a5f');
      skyGradient.append('stop').attr('offset', '70%').attr('stop-color', '#2c5282');
      skyGradient.append('stop').attr('offset', '100%').attr('stop-color', '#3182ce');
    } else if (skyData.twilightState === 'Civil Twilight') {
      skyGradient.append('stop').attr('offset', '0%').attr('stop-color', '#0f172a');
      skyGradient.append('stop').attr('offset', '65%').attr('stop-color', '#1e1e38');
      skyGradient.append('stop').attr('offset', '100%').attr('stop-color', '#581c87');
    } else {
      skyGradient.append('stop').attr('offset', '0%').attr('stop-color', '#050814');
      skyGradient.append('stop').attr('offset', '65%').attr('stop-color', '#090e1f');
      skyGradient.append('stop').attr('offset', '100%').attr('stop-color', '#10162b');
    }

    // Glow filter for bright stars & planets
    const filter = defs.append('filter').attr('id', 'glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Main Zoomable Canvas Group
    const g = svg.append('g').attr('transform', `translate(${width / 2}, ${height / 2})`);

    // D3 Zoom setup
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.8, 3.5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Initial transform centered
    svg.call(
      zoom.transform,
      d3.zoomIdentity.translate(width / 2, height / 2).scale(1)
    );

    // 1. Sky Dome Background Circle (The Horizon / Dā'irat al-Ufuq)
    g.append('circle')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', radius)
      .attr('fill', 'url(#skyDomeGrad)')
      .attr('stroke', '#c59a43')
      .attr('stroke-width', 2.5)
      .attr('stroke-opacity', 0.85);

    // 2. Outer Astrolabe Rim Graduations (Deg marks around horizon)
    const rimGroup = g.append('g').attr('class', 'horizon-rim');
    for (let deg = 0; deg < 360; deg += 5) {
      const rad = (deg * Math.PI) / 180;
      const isMajor = deg % 30 === 0;
      const isMed = deg % 10 === 0;
      const tickLen = isMajor ? 9 : isMed ? 6 : 3;

      const x1 = radius * Math.sin(rad);
      const y1 = -radius * Math.cos(rad);
      const x2 = (radius - tickLen) * Math.sin(rad);
      const y2 = -(radius - tickLen) * Math.cos(rad);

      rimGroup
        .append('line')
        .attr('x1', x1)
        .attr('y1', y1)
        .attr('x2', x2)
        .attr('y2', y2)
        .attr('stroke', isMajor ? '#c59a43' : '#64748b')
        .attr('stroke-width', isMajor ? 1.5 : 0.8)
        .attr('stroke-opacity', isMajor ? 0.9 : 0.5);
    }

    // 3. Almucantars (Al-Muqanṭarāt - Circles of Altitude)
    if (showAlmucantars) {
      const almucantarGroup = g.append('g').attr('class', 'almucantars');
      const altitudes = [15, 30, 45, 60, 75];

      altitudes.forEach((alt) => {
        const altR = (radius * (90 - alt)) / 90;
        almucantarGroup
          .append('circle')
          .attr('cx', 0)
          .attr('cy', 0)
          .attr('r', altR)
          .attr('fill', 'none')
          .attr('stroke', '#38bdf8')
          .attr('stroke-dasharray', '2,4')
          .attr('stroke-width', 0.75)
          .attr('stroke-opacity', 0.35);

        // Altitude Degree Label on the North-South meridian
        almucantarGroup
          .append('text')
          .attr('x', 4)
          .attr('y', -altR + 3)
          .attr('fill', '#38bdf8')
          .attr('font-size', '8px')
          .attr('font-family', 'monospace')
          .attr('opacity', 0.6)
          .text(`${alt}°`);
      });

      // Azimuth Radial Rays (Dawa'ir as-Samt every 30°)
      for (let az = 0; az < 360; az += 30) {
        const rad = (az * Math.PI) / 180;
        // In sky projection, East is left (negative x)
        const x = -radius * Math.sin(rad);
        const y = -radius * Math.cos(rad);

        almucantarGroup
          .append('line')
          .attr('x1', 0)
          .attr('y1', 0)
          .attr('x2', x)
          .attr('y2', y)
          .attr('stroke', '#64748b')
          .attr('stroke-dasharray', '1,4')
          .attr('stroke-width', 0.7)
          .attr('stroke-opacity', 0.3);
      }
    }

    // 4. Principal Axes: Meridian (Khaṭṭ Niṣf an-Nahār) and Prime Vertical (Awwal as-Sumūt)
    const axesGroup = g.append('g').attr('class', 'principal-axes');

    // Meridian: N - S line
    axesGroup
      .append('line')
      .attr('x1', 0)
      .attr('y1', -radius)
      .attr('x2', 0)
      .attr('y2', radius)
      .attr('stroke', '#c59a43')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.5);

    // Prime Vertical: E - W line
    axesGroup
      .append('line')
      .attr('x1', -radius)
      .attr('y1', 0)
      .attr('x2', radius)
      .attr('y2', 0)
      .attr('stroke', '#c59a43')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.5);

    // Zenith marker at center (Samt ar-Ra's)
    axesGroup
      .append('circle')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', 3)
      .attr('fill', '#c59a43');

    axesGroup
      .append('text')
      .attr('x', 6)
      .attr('y', -6)
      .attr('fill', '#c59a43')
      .attr('font-size', '9px')
      .attr('font-family', 'serif')
      .attr('font-weight', 'bold')
      .text('سَمْتُ الرَّأْسِ (Zenith)');

    // 5. Cardinal Direction Labels in Arabic & Latin
    const cardinals = [
      { name: 'الشَّمَال (N)', x: 0, y: -radius - 12, anchor: 'middle' },
      { name: 'الشَّرْق (E)', x: -radius - 12, y: 4, anchor: 'end' }, // East is Left on sky map
      { name: 'الجَنُوب (S)', x: 0, y: radius + 16, anchor: 'middle' },
      { name: 'الغَرْب (W)', x: radius + 12, y: 4, anchor: 'start' }, // West is Right
    ];

    const cardinalGroup = g.append('g').attr('class', 'cardinal-markers');
    cardinals.forEach((c) => {
      cardinalGroup
        .append('text')
        .attr('x', c.x)
        .attr('y', c.y)
        .attr('text-anchor', c.anchor)
        .attr('fill', '#c59a43')
        .attr('font-size', '11px')
        .attr('font-family', 'serif')
        .attr('font-weight', 'bold')
        .text(c.name);
    });

    // 6. Celestial Equator Curve (Mu'addil an-Nahar)
    const lineGen = d3
      .line<{ x: number; y: number }>()
      .x((d) => d.x)
      .y((d) => d.y)
      .curve(d3.curveBasis);

    const visibleEquatorPts = skyData.celestialEquatorPoints.filter((p) => p.isVisible);
    if (visibleEquatorPts.length > 2) {
      g.append('path')
        .datum(visibleEquatorPts)
        .attr('fill', 'none')
        .attr('stroke', '#a855f7')
        .attr('stroke-width', 1.2)
        .attr('stroke-dasharray', '4,3')
        .attr('stroke-opacity', 0.6);
    }

    // 7. Ecliptic Band Curve (Mintaqat al-Buruj)
    if (showEcliptic) {
      const visibleEclipticPts = skyData.eclipticPoints.filter((p) => p.isVisible);
      if (visibleEclipticPts.length > 2) {
        g.append('path')
          .datum(visibleEclipticPts)
          .attr('fill', 'none')
          .attr('stroke', '#eab308')
          .attr('stroke-width', 2)
          .attr('stroke-opacity', 0.8);
      }
    }

    // 8. 28 Lunar Mansions (Manāzil al-Qamar)
    if (showManzils) {
      const manzilGroup = g.append('g').attr('class', 'lunar-mansions');

      skyData.manzils.forEach((m) => {
        if (filterVisibleOnly && !m.isVisible) return;

        const isSelected = selectedObject?.type === 'manzil' && (selectedObject.data as ProjectedManzil).number === m.number;
        const pt = m.projected;

        // Skip if outside circle
        const dist = Math.sqrt(pt.x * pt.x + pt.y * pt.y);
        if (dist > radius + 10) return;

        const mg = manzilGroup
          .append('g')
          .attr('class', `manzil-${m.number}`)
          .style('cursor', 'pointer')
          .on('click', () => {
            setSelectedObject({ type: 'manzil', data: m });
          });

        // Pulsing halo for current moon mansion
        if (m.isCurrentMoonMansion) {
          mg.append('circle')
            .attr('cx', pt.x)
            .attr('cy', pt.y)
            .attr('r', 12)
            .attr('fill', 'none')
            .attr('stroke', '#f59e0b')
            .attr('stroke-width', 1.5)
            .attr('stroke-opacity', 0.8)
            .attr('stroke-dasharray', '2,2');
        }

        // Mansion Marker Point
        mg.append('circle')
          .attr('cx', pt.x)
          .attr('cy', pt.y)
          .attr('r', m.isCurrentMoonMansion ? 6 : isSelected ? 5 : 4)
          .attr('fill', m.isCurrentMoonMansion ? '#f59e0b' : isSelected ? '#38bdf8' : '#e2e8f0')
          .attr('stroke', m.isCurrentMoonMansion ? '#ffffff' : '#c59a43')
          .attr('stroke-width', 1.2)
          .attr('filter', m.isCurrentMoonMansion ? 'url(#glow)' : null);

        // Mansion Label
        if (showLabels) {
          mg.append('text')
            .attr('x', pt.x + 6)
            .attr('y', pt.y + 3)
            .attr('fill', m.isCurrentMoonMansion ? '#f59e0b' : '#cbd5e1')
            .attr('font-size', '9px')
            .attr('font-family', 'serif')
            .attr('font-weight', m.isCurrentMoonMansion ? 'bold' : 'normal')
            .text(`${m.number}. ${m.arabicName}`);
        }
      });
    }

    // 9. Classical Fixed Stars (Al-Kawākib ath-Thābitah)
    if (showStars) {
      const starGroup = g.append('g').attr('class', 'fixed-stars');

      skyData.stars.forEach((star) => {
        if (filterVisibleOnly && !star.projected.isVisible) return;

        const pt = star.projected;
        const dist = Math.sqrt(pt.x * pt.x + pt.y * pt.y);
        if (dist > radius) return;

        const isSelected = selectedObject?.type === 'star' && (selectedObject.data as ProjectedStar).id === star.id;

        // Size based on magnitude: mag -1.5 is largest, mag 2 is smaller
        const starRadius = Math.max(2, 6 - (star.magnitude + 1.5) * 1.2);

        const sg = starGroup
          .append('g')
          .attr('class', `star-${star.id}`)
          .style('cursor', 'pointer')
          .on('click', () => {
            setSelectedObject({ type: 'star', data: star });
          });

        // Halo for selection or bright star
        if (star.magnitude < 0.5 || isSelected) {
          sg.append('circle')
            .attr('cx', pt.x)
            .attr('cy', pt.y)
            .attr('r', starRadius + 4)
            .attr('fill', star.spectralColor)
            .attr('opacity', 0.25)
            .attr('filter', 'url(#glow)');
        }

        // Star core
        sg.append('circle')
          .attr('cx', pt.x)
          .attr('cy', pt.y)
          .attr('r', starRadius)
          .attr('fill', star.spectralColor)
          .attr('stroke', isSelected ? '#ffffff' : '#1e293b')
          .attr('stroke-width', 0.75);

        // Star 4-point sparkle for navigation beacons
        if (star.magnitude < 0.2) {
          const l = starRadius + 3;
          sg.append('line')
            .attr('x1', pt.x - l)
            .attr('y1', pt.y)
            .attr('x2', pt.x + l)
            .attr('y2', pt.y)
            .attr('stroke', star.spectralColor)
            .attr('stroke-width', 0.7)
            .attr('opacity', 0.7);

          sg.append('line')
            .attr('x1', pt.x)
            .attr('y1', pt.y - l)
            .attr('x2', pt.x)
            .attr('y2', pt.y + l)
            .attr('stroke', star.spectralColor)
            .attr('stroke-width', 0.7)
            .attr('opacity', 0.7);
        }

        // Star Label
        if (showLabels && star.magnitude < 1.4) {
          sg.append('text')
            .attr('x', pt.x + starRadius + 4)
            .attr('y', pt.y + 3)
            .attr('fill', isSelected ? '#38bdf8' : '#e2e8f0')
            .attr('font-size', '9.5px')
            .attr('font-family', 'serif')
            .attr('opacity', 0.9)
            .text(star.transliteration);
        }
      });
    }

    // 10. Planets & Sun/Moon (Al-Kawākib as-Sayyārah)
    if (showPlanets) {
      const planetGroup = g.append('g').attr('class', 'planets');

      skyData.planets.forEach((p) => {
        if (filterVisibleOnly && !p.isVisible) return;

        const pt = p.projected;
        const dist = Math.sqrt(pt.x * pt.x + pt.y * pt.y);
        if (dist > radius) return;

        const isSelected = selectedObject?.type === 'planet' && (selectedObject.data as ProjectedPlanet).key === p.key;

        const pg = planetGroup
          .append('g')
          .attr('class', `planet-${p.key}`)
          .style('cursor', 'pointer')
          .on('click', () => {
            setSelectedObject({ type: 'planet', data: p });
          });

        // Planetary outer glow ring
        pg.append('circle')
          .attr('cx', pt.x)
          .attr('cy', pt.y)
          .attr('r', 10)
          .attr('fill', p.color)
          .attr('opacity', 0.3)
          .attr('filter', 'url(#glow)');

        // Planetary core circle
        pg.append('circle')
          .attr('cx', pt.x)
          .attr('cy', pt.y)
          .attr('r', 6)
          .attr('fill', p.color)
          .attr('stroke', isSelected ? '#ffffff' : '#0f172a')
          .attr('stroke-width', 1.5);

        // Planet glyph symbol
        pg.append('text')
          .attr('x', pt.x)
          .attr('y', pt.y + 3)
          .attr('text-anchor', 'middle')
          .attr('fill', '#000000')
          .attr('font-size', '8px')
          .attr('font-weight', 'bold')
          .text(p.symbol);

        // Planet Label
        if (showLabels) {
          pg.append('text')
            .attr('x', pt.x)
            .attr('y', pt.y - 10)
            .attr('text-anchor', 'middle')
            .attr('fill', p.color)
            .attr('font-size', '10px')
            .attr('font-family', 'serif')
            .attr('font-weight', 'bold')
            .text(`${p.transliteration} ${p.symbol}`);
        }
      });
    }
  }, [skyData, showManzils, showStars, showPlanets, showAlmucantars, showEcliptic, showLabels, filterVisibleOnly, selectedObject]);

  // Reset SVG Zoom
  const handleResetZoom = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom<SVGSVGElement, unknown>();
    svg.transition().duration(500).call(
      zoom.transform,
      d3.zoomIdentity.translate(width / 2, height / 2).scale(1)
    );
  };

  return (
    <div
      id="star-map-module"
      className={`rounded-2xl border p-4 sm:p-5 transition-all space-y-5 ${
        isNight
          ? 'bg-[#0f1422]/95 border-[#283955] text-[#e6ded0]'
          : 'bg-[#faf6ee] border-[#ded4bf] text-[#2c241c] shadow-sm'
      }`}
    >
      {/* Header Deck */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-current/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold uppercase tracking-wider bg-[#c59a43]/20 text-[#c59a43] border border-[#c59a43]/40">
              خَرِيطَةُ السَّمَاءِ وَمَنَازِلُ القَمَرِ
            </span>
            <h2 className="text-lg sm:text-xl font-bold font-serif text-[#c59a43]">
              Peta Langit & Manzil Bintang Sindhind
            </h2>
          </div>
          <p className="text-xs opacity-80 mt-1 font-serif">
            Proyeksi kubah ufuk lokal (Alt-Azimuth / *Al-Muqanṭarāt wa ad-Dawā'ir*) dari 28 Manzil Bulan, rasi zodiak, dan bintang navigasi Arab kuno berdasarkan koordinat observasi Anda.
          </p>
        </div>

        {/* Location Selector Bar */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto text-xs">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-current/5 border border-current/10 font-serif">
            <MapPin className="w-3.5 h-3.5 text-[#c59a43] ml-1" />
            <select
              value={selectedObserver.id}
              onChange={(e) => {
                const found = HISTORICAL_OBSERVATORIES.find((o) => o.id === e.target.value);
                if (found) {
                  setSelectedObserver(found);
                  setCustomLat(found.latitude);
                  setCustomLon(found.longitude);
                  if (onLocationChange) onLocationChange(found.latitude, found.longitude, found.name);
                }
              }}
              className={`p-1.5 rounded-lg border text-xs font-serif outline-none ${
                isNight ? 'bg-[#090d18] border-[#1d2b42]' : 'bg-[#ffffff] border-[#ded5bd]'
              }`}
            >
              {HISTORICAL_OBSERVATORIES.map((obs) => (
                <option key={obs.id} value={obs.id}>
                  {obs.name}
                </option>
              ))}
            </select>
          </div>

          {/* GPS Auto Detect */}
          <button
            onClick={handleDetectGPS}
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-semibold transition-colors ${
              isNight
                ? 'bg-[#172237] border-[#293c5d] hover:bg-[#202f4a] text-[#38bdf8]'
                : 'bg-[#ede5d4] border-[#ded0b5] hover:bg-[#e4dac4] text-[#0284c7]'
            }`}
            title="Deteksi koordinat saya via GPS"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">GPS Saya</span>
          </button>

          {/* Custom Coordinate Trigger */}
          <button
            onClick={() => setIsCustomLocOpen(!isCustomLocOpen)}
            className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1 font-semibold transition-colors ${
              isCustomLocOpen
                ? 'bg-[#c59a43] text-black font-bold'
                : isNight
                ? 'bg-[#172237] border-[#293c5d] hover:bg-[#202f4a]'
                : 'bg-[#ede5d4] border-[#ded0b5] hover:bg-[#e4dac4]'
            }`}
            title="Ubah Latitude & Longitude manual"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* GPS Status Message Toast */}
      {geoStatus && (
        <div className="p-2.5 rounded-xl bg-[#c59a43]/15 border border-[#c59a43]/40 text-xs font-serif text-[#c59a43] flex items-center gap-2 animate-fade-in">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span>{geoStatus}</span>
        </div>
      )}

      {/* Custom Coordinates Collapsible */}
      {isCustomLocOpen && (
        <div
          className={`p-3.5 rounded-xl border text-xs space-y-3 transition-all ${
            isNight ? 'bg-[#0a0f1d] border-[#20314f]' : 'bg-[#f4ebe0] border-[#ded0b5]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-serif font-bold text-[#c59a43] flex items-center gap-1.5">
              <Globe2 className="w-3.5 h-3.5" />
              Tentukan Titik Koordinat Observasi Manual:
            </span>
            <span className="text-[10px] opacity-60 font-mono">Bujur & Lintang Geografis</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] opacity-75 block mb-1">
                Latitude / Garis Lintang (°U / °S):
              </label>
              <input
                type="number"
                step="0.0001"
                min="-90"
                max="90"
                value={customLat}
                onChange={(e) => setCustomLat(parseFloat(e.target.value) || 0)}
                className={`w-full p-1.5 rounded-lg border text-xs outline-none ${
                  isNight ? 'bg-[#050811] border-[#1a273e]' : 'bg-[#ffffff] border-[#ded5bd]'
                }`}
              />
            </div>

            <div>
              <label className="text-[11px] opacity-75 block mb-1">
                Longitude / Garis Bujur (°T / °B):
              </label>
              <input
                type="number"
                step="0.0001"
                min="-180"
                max="180"
                value={customLon}
                onChange={(e) => setCustomLon(parseFloat(e.target.value) || 0)}
                className={`w-full p-1.5 rounded-lg border text-xs outline-none ${
                  isNight ? 'bg-[#050811] border-[#1a273e]' : 'bg-[#ffffff] border-[#ded5bd]'
                }`}
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={handleApplyCustomCoord}
                className="w-full py-2 rounded-lg font-bold bg-[#c59a43] text-black hover:bg-[#d6aa52] transition-colors shadow-sm flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Terapkan Koordinat</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Astronomical Sky State Bar (Sidereal Time, Altitude Sun, Moon Mansion) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
        <div
          className={`p-2.5 rounded-xl border ${
            isNight ? 'bg-[#0a0f1d] border-[#1d2a40]' : 'bg-[#ffffff] border-[#ded5bd]'
          }`}
        >
          <span className="text-[10px] opacity-60 block">Waktu Sideris Lokal (LAST):</span>
          <span className="font-bold text-sm text-[#c59a43]">
            {Math.floor(skyData.lastHours)}h {Math.floor((skyData.lastHours % 1) * 60)}m
          </span>
          <span className="text-[9px] opacity-60 block font-serif">الزَّمَنُ النَّجْمِيُّ</span>
        </div>

        <div
          className={`p-2.5 rounded-xl border ${
            isNight ? 'bg-[#0a0f1d] border-[#1d2a40]' : 'bg-[#ffffff] border-[#ded5bd]'
          }`}
        >
          <span className="text-[10px] opacity-60 block">Ketinggian Matahari (Irtifa'):</span>
          <span
            className={`font-bold text-sm ${
              skyData.sunAltitude > 0 ? 'text-amber-400' : 'text-sky-400'
            }`}
          >
            {skyData.sunAltitude.toFixed(1)}°
          </span>
          <span className="text-[9px] opacity-60 block font-serif">
            {skyData.twilightState}
          </span>
        </div>

        <div
          className={`p-2.5 rounded-xl border ${
            isNight ? 'bg-[#0a0f1d] border-[#1d2a40]' : 'bg-[#ffffff] border-[#ded5bd]'
          }`}
        >
          <span className="text-[10px] opacity-60 block">Manzil Singgah Bulan:</span>
          <span className="font-bold text-sm text-[#f59e0b]">
            #{skyData.currentMoonMansionNumber}{' '}
            {LUNAR_MANSIONS[skyData.currentMoonMansionNumber - 1]?.transliteration}
          </span>
          <span className="text-[9px] opacity-60 block font-serif" dir="rtl">
            {LUNAR_MANSIONS[skyData.currentMoonMansionNumber - 1]?.arabicName}
          </span>
        </div>

        <div
          className={`p-2.5 rounded-xl border ${
            isNight ? 'bg-[#0a0f1d] border-[#1d2a40]' : 'bg-[#ffffff] border-[#ded5bd]'
          }`}
        >
          <span className="text-[10px] opacity-60 block">Lintang Pengamat (L):</span>
          <span className="font-bold text-sm text-[#38bdf8]">
            {selectedObserver.latitude > 0
              ? `${selectedObserver.latitude.toFixed(2)}° U`
              : `${Math.abs(selectedObserver.latitude).toFixed(2)}° S`}
          </span>
          <span className="text-[9px] opacity-60 block font-serif">
            {selectedObserver.name.split('(')[0]}
          </span>
        </div>
      </div>

      {/* Layer Toggles Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 pb-1 border-t border-b border-current/10 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] opacity-60 font-serif mr-1">Lapisan:</span>

          <button
            onClick={() => setShowManzils(!showManzils)}
            className={`px-2.5 py-1 rounded-lg border font-serif transition-colors text-[11px] flex items-center gap-1 ${
              showManzils
                ? 'bg-[#c59a43]/20 border-[#c59a43] text-[#c59a43] font-semibold'
                : 'opacity-50 hover:opacity-100'
            }`}
          >
            <Moon className="w-3 h-3" />
            <span>28 Manzil</span>
          </button>

          <button
            onClick={() => setShowStars(!showStars)}
            className={`px-2.5 py-1 rounded-lg border font-serif transition-colors text-[11px] flex items-center gap-1 ${
              showStars
                ? 'bg-[#38bdf8]/20 border-[#38bdf8] text-[#38bdf8] font-semibold'
                : 'opacity-50 hover:opacity-100'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>Bintang Tetap</span>
          </button>

          <button
            onClick={() => setShowPlanets(!showPlanets)}
            className={`px-2.5 py-1 rounded-lg border font-serif transition-colors text-[11px] flex items-center gap-1 ${
              showPlanets
                ? 'bg-[#eab308]/20 border-[#eab308] text-[#eab308] font-semibold'
                : 'opacity-50 hover:opacity-100'
            }`}
          >
            <Sun className="w-3 h-3" />
            <span>Planet Berjalan</span>
          </button>

          <button
            onClick={() => setShowAlmucantars(!showAlmucantars)}
            className={`px-2.5 py-1 rounded-lg border font-serif transition-colors text-[11px] flex items-center gap-1 ${
              showAlmucantars
                ? 'bg-[#a855f7]/20 border-[#a855f7] text-[#a855f7] font-semibold'
                : 'opacity-50 hover:opacity-100'
            }`}
          >
            <Compass className="w-3 h-3" />
            <span>Almucantar (Kubah)</span>
          </button>

          <button
            onClick={() => setShowEcliptic(!showEcliptic)}
            className={`px-2.5 py-1 rounded-lg border font-serif transition-colors text-[11px] flex items-center gap-1 ${
              showEcliptic
                ? 'bg-amber-500/20 border-amber-500 text-amber-400 font-semibold'
                : 'opacity-50 hover:opacity-100'
            }`}
          >
            <span>Ekliptika</span>
          </button>

          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`px-2.5 py-1 rounded-lg border font-serif transition-colors text-[11px] ${
              showLabels
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 font-semibold'
                : 'opacity-50 hover:opacity-100'
            }`}
          >
            Label Nama
          </button>

          <button
            onClick={() => setFilterVisibleOnly(!filterVisibleOnly)}
            className={`px-2.5 py-1 rounded-lg border font-serif transition-colors text-[11px] ${
              filterVisibleOnly
                ? 'bg-current/10 border-current/20 text-current font-semibold'
                : 'opacity-50 hover:opacity-100'
            }`}
            title="Tampilkan hanya bintang/objek yang berada di atas ufuk saat ini"
          >
            {filterVisibleOnly ? 'Hanya di Atas Ufuk' : 'Semua Objek'}
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 text-xs">
          <button
            onClick={handleResetZoom}
            className={`p-1.5 rounded-lg border ${
              isNight ? 'bg-[#151d2f] border-[#253652]' : 'bg-[#ede5d4] border-[#ded0b5]'
            }`}
            title="Reset Posisi & Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Interactive Stage: Canvas + Side Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* D3 Star Map SVG Container (8 cols) */}
        <div
          className={`lg:col-span-8 rounded-2xl border p-2 sm:p-4 flex flex-col items-center justify-center relative overflow-hidden select-none ${
            isNight ? 'bg-[#070b16] border-[#1f2e47]' : 'bg-[#f4ede1] border-[#ded2ba]'
          }`}
        >
          <div className="w-full max-w-[640px] aspect-square relative">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-full cursor-grab active:cursor-grabbing"
            />
          </div>

          <div className="text-[10px] opacity-60 font-serif mt-2 text-center">
            Piringan Kubah Langit Ufuk (*Dā'irat al-Ufuq*) • Zenith di pusat • Ufuk di lingkaran tepi luar • Timur di sisi kiri • Barat di sisi kanan
          </div>
        </div>

        {/* Selected Object / Manzil Detail Inspector (4 cols) */}
        <div
          className={`lg:col-span-4 rounded-2xl border p-4 space-y-4 ${
            isNight ? 'bg-[#0d1322] border-[#22334f]' : 'bg-[#ffffff] border-[#ded5be]'
          }`}
        >
          {selectedObject ? (
            <div className="space-y-3.5 text-xs">
              <div className="flex items-start justify-between pb-2 border-b border-current/10">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#c59a43]">
                    {selectedObject.type === 'manzil'
                      ? 'Manzil Bulan (مَنْزِلُ القَمَرِ)'
                      : selectedObject.type === 'star'
                      ? 'Bintang Tetap (كَوْكَبٌ ثَابِتٌ)'
                      : 'Planet Berjalan (كَوْكَبٌ سَيَّارٌ)'}
                  </span>
                  <h3 className="font-serif font-bold text-base text-[#c59a43]">
                    {selectedObject.type === 'manzil'
                      ? (selectedObject.data as ProjectedManzil).transliteration
                      : selectedObject.type === 'star'
                      ? (selectedObject.data as ProjectedStar).transliteration
                      : (selectedObject.data as ProjectedPlanet).transliteration}
                  </h3>
                  <div className="font-serif text-sm opacity-80" dir="rtl">
                    {selectedObject.type === 'manzil'
                      ? (selectedObject.data as ProjectedManzil).arabicName
                      : selectedObject.type === 'star'
                      ? (selectedObject.data as ProjectedStar).nameArabic
                      : (selectedObject.data as ProjectedPlanet).arabicName}
                  </div>
                </div>

                <button
                  onClick={() => setSelectedObject(null)}
                  className="opacity-50 hover:opacity-100 p-1"
                >
                  ✕
                </button>
              </div>

              {/* Coordinates Alt / Az */}
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="p-2 rounded-lg bg-current/5 border border-current/10">
                  <span className="opacity-60 block">Ketinggian (Irtifā‘):</span>
                  <span
                    className={`font-bold ${
                      (selectedObject.data as any).altitude > 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {(selectedObject.data as any).altitude?.toFixed(2)}°
                  </span>
                  <span className="text-[9px] opacity-60 block">
                    {(selectedObject.data as any).altitude > 0 ? 'Ṭāli‘ (Di Atas Ufuk)' : 'Ghārib (Terbenam)'}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-current/5 border border-current/10">
                  <span className="opacity-60 block">Azimuth (As-Samt):</span>
                  <span className="font-bold text-[#38bdf8]">
                    {(selectedObject.data as any).azimuth?.toFixed(2)}°
                  </span>
                  <span className="text-[9px] opacity-60 block">Dari Utara Searah Jarum Jam</span>
                </div>
              </div>

              {/* Specific Content by Type */}
              {selectedObject.type === 'manzil' && (
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-bold opacity-75 block text-[11px]">Gugusan Bintang Penanda:</span>
                    <p className="opacity-90">{(selectedObject.data as ProjectedManzil).starGroup}</p>
                  </div>

                  <div>
                    <span className="font-bold opacity-75 block text-[11px]">Karakter & Keberuntungan:</span>
                    <p className="opacity-90">
                      Sifat:{' '}
                      <strong className="text-[#c59a43]">
                        {(selectedObject.data as ProjectedManzil).fortune}
                      </strong>
                    </p>
                  </div>

                  <div className="p-2 rounded bg-current/5 border border-current/10 text-[11px] font-serif">
                    Rentang Ekliptika:{' '}
                    <strong>
                      {(selectedObject.data as ProjectedManzil).startEclipticDeg.toFixed(1)}° s.d.{' '}
                      {(selectedObject.data as ProjectedManzil).endEclipticDeg.toFixed(1)}°
                    </strong>
                  </div>
                </div>
              )}

              {selectedObject.type === 'star' && (
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-bold opacity-75 block text-[11px]">Katalog & Konstelasi:</span>
                    <p className="opacity-90">
                      {(selectedObject.data as ProjectedStar).bayer} •{' '}
                      {(selectedObject.data as ProjectedStar).constellation} (
                      {(selectedObject.data as ProjectedStar).constellationArabic})
                    </p>
                  </div>

                  <div>
                    <span className="font-bold opacity-75 block text-[11px]">Magnitudo Visual:</span>
                    <p className="opacity-90 font-mono">
                      {(selectedObject.data as ProjectedStar).magnitude}m (Warna Spektrum:{' '}
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full border border-black align-middle ml-1"
                        style={{ backgroundColor: (selectedObject.data as ProjectedStar).spectralColor }}
                      />
                      )
                    </p>
                  </div>

                  <div>
                    <span className="font-bold opacity-75 block text-[11px]">Deskripsi Kitab Kuno:</span>
                    <p className="opacity-85 leading-relaxed font-sans">
                      {(selectedObject.data as ProjectedStar).classicalDescription}
                    </p>
                  </div>
                </div>
              )}

              {selectedObject.type === 'planet' && (
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-bold opacity-75 block text-[11px]">Bujur Sejati Ekliptika:</span>
                    <p className="font-mono text-[#c59a43] font-bold">
                      {(selectedObject.data as ProjectedPlanet).eclipticLongitude.toFixed(2)}°
                    </p>
                  </div>

                  <div>
                    <span className="font-bold opacity-75 block text-[11px]">Kondisi Gerak:</span>
                    <p className="opacity-90">
                      {(selectedObject.data as ProjectedPlanet).isRetrograde
                        ? 'Rujū‘ (Mundur / Retrograde)'
                        : 'Mustaqīm (Maju Seimbang)'}
                    </p>
                  </div>
                </div>
              )}

              {/* Research Annotation Action */}
              {onAnnotateStar && (
                <div className="pt-2 border-t border-current/10">
                  <button
                    onClick={() => {
                      const name =
                        selectedObject.type === 'manzil'
                          ? (selectedObject.data as ProjectedManzil).transliteration
                          : selectedObject.type === 'star'
                          ? (selectedObject.data as ProjectedStar).transliteration
                          : (selectedObject.data as ProjectedPlanet).transliteration;
                      const alt = (selectedObject.data as any).altitude?.toFixed(2);
                      const az = (selectedObject.data as any).azimuth?.toFixed(2);
                      onAnnotateStar(
                        `Observasi Langit: ${name} (${selectedObserver.name})`,
                        `Posisi astronomis pada JDN ${currentDateInfo.jdn.toFixed(2)}: Ketinggian (Irtifa') = ${alt}°, Azimuth (Samt) = ${az}°. Lokasi pengamat: ${selectedObserver.name} (Lat: ${selectedObserver.latitude}°, Lon: ${selectedObserver.longitude}°).`
                      );
                    }}
                    className="w-full py-1.5 px-3 rounded-lg font-semibold text-xs bg-[#c59a43] text-black hover:bg-[#d6aa52] transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    <span>Catat ke Anotasi Riset</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 px-4 text-center space-y-2 opacity-70">
              <Crosshair className="w-8 h-8 mx-auto text-[#c59a43] opacity-60" />
              <h4 className="font-serif font-bold text-sm text-[#c59a43]">
                Pemeriksa Objek Langit
              </h4>
              <p className="text-xs leading-relaxed font-sans">
                Klik salah satu bintang tetap (*Al-Kawākib ath-Thābitah*), 28 Manzil Bulan, atau planet pada peta langit untuk menelaah koordinat Alt/Az lokal dan sifat astronomis klasiknya.
              </p>
            </div>
          )}

          {/* Quick Observatory Info */}
          <div className="pt-3 border-t border-current/10 text-[11px] opacity-80 space-y-1 font-serif">
            <span className="font-bold text-[#c59a43] block">
              Observatorium Aktif: {selectedObserver.name}
            </span>
            <p className="leading-snug">{selectedObserver.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
