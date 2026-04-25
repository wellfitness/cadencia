import { describe, it, expect } from 'vitest';
import { parseGpx } from './parser';

const minimalGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
 <trk>
  <name>Test ruta</name>
  <trkseg>
   <trkpt lat="42.21" lon="-8.73"><ele>40</ele><time>2026-01-01T08:00:00Z</time></trkpt>
   <trkpt lat="42.22" lon="-8.74"><ele>50</ele><time>2026-01-01T08:00:30Z</time></trkpt>
   <trkpt lat="42.23" lon="-8.75"><ele>60</ele><time>2026-01-01T08:01:00Z</time></trkpt>
  </trkseg>
 </trk>
</gpx>`;

describe('parseGpx', () => {
  it('parsea GPX 1.1 minimo correctamente', () => {
    const track = parseGpx(minimalGpx);
    expect(track.name).toBe('Test ruta');
    expect(track.points).toHaveLength(3);
    expect(track.hasTimestamps).toBe(true);
    expect(track.points[0]).toMatchObject({ lat: 42.21, lon: -8.73, ele: 40 });
    expect(track.points[0]?.time?.toISOString()).toBe('2026-01-01T08:00:00.000Z');
  });

  it('respeta el orden de los puntos', () => {
    const track = parseGpx(minimalGpx);
    expect(track.points.map((p) => p.lat)).toEqual([42.21, 42.22, 42.23]);
  });

  it('parsea Strava 1.1 con extensiones (las ignora)', () => {
    const stravaGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="StravaGPX" version="1.1"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
 <trk>
  <name>Strava export</name>
  <trkseg>
   <trkpt lat="42.21" lon="-8.73">
    <ele>40</ele>
    <time>2026-01-01T08:00:00Z</time>
    <extensions>
     <power>180</power>
     <gpxtpx:TrackPointExtension>
      <gpxtpx:atemp>22</gpxtpx:atemp>
     </gpxtpx:TrackPointExtension>
    </extensions>
   </trkpt>
  </trkseg>
 </trk>
</gpx>`;
    const track = parseGpx(stravaGpx);
    expect(track.points).toHaveLength(1);
    expect(track.points[0]?.ele).toBe(40);
  });

  it('hasTimestamps=false si ningun punto tiene <time>', () => {
    const noTimeGpx = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
 <trk><trkseg>
  <trkpt lat="42.21" lon="-8.73"><ele>40</ele></trkpt>
  <trkpt lat="42.22" lon="-8.74"><ele>50</ele></trkpt>
 </trkseg></trk>
</gpx>`;
    const track = parseGpx(noTimeGpx);
    expect(track.hasTimestamps).toBe(false);
    expect(track.points[0]?.time).toBeNull();
  });

  it('asume ele=0 si falta <ele>', () => {
    const noEleGpx = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
 <trk><trkseg>
  <trkpt lat="42.21" lon="-8.73"><time>2026-01-01T08:00:00Z</time></trkpt>
 </trkseg></trk>
</gpx>`;
    const track = parseGpx(noEleGpx);
    expect(track.points[0]?.ele).toBe(0);
  });

  it('concatena puntos de multiples <trkseg>', () => {
    const multiSegGpx = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
 <trk>
  <trkseg>
   <trkpt lat="42.1" lon="-8.7"><ele>10</ele></trkpt>
   <trkpt lat="42.2" lon="-8.8"><ele>20</ele></trkpt>
  </trkseg>
  <trkseg>
   <trkpt lat="42.3" lon="-8.9"><ele>30</ele></trkpt>
  </trkseg>
 </trk>
</gpx>`;
    const track = parseGpx(multiSegGpx);
    expect(track.points).toHaveLength(3);
    expect(track.points.map((p) => p.ele)).toEqual([10, 20, 30]);
  });

  it('usa "Ruta sin nombre" si no hay <name>', () => {
    const noNameGpx = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
 <trk><trkseg>
  <trkpt lat="42.21" lon="-8.73"><ele>40</ele></trkpt>
 </trkseg></trk>
</gpx>`;
    const track = parseGpx(noNameGpx);
    expect(track.name).toBe('Ruta sin nombre');
  });

  it('lanza Error si XML malformado', () => {
    expect(() => parseGpx('<gpx><trk>no cerrado')).toThrow();
  });

  it('lanza Error si no hay <trkpt>', () => {
    const empty = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
 <trk><trkseg></trkseg></trk>
</gpx>`;
    expect(() => parseGpx(empty)).toThrow(/sin puntos/i);
  });

  it('lanza Error si lat fuera de rango', () => {
    const badLat = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
 <trk><trkseg>
  <trkpt lat="200" lon="0"><ele>0</ele></trkpt>
 </trkseg></trk>
</gpx>`;
    expect(() => parseGpx(badLat)).toThrow(/lat fuera de rango/i);
  });

  it('lanza Error si elemento raiz no es <gpx>', () => {
    const notGpx = `<?xml version="1.0"?><kml><stuff/></kml>`;
    expect(() => parseGpx(notGpx)).toThrow(/no es un gpx/i);
  });
});
