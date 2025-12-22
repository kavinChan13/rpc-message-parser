import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Radio, Activity, Zap, Link2, Plus, Pencil, Trash2,
  RefreshCw, Search, Eye, ChevronDown, ChevronUp, Clock
} from 'lucide-react';
import { carriersAPI } from '../api/client';
import type { CarrierEvent, CarrierStatistics } from '../types';
import { format } from 'date-fns';
import { XmlHighlight, xmlStyles } from '../components/XmlViewer';

// Carrier Type显示Name和颜色
const CARRIER_TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  'rx-array-carriers': { label: 'RX Array', color: '#22d3ee', bgColor: 'rgba(34, 211, 238, 0.15)' },
  'tx-array-carriers': { label: 'TX Array', color: '#a78bfa', bgColor: 'rgba(167, 139, 250, 0.15)' },
  'low-level-rx-links': { label: 'RX Link', color: '#4ade80', bgColor: 'rgba(74, 222, 128, 0.15)' },
  'low-level-tx-links': { label: 'TX Link', color: '#fb923c', bgColor: 'rgba(251, 146, 60, 0.15)' },
  'low-level-rx-endpoints': { label: 'RX Endpoint', color: '#f472b6', bgColor: 'rgba(244, 114, 182, 0.15)' },
  'low-level-tx-endpoints': { label: 'TX Endpoint', color: '#facc15', bgColor: 'rgba(250, 204, 21, 0.15)' },
};

// Event Type图标和颜色
const EVENT_TYPE_CONFIG: Record<string, { icon: typeof Plus; color: string; label: string }> = {
  'create': { icon: Plus, color: '#22c55e', label: 'Create' },
  'update': { icon: Pencil, color: '#3b82f6', label: 'Update' },
  'delete': { icon: Trash2, color: '#ef4444', label: 'Delete' },
  'state-change': { icon: RefreshCw, color: '#f59e0b', label: 'State Change' },
  'query': { icon: Search, color: '#8b5cf6', label: 'Query' },
  'data': { icon: Eye, color: '#06b6d4', label: 'Data' },
};

