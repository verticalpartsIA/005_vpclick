// View "Mapa" (issue #193). Mostra um pin por tarefa que tem um valor
// geocodificado num Campo Personalizado do tipo "Localização" — só entre as
// tarefas já carregadas no escopo atual (`tasks`, já filtrado por RLS pelo
// resto do app, igual às outras views), sem nenhuma consulta nova que
// exponha tarefa fora do que o usuário já pode ver.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_TOKEN } from '../../lib/mapbox';
import { Icons } from '../../constants';
import {
  Task, User, List, StatusGroup, CustomField, CustomFieldValue, CustomFieldType, TaskPriority,
} from '../../types';

interface MapViewProps {
  tasks: Task[];
  users: User[];
  lists: List[];
  statusGroups: StatusGroup[];
  customFields: CustomField[];
  fieldValues: CustomFieldValue[];
  onTaskClick: (taskId: string) => void;
}

interface PinTask {
  task: Task;
  lat: number;
  lng: number;
  address: string;
}

const PRIORITY_ORDER = [TaskPriority.URGENTE, TaskPriority.ALTA, TaskPriority.MEDIA, TaskPriority.BAIXA];

export function MapView({ tasks, users, lists, statusGroups, customFields, fieldValues, onTaskClick }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');

  const locationFieldIds = useMemo(
    () => new Set(customFields.filter((f) => f.type === CustomFieldType.LOCATION).map((f) => f.id)),
    [customFields]
  );

  const valuesByEntity = useMemo(() => {
    const map = new Map<string, CustomFieldValue[]>();
    for (const fv of fieldValues) {
      if (!locationFieldIds.has(fv.fieldId)) continue;
      const list = map.get(fv.entityId) || [];
      list.push(fv);
      map.set(fv.entityId, list);
    }
    return map;
  }, [fieldValues, locationFieldIds]);

  const allPins: PinTask[] = useMemo(() => {
    const pins: PinTask[] = [];
    for (const task of tasks) {
      const values = valuesByEntity.get(task.id);
      if (!values) continue;
      const withCoords = values.find((v) => v.value && typeof v.value.lat === 'number' && typeof v.value.lng === 'number');
      if (!withCoords) continue;
      pins.push({ task, lat: withCoords.value.lat, lng: withCoords.value.lng, address: withCoords.value.address || '' });
    }
    return pins;
  }, [tasks, valuesByEntity]);

  const filteredPins = useMemo(() => {
    return allPins.filter(({ task }) => {
      if (statusFilter && task.status !== statusFilter) return false;
      if (priorityFilter && task.priority !== priorityFilter) return false;
      if (assigneeFilter && task.mainAssigneeId !== assigneeFilter) return false;
      return true;
    });
  }, [allPins, statusFilter, priorityFilter, assigneeFilter]);

  const statusOptions = useMemo(() => statusGroups.flatMap((g) => g.options), [statusGroups]);

  // Inicializa o mapa uma única vez.
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !MAPBOX_TOKEN) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-46.63, -23.55], // São Paulo como centro padrão até os pins carregarem
      zoom: 3,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Atualiza a fonte de dados (clustering) sempre que os pins filtrados mudam.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: filteredPins.map(({ task, lat, lng, address }) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { taskId: task.id, title: task.title, address },
      })),
    };

    const applySource = () => {
      const source = map.getSource('tasks') as mapboxgl.GeoJSONSource | undefined;
      if (source) {
        source.setData(geojson as any);
        return;
      }
      map.addSource('tasks', {
        type: 'geojson',
        data: geojson as any,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'tasks',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#ffce05',
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 30, 28],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#161616',
        },
      });
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'tasks',
        filter: ['has', 'point_count'],
        layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 12, 'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'] },
        paint: { 'text-color': '#161616' },
      });
      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'tasks',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#f97316',
          'circle-radius': 8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        const clusterId = features[0]?.properties?.cluster_id;
        const src = map.getSource('tasks') as mapboxgl.GeoJSONSource;
        if (clusterId == null) return;
        src.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;
          map.easeTo({ center: (features[0].geometry as any).coordinates, zoom: zoom ?? map.getZoom() + 1 });
        });
      });

      map.on('click', 'unclustered-point', (e) => {
        const feature = e.features?.[0];
        const taskId = feature?.properties?.taskId;
        if (taskId) onTaskClick(taskId);
      });

      map.on('mouseenter', 'unclustered-point', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const feature = e.features?.[0];
        if (!feature) return;
        const coords = (feature.geometry as any).coordinates.slice();
        popupRef.current?.remove();
        popupRef.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12 })
          .setLngLat(coords)
          .setHTML(`<div style="font-size:12px;font-weight:600;color:#161616">${escapeHtml(feature.properties?.title || '')}</div><div style="font-size:11px;color:#6b7280">${escapeHtml(feature.properties?.address || '')}</div>`)
          .addTo(map);
      });
      map.on('mouseleave', 'unclustered-point', () => {
        map.getCanvas().style.cursor = '';
        popupRef.current?.remove();
        popupRef.current = null;
      });
      map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = ''; });
    };

    if (map.isStyleLoaded()) {
      applySource();
    } else {
      map.once('load', applySource);
    }
  }, [filteredPins, onTaskClick]);

  // Ajusta o enquadramento pros pins visíveis quando eles mudam.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || filteredPins.length === 0) return;
    const run = () => {
      if (filteredPins.length === 1) {
        map.easeTo({ center: [filteredPins[0].lng, filteredPins[0].lat], zoom: 12 });
        return;
      }
      const bounds = new mapboxgl.LngLatBounds();
      filteredPins.forEach((p) => bounds.extend([p.lng, p.lat]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 0 });
    };
    if (map.isStyleLoaded()) run(); else map.once('load', run);
  }, [filteredPins]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center text-gray-500">
        <Icons.MapPin className="w-8 h-8 text-gray-300 mb-2" />
        <p className="text-sm font-medium">Mapa não configurado.</p>
        <p className="text-xs mt-1">Faltando VITE_MAPBOX_TOKEN.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 text-xs rounded-md border border-gray-200 bg-white px-2 text-gray-700"
        >
          <option value="">Todos os status</option>
          {statusOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="h-8 text-xs rounded-md border border-gray-200 bg-white px-2 text-gray-700"
        >
          <option value="">Todas as prioridades</option>
          {PRIORITY_ORDER.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="h-8 text-xs rounded-md border border-gray-200 bg-white px-2 text-gray-700"
        >
          <option value="">Todos os responsáveis</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <span className="text-xs text-gray-400 ml-auto">{filteredPins.length} de {allPins.length} tarefa(s) com localização</span>
      </div>

      {allPins.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center text-gray-500 border rounded-lg bg-gray-50">
          <Icons.MapPin className="w-8 h-8 text-gray-300 mb-2" />
          <p className="text-sm font-medium">Nenhuma tarefa com localização neste escopo.</p>
          <p className="text-xs mt-1">Adicione um Campo Personalizado do tipo "Localização" às tarefas para vê-las aqui.</p>
        </div>
      ) : (
        <div ref={containerRef} className="flex-1 min-h-[420px] rounded-lg border border-gray-200 overflow-hidden" />
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
