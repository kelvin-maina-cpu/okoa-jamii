'use client';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapIncident { id: string; incidentType: string; status: string; coordinates?: [number, number] | null; location?: { latitude: number; longitude: number } | null }
export default function IncidentMap({ incidents, onSelect }: { incidents: MapIncident[]; onSelect: (id: string) => void }) {
  const located = incidents.filter((i) => i.coordinates?.length === 2 || i.location);
  const first = located[0];
  const center: [number, number] = first ? (first.coordinates ? [first.coordinates[1], first.coordinates[0]] : [first.location!.latitude, first.location!.longitude]) : [0.0236, 37.9062];
  return <MapContainer center={center} zoom={first ? 8 : 5} scrollWheelZoom className="h-80 w-full rounded-xl">
    <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    {located.map((i) => { const pos: [number, number] = i.coordinates ? [i.coordinates[1], i.coordinates[0]] : [i.location!.latitude, i.location!.longitude]; return <CircleMarker key={i.id} center={pos} radius={9} pathOptions={{ color: i.status === 'escalated' ? '#b91c1c' : '#0f766e' }} eventHandlers={{ click: () => onSelect(i.id) }}><Popup><button onClick={() => onSelect(i.id)} className="font-semibold">{i.incidentType} · {i.status}</button></Popup></CircleMarker>; })}
  </MapContainer>;
}