// SVG 饼图组件
function PieChart({ data, size = 180 }: { data: { name: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;

  let currentAngle = -90;
  const radius = size / 2 - 10;
  const center = size / 2;

  return (
    <svg width={size} height={size} className="drop-shadow-lg">
      {data.map((item, index) => {
        const percentage = item.value / total;
        const angle = percentage * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;
        currentAngle = endAngle;

        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;

        const x1 = center + radius * Math.cos(startRad);
        const y1 = center + radius * Math.sin(startRad);
        const x2 = center + radius * Math.cos(endRad);
        const y2 = center + radius * Math.sin(endRad);

        const largeArc = angle > 180 ? 1 : 0;

        const pathData = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

        return (
          <path
            key={index}
            d={pathData}
            fill={item.color}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth="1"
            className="transition-all duration-300 hover:opacity-80 cursor-pointer"
          >
            <title>{item.name}: {item.value} ({(percentage * 100).toFixed(1)}%)</title>
          </path>
        );
      })}
      {/* 中心圆 */}
      <circle cx={center} cy={center} r={radius * 0.5} fill="#1a1a2e" />
      <text x={center} y={center - 8} textAnchor="middle" fill="#fff" fontSize="20" fontWeight="bold">
        {total}
      </text>
      <text x={center} y={center + 12} textAnchor="middle" fill="#94a3b8" fontSize="11">
        事件总数
      </text>
    </svg>
  );
}

// 水平条形图组件
function BarChart({ data, maxValue }: { data: { name: string; value: number; color: string }[]; maxValue?: number }) {
  const max = maxValue || Math.max(...data.map(d => d.value));

  return (
    <div className="space-y-3">
      {data.map((item, index) => (
        <div key={index} className="group">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-dark-300 truncate" title={item.name}>{item.name}</span>
            <span className="text-sm font-semibold" style={{ color: item.color }}>{item.value}</span>
          </div>
          <div className="h-3 bg-dark-700/50 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 group-hover:brightness-110"
              style={{
                width: `${(item.value / max) * 100}%`,
                background: `linear-gradient(90deg, ${item.color}, ${item.color}dd)`
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Time线事件点组件
function TimelineEvent({
  event,
  isFirst: _isFirst, // 保留参数供未来使用
  isLast,
  fileId,
  expanded,
  onToggle
}: {
  event: CarrierEvent;
  isFirst: boolean;
  isLast: boolean;
  fileId: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const config = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG['update'];
  const Icon = config.icon;
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<CarrierEvent | null>(null);

  const loadDetail = async () => {
    if (detail) return; // 已加载
    setLoading(true);
    try {
      const data = await carriersAPI.getEventDetail(fileId, event.id);
      setDetail(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (!expanded) {
      loadDetail();
    }
    onToggle();
  };

  return (
    <div className="flex gap-4 relative">
      {/* 连接线 */}
      {!isLast && (
        <div
          className="absolute left-[19px] top-10 w-0.5 h-full -translate-x-1/2"
          style={{ background: `linear-gradient(180deg, ${config.color}60, transparent)` }}
        />
      )}

      {/* 图标 */}
      <div
        className="relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-lg"
        style={{ backgroundColor: config.color + '30', border: `2px solid ${config.color}` }}
      >
        <Icon className="w-4 h-4" style={{ color: config.color }} />
      </div>

      {/* 内容 */}
      <div className="flex-1 pb-6">
        <div className="bg-dark-800/60 border border-dark-700 rounded-xl p-4 hover:border-dark-600 transition-colors">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: config.color + '20', color: config.color }}
              >
                {config.label}
              </span>
              <h4 className="font-medium text-white mt-2">{event.carrier_name}</h4>
              <p className="text-sm text-dark-400 mt-1">
                {CARRIER_TYPE_CONFIG[event.carrier_type]?.label || event.carrier_type}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-dark-400">
                {event.timestamp ? format(new Date(event.timestamp), 'HH:mm:ss.SSS') : '-'}
              </div>
              {event.state && (
                <div className="mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    event.state.toUpperCase().includes('ACTIVE') || event.state.toUpperCase() === 'READY'
                      ? 'bg-green-500/20 text-green-400'
                      : event.state.toUpperCase().includes('INACTIVE') || event.state.toUpperCase() === 'DISABLED'
                        ? 'bg-gray-500/20 text-gray-400'
                        : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {event.state}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-dark-500">
            <span className={`${event.direction === 'DU->RU' ? 'text-cyan-400' : 'text-orange-400'}`}>
              {event.direction}
            </span>
            <span>行 {event.line_number}</span>
            <button
              onClick={handleToggle}
              className="ml-auto flex items-center gap-1 px-2 py-1 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors text-dark-300 hover:text-white"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  查看 XML
                </>
              )}
            </button>
          </div>

          {/* Expand的 XML 内容 */}
          {expanded && (
            <div className="mt-4 pt-4 border-t border-dark-700">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                  <span className="ml-3 text-dark-400">Loading...</span>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-dark-500 uppercase tracking-wider">Raw XML Message</span>
                    <div className="flex-1 h-px bg-dark-700"></div>
                  </div>
                  <div className="bg-dark-950 border border-dark-700 rounded-xl overflow-hidden">
                    {detail?.xml_content ? (
                      <XmlHighlight xml={detail.xml_content} />
                    ) : (
                      <div className="p-4 text-dark-500 text-sm">无 XML 内容</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Carrier 卡片组件
function CarrierCard({
  carrierName,
  events,
  onViewTimeline
}: {
  carrierName: string;
  events: CarrierEvent[];
  onViewTimeline: () => void;
}) {
  const carrierType = events[0]?.carrier_type;
  const config = CARRIER_TYPE_CONFIG[carrierType] || { label: carrierType, color: '#94a3b8', bgColor: 'rgba(148, 163, 184, 0.15)' };

  const eventCounts = events.reduce((acc, e) => {
    acc[e.event_type] = (acc[e.event_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const latestState = events.find(e => e.state)?.state;
  const firstEvent = events[events.length - 1];
  const lastEvent = events[0];

  return (
    <div
      className="bg-dark-800/50 border border-dark-700 rounded-2xl p-5 hover:border-dark-600 transition-all cursor-pointer group"
      onClick={onViewTimeline}
      style={{ borderLeftColor: config.color, borderLeftWidth: '3px' }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: config.bgColor }}
          >
            {carrierType?.includes('array') ? <Radio className="w-6 h-6" style={{ color: config.color }} /> :
             carrierType?.includes('link') ? <Link2 className="w-6 h-6" style={{ color: config.color }} /> :
             <Zap className="w-6 h-6" style={{ color: config.color }} />}
          </div>
          <div>
            <h3 className="font-semibold text-white group-hover:text-primary-400 transition-colors truncate max-w-[200px]" title={carrierName}>
              {carrierName}
            </h3>
            <p className="text-sm text-dark-400">{config.label}</p>
          </div>
        </div>
        {latestState && (
          <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
            latestState.toUpperCase().includes('ACTIVE') || latestState.toUpperCase() === 'READY'
              ? 'bg-green-500/20 text-green-400'
              : latestState.toUpperCase().includes('INACTIVE') || latestState.toUpperCase() === 'DISABLED'
                ? 'bg-gray-500/20 text-gray-400'
                : 'bg-amber-500/20 text-amber-400'
          }`}>
            {latestState}
          </span>
        )}
      </div>

      {/* 事件统计 */}
      <div className="flex gap-2 mt-4 flex-wrap">
        {Object.entries(eventCounts).map(([type, count]) => {
          const eventConfig = EVENT_TYPE_CONFIG[type];
          return (
            <span
              key={type}
              className="text-xs px-2 py-1 rounded-lg flex items-center gap-1"
              style={{ backgroundColor: eventConfig?.color + '20', color: eventConfig?.color }}
            >
              {eventConfig?.label || type}: {count}
            </span>
          );
        })}
      </div>

      {/* Time范围 */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-dark-700/50 text-xs text-dark-500">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {firstEvent?.timestamp ? format(new Date(firstEvent.timestamp), 'HH:mm:ss') : '-'}
        </div>
        <div className="flex-1 h-px bg-dark-700 mx-3" />
        <div>{lastEvent?.timestamp ? format(new Date(lastEvent.timestamp), 'HH:mm:ss') : '-'}</div>
      </div>
    </div>
  );
}

export default function CarriersPage() {
  const { fileId } = useParams<{ fileId: string }>();
  const [events, setEvents] = useState<CarrierEvent[]>([]);
  const [statistics, setStatistics] = useState<CarrierStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCarrier, setSelectedCarrier] = useState<string | null>(null);
  const [expandedEventIds, setExpandedEventIds] = useState<Set<number>>(new Set());

  const fileIdNum = useMemo(() => {
    if (!fileId) return null;
    const n = Number(fileId);
    return Number.isFinite(n) ? n : null;
  }, [fileId]);

  useEffect(() => {
    if (!fileIdNum) return;
    loadData();
  }, [fileIdNum]);

  const loadData = async () => {
    if (!fileIdNum) {
      setError(`无效的 fileId: ${String(fileId)}`);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [eventsResult, statsResult] = await Promise.allSettled([
        carriersAPI.getEvents(fileIdNum, { page: 1, page_size: 500 }),
        carriersAPI.getStatistics(fileIdNum)
      ]);

      if (eventsResult.status === 'fulfilled') {
        setEvents(eventsResult.value.events || []);
      } else {
        setEvents([]);
      }

      if (statsResult.status === 'fulfilled') {
        setStatistics(statsResult.value || null);
      } else {
        setStatistics(null);
      }

      if (eventsResult.status === 'rejected' || statsResult.status === 'rejected') {
        const errs: string[] = [];
        const toMsg = (e: unknown, label: string) => {
          const anyErr = e as any;
          const status = anyErr?.response?.status;
          const detail = anyErr?.response?.data?.detail ?? anyErr?.response?.data;
          const msg = anyErr?.message;
          const url = anyErr?.config?.url;
          const params = anyErr?.config?.params;

          const formatAny = (v: any) => {
            if (v == null) return null;
            if (typeof v === 'string') return v;
            try {
              return JSON.stringify(v);
            } catch {
              return String(v);
            }
          };

          return [
            url ? `${label} url=${url}` : null,
            params ? `${label} params=${formatAny(params)}` : null,
            status ? `HTTP ${status}` : null,
            detail ? formatAny(detail) : null,
            msg ? String(msg) : null
          ].filter(Boolean).join(' - ') || '请求失败';
        };

        if (eventsResult.status === 'rejected') errs.push(toMsg(eventsResult.reason, 'events'));
        if (statsResult.status === 'rejected') errs.push(toMsg(statsResult.reason, 'statistics'));
        setError(errs.join(' | '));
      }
    } catch (err) {
      console.error(err);
      const anyErr = err as any;
      const status = anyErr?.response?.status;
      const detail = anyErr?.response?.data?.detail ?? anyErr?.response?.data;
      const msg = anyErr?.message;
      const url = anyErr?.config?.url;
      const params = anyErr?.config?.params;
      const formatAny = (v: any) => {
        if (v == null) return null;
        if (typeof v === 'string') return v;
        try {
          return JSON.stringify(v);
        } catch {
          return String(v);
        }
      };
      setError([
        url ? `url=${url}` : null,
        params ? `params=${formatAny(params)}` : null,
        status ? `HTTP ${status}` : null,
        detail ? formatAny(detail) : null,
        msg ? String(msg) : null
      ].filter(Boolean).join(' - ') || '请求失败');
    } finally {
      setLoading(false);
    }
  };

  // 按 carrier Name分组
  const carrierGroups = useMemo(() => {
    const groups: Record<string, CarrierEvent[]> = {};
    events.forEach(event => {
      if (!groups[event.carrier_name]) {
        groups[event.carrier_name] = [];
      }
      groups[event.carrier_name].push(event);
    });
    // 按事件数量排序
    return Object.entries(groups)
      .sort((a, b) => b[1].length - a[1].length);
  }, [events]);

  // 准备图表Data
  const pieData = useMemo(() => {
    if (!statistics) return [];
    return Object.entries(statistics.by_carrier_type).map(([type, count]) => ({
      name: CARRIER_TYPE_CONFIG[type]?.label || type,
      value: count,
      color: CARRIER_TYPE_CONFIG[type]?.color || '#94a3b8'
    }));
  }, [statistics]);

  const eventTypeData = useMemo(() => {
    if (!statistics) return [];
    return Object.entries(statistics.by_event_type).map(([type, count]) => ({
      name: EVENT_TYPE_CONFIG[type]?.label || type,
      value: count,
      color: EVENT_TYPE_CONFIG[type]?.color || '#94a3b8'
    }));
  }, [statistics]);

  const selectedCarrierEvents = useMemo(() => {
    if (!selectedCarrier) return [];
    return events
      .filter(e => e.carrier_name === selectedCarrier)
      .sort((a, b) => a.line_number - b.line_number);
  }, [events, selectedCarrier]);

  const toggleEventExpand = (eventId: number) => {
    setExpandedEventIds(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-3 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-red-300">Carrier Data加载失败</div>
              <div className="text-xs text-red-200/80 mt-1 break-words">{error}</div>
              <div className="text-xs text-dark-400 mt-2">
                请确认你已登录、后端在 `localhost:8000` 运行，并打开浏览器 DevTools → Network 查看 `/api/carriers/*` 是否请求成功。
              </div>
            </div>
            <button
              onClick={loadData}
              className="shrink-0 px-3 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <Link
          to={`/file/${fileId}`}
          className="inline-flex items-center gap-2 text-dark-400 hover:text-primary-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BackFile Details
        </Link>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary-500/20 to-purple-500/20 rounded-xl">
              <Radio className="w-8 h-8 text-primary-400" />
            </div>
            Carrier Tracking
          </h1>
          <p className="text-dark-400 mt-2">
            可视化分析 Array Carriers、Endpoints、Links 的生命周期
          </p>
        </div>

        {selectedCarrier && (
          <button
            onClick={() => { setSelectedCarrier(null); setExpandedEventIds(new Set()); }}
            className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
          >
            Back概览
          </button>
        )}
      </div>

      {statistics && statistics.total_events > 0 ? (
        selectedCarrier ? (
          // Carrier Time线视图
          <div>
            <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-6 mb-6">
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: CARRIER_TYPE_CONFIG[selectedCarrierEvents[0]?.carrier_type]?.bgColor || 'rgba(148, 163, 184, 0.15)'
                  }}
                >
                  <Radio className="w-7 h-7" style={{
                    color: CARRIER_TYPE_CONFIG[selectedCarrierEvents[0]?.carrier_type]?.color || '#94a3b8'
                  }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedCarrier}</h2>
                  <p className="text-dark-400">
                    {CARRIER_TYPE_CONFIG[selectedCarrierEvents[0]?.carrier_type]?.label || selectedCarrierEvents[0]?.carrier_type}
                    <span className="mx-2">•</span>
                    {selectedCarrierEvents.length} 个事件
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-dark-800/30 border border-dark-700 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary-400" />
                Event Timeline
              </h3>
              <div className="max-h-[600px] overflow-y-auto pr-2">
                {selectedCarrierEvents.map((event, index) => (
                  <TimelineEvent
                    key={event.id}
                    event={event}
                    isFirst={index === 0}
                    isLast={index === selectedCarrierEvents.length - 1}
                    fileId={fileIdNum!}
                    expanded={expandedEventIds.has(event.id)}
                    onToggle={() => toggleEventExpand(event.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          // 概览视图
          <>
            {/* 统计图表 */}
            <div className="grid lg:grid-cols-3 gap-6 mb-8">
              {/* 饼图 - Carrier Type分布 */}
              <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Carrier Type分布</h3>
                <div className="flex justify-center">
                  <PieChart data={pieData} />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {pieData.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-dark-400 truncate">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 条形图 - Event Type分布 */}
              <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Event Type分布</h3>
                <BarChart data={eventTypeData} />
              </div>

              {/* 统计卡片 */}
              <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">快速统计</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-dark-700/30 rounded-xl">
                    <span className="text-dark-400">总事件数</span>
                    <span className="text-2xl font-bold text-white">{statistics.total_events}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-dark-700/30 rounded-xl">
                    <span className="text-dark-400">Carrier 数量</span>
                    <span className="text-2xl font-bold text-primary-400">{statistics.carrier_names.length}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-dark-700/30 rounded-xl">
                    <span className="text-dark-400">Type数量</span>
                    <span className="text-2xl font-bold text-purple-400">{Object.keys(statistics.by_carrier_type).length}</span>
                  </div>
                  {Object.entries(statistics.by_state || {}).length > 0 && (
                    <div className="p-3 bg-dark-700/30 rounded-xl">
                      <div className="text-dark-400 mb-2">Status分布</div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(statistics.by_state).slice(0, 4).map(([state, count]) => (
                          <span key={state} className="text-xs px-2 py-1 bg-dark-600 rounded text-dark-300">
                            {state}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Carrier 卡片网格 */}
            <div className="bg-dark-800/30 border border-dark-700 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <Radio className="w-5 h-5 text-primary-400" />
                所有 Carriers ({carrierGroups.length})
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {carrierGroups.map(([name, groupEvents]) => (
                  <CarrierCard
                    key={name}
                    carrierName={name}
                    events={groupEvents}
                    onViewTimeline={() => setSelectedCarrier(name)}
                  />
                ))}
              </div>
            </div>
          </>
        )
      ) : (
        // 空Status
        <div className="bg-dark-800/30 border border-dark-700 rounded-2xl p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-dark-700/50 rounded-full flex items-center justify-center mb-6">
              <Radio className="w-10 h-10 text-dark-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">未找到 Carrier 事件</h3>
            <p className="text-dark-400 max-w-md">
              请确保日志中包含 array-carriers、low-level-endpoints 或 low-level-links 相关的 NETCONF Message
            </p>
          </div>
        </div>
      )}

      {/* XML 语法高亮Styles */}
      <style>{xmlStyles}</style>
    </div>
  );
}
