import { useState } from "react";
import { Checkbox, Empty, Space, Typography } from "antd";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import Link from "./ReportLink";
import { NetworkTransect } from "../utils/annualHighlights";
import "leaflet/dist/leaflet.css";

const GROUPS = {
  new: { label: "Primeira época", color: "#bc6b13" },
  veteran: { label: "5 ou mais épocas", color: "#166553" },
  other: { label: "Outros ativos", color: "#65758a" },
};
type Group = keyof typeof GROUPS;
const groupOf = (item: NetworkTransect): Group =>
  item.isNew ? "new" : item.isVeteran ? "veteran" : "other";

export default function AnnualNetworkMap({ network }: { network: NetworkTransect[] }) {
  const [groups, setGroups] = useState<Group[]>(["new", "veteran", "other"]);
  const mappable = network.filter(item => item.metadata?.coordinates);
  const visible = mappable.filter(item => groups.includes(groupOf(item)));
  return (
    <div>
      <Space wrap size={[20, 12]} style={{ marginBottom: 16 }}>
        {(Object.keys(GROUPS) as Group[]).map(group => (
          <Checkbox
            key={group}
            checked={groups.includes(group)}
            onChange={event =>
              setGroups(
                event.target.checked ? [...groups, group] : groups.filter(value => value !== group)
              )
            }
          >
            <span className="annual-map-dot" style={{ background: GROUPS[group].color }} />
            {GROUPS[group].label} ({network.filter(item => groupOf(item) === group).length})
          </Checkbox>
        ))}
      </Space>
      {network.length > 0 ? (
        <MapContainer
          center={[39.6, -8]}
          zoom={6}
          scrollWheelZoom={false}
          style={{ height: 460, width: "100%", borderRadius: 10 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {visible.map(item => (
            <CircleMarker
              key={item.id}
              center={[item.metadata!.coordinates!.lat, item.metadata!.coordinates!.lon]}
              radius={item.isNew ? 7 : 6}
              pathOptions={{
                color: GROUPS[groupOf(item)].color,
                fillColor: GROUPS[groupOf(item)].color,
                fillOpacity: 0.7,
                weight: item.isVeteran ? 3 : 1.5,
              }}
            >
              <Popup>
                <strong>{item.metadata!.transectName}</strong>
                <br />
                {item.metadata!.concelho}
                <br />
                {GROUPS[groupOf(item)].label} · {item.years.length} épocas com registos
                <br />
                {item.speciesCount} espécies · {item.visits} visitas em 2026
                <br />
                <Link to={`/municipality/${encodeURIComponent(item.metadata!.concelho)}`}>
                  Explorar o concelho
                </Link>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      ) : (
        <Empty description="Sem visitas registadas em 2026" />
      )}
      <Typography.Paragraph className="annual-note">
        {visible.length} de {network.length} transectos apresentados.{" "}
        {network.length - mappable.length > 0 &&
          `${network.length - mappable.length} sem metadados ou coordenadas disponíveis.`}{" "}
        Localizações aproximadas. «5 ou mais épocas» conta anos distintos com registos, que podem
        não ser consecutivos. A primeira época refere-se aos dados disponíveis.
      </Typography.Paragraph>
    </div>
  );
}
