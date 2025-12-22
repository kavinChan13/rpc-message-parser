import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { messagesAPI } from '../api/client';
import type { RPCMessage } from '../types';
import { format } from 'date-fns';
import { XmlHighlight, xmlStyles } from '../components/XmlViewer';

export default function RPCMessagesPage() {
  const { fileId } = useParams<{ fileId: string }>();
  const [messages, setMessages] = useState<RPCMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 100; // Load more count per request

  // Filters
  const [messageType, setMessageType] = useState('');
  const [direction, setDirection] = useState('');
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState<'default' | 'rt_asc' | 'rt_desc'>('default');

  // Expanded message ID set
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  // Loading message ID set
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  // Loaded message details cache
  const [messageDetails, setMessageDetails] = useState<Map<number, RPCMessage>>(new Map());

  // Scroll loading listener
  const observerTarget = useRef<HTMLDivElement>(null);

  // Load messages
  const loadMessages = useCallback(async (pageNum: number, append: boolean = false) => {
    if (!fileId) return;
    setLoading(true);

    try {
      const data = await messagesAPI.getRPCMessages(
        parseInt(fileId),
        {
          page: pageNum,
          page_size: pageSize,
          message_type: messageType || undefined,
          direction: direction || undefined,
          keyword: keyword || undefined,
          sort_by: sort === 'default' ? undefined : 'response_time',
          sort_order: sort === 'rt_desc' ? 'desc' : 'asc'
        }
      );

      if (append) {
        setMessages(prev => [...prev, ...data.messages]);
      } else {
        setMessages(data.messages);
        setExpandedIds(new Set());
        setMessageDetails(new Map());
      }

      setHasMore(data.messages.length === pageSize);
    } catch (err) {
      console.error(err);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [fileId, messageType, direction, keyword, sort, pageSize]);

  // Initial load
  useEffect(() => {
    setPage(1);
    loadMessages(1, false);
  }, [fileId, messageType, direction, keyword, sort]);

  // Scroll to load more
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1;
          setPage(nextPage);
          loadMessages(nextPage, true);
        }
      },
      { threshold: 0.1 }
    );

    const target = observerTarget.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [hasMore, loading, page, loadMessages]);

  const toggleExpand = async (msgId: number) => {
    const newExpandedIds = new Set(expandedIds);

    if (expandedIds.has(msgId)) {
      // Collapse
      newExpandedIds.delete(msgId);
      setExpandedIds(newExpandedIds);
    } else {
      // Expand
      newExpandedIds.add(msgId);
      setExpandedIds(newExpandedIds);

      // Load details if not loaded yet
      if (!messageDetails.has(msgId) && fileId) {
        setLoadingIds(prev => new Set(prev).add(msgId));
        try {
          const detail = await messagesAPI.getRPCDetail(parseInt(fileId), msgId);
          setMessageDetails(prev => new Map(prev).set(msgId, detail));
        } catch (err) {
          console.error(err);
        } finally {
          setLoadingIds(prev => {
            const next = new Set(prev);
            next.delete(msgId);
            return next;
          });
        }
      }
    }
  };

  const getMessageTypeBadge = (type: string) => {
    switch (type) {
      case 'rpc':
        return <span className="badge badge-rpc">RPC</span>;
      case 'rpc-reply':
        return <span className="badge badge-reply">Reply</span>;
      case 'notification':
        return <span className="badge badge-notification">Notification</span>;
      default:
        return <span className="badge">{type}</span>;
    }
  };

  const getDirectionBadge = (dir: string) => {
    return dir === 'DU->RU' ? (
      <span className="badge badge-du-ru">{dir}</span>
    ) : (
      <span className="badge badge-ru-du">{dir}</span>
    );
  };

  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          to={`/file/${fileId}`}
          className="inline-flex items-center gap-2 text-dark-400 hover:text-primary-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BackFile Details
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">RPC Message List</h1>
          <p className="text-dark-400 mt-1">
            {keyword ? (
              <>
                Search "<span className="text-primary-400">{keyword}</span>" found {messages.length.toLocaleString()} message(s) {hasMore && '(scroll to load more)'}
              </>
            ) : (
              <>
                Loaded {messages.length.toLocaleString()} message(s) {hasMore && '(scroll to load more)'}
              </>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-dark-400" />
            <span className="text-sm text-dark-400">Filter:</span>
          </div>

          <select
            value={messageType}
            onChange={(e) => setMessageType(e.target.value)}
            className="px-3 py-1.5 bg-dark-700 border border-dark-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
          >
            <option value="">All Types</option>
            <option value="rpc">RPC</option>
            <option value="rpc-reply">RPC-Reply</option>
            <option value="notification">Notification</option>
          </select>

          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            className="px-3 py-1.5 bg-dark-700 border border-dark-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
          >
            <option value="">All Directions</option>
            <option value="DU->RU">DU → RU</option>
            <option value="RU->DU">RU → DU</option>
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="px-3 py-1.5 bg-dark-700 border border-dark-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
          >
            <option value="default">Default Sort</option>
            <option value="rt_desc">Response Time ↓</option>
            <option value="rt_asc">Response Time ↑</option>
          </select>

          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="w-4 h-4 text-dark-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search XML content by keyword (e.g., edit-config, ACTIVE, carrier name, etc.)..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-dark-700 border border-dark-600 rounded-lg text-sm text-white placeholder-dark-400 focus:outline-none focus:border-primary-500"
              />
              {keyword && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dark-500">
                  Press Enter to search
                </div>
              )}
            </div>
          </div>

          {(messageType || direction || keyword) && (
            <button
              onClick={() => {
                setMessageType('');
                setDirection('');
                setKeyword('');
                setSort('default');
              }}
              className="text-sm text-dark-400 hover:text-primary-400"
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-dark-800/50 border border-dark-700 rounded-2xl overflow-hidden">
        {messages.length === 0 && !loading ? (
          <div className="flex items-center justify-center py-20 text-dark-400">
            No Data
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-12"></th>
                  <th>Line</th>
                  <th>Time</th>
                  <th>MessageID</th>
                  <th>Direction</th>
                  <th>Type</th>
                  <th>Operation/Notification</th>
                  <th>YANG Module</th>
                  <th>Response Time</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((msg) => (
                  <>
                    <tr
                      key={msg.id}
                      className={`cursor-pointer hover:bg-dark-700/50 transition-colors ${expandedIds.has(msg.id) ? 'bg-dark-700/30' : ''}`}
                      onClick={() => toggleExpand(msg.id)}
                    >
                      <td className="!px-2">
                        <button className="p-1 text-dark-400 hover:text-primary-400 transition-colors">
                          {expandedIds.has(msg.id) ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="text-dark-400 font-mono text-xs">{msg.line_number}</td>
                      <td className="text-dark-300 text-xs whitespace-nowrap">
                        {msg.timestamp ? format(new Date(msg.timestamp), 'HH:mm:ss.SSS') : '-'}
                      </td>
                      <td className="font-mono text-xs text-primary-400">{msg.message_id || '-'}</td>
                      <td>{getDirectionBadge(msg.direction)}</td>
                      <td>{getMessageTypeBadge(msg.message_type)}</td>
                      <td className="text-dark-300 max-w-xs truncate" title={msg.operation || ''}>
                        {msg.operation || '-'}
                      </td>
                      <td className="text-dark-400 text-xs max-w-xs truncate" title={msg.yang_module || ''}>
                        {msg.yang_module || '-'}
                      </td>
                      <td className="text-dark-300">
                        {msg.response_time_ms ? (
                          <span className={`${msg.response_time_ms > 100 ? 'text-amber-400' : 'text-green-400'}`}>
                            {msg.response_time_ms.toFixed(2)} ms
                          </span>
                        ) : '-'}
                      </td>
                    </tr>

                    {/* Expanded details row */}
                    {expandedIds.has(msg.id) && (
                      <tr key={`${msg.id}-detail`} className="bg-dark-900/50">
                        <td colSpan={9} className="!p-0">
                          <div className="p-4 border-t border-dark-700">
                            {loadingIds.has(msg.id) ? (
                              <div className="flex items-center justify-center py-8">
                                <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                                <span className="ml-3 text-dark-400">Loading...</span>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {/* Message metadata */}
                                <div className="flex flex-wrap gap-6 text-sm">
                                  <div>
                                    <span className="text-dark-500">Line:</span>
                                    <span className="ml-2 text-dark-300 font-mono">{msg.line_number}</span>
                                  </div>
                                  <div>
                                    <span className="text-dark-500">MessageID:</span>
                                    <span className="ml-2 text-primary-400 font-mono">{msg.message_id || '-'}</span>
                                  </div>
                                  <div>
                                    <span className="text-dark-500">Time:</span>
                                    <span className="ml-2 text-dark-300">
                                      {msg.timestamp ? format(new Date(msg.timestamp), 'yyyy-MM-dd HH:mm:ss.SSS') : '-'}
                                    </span>
                                  </div>
                                  {msg.response_time_ms && (
                                    <div>
                                      <span className="text-dark-500">Response Time:</span>
                                      <span className={`ml-2 ${msg.response_time_ms > 100 ? 'text-amber-400' : 'text-green-400'}`}>
                                        {msg.response_time_ms.toFixed(2)} ms
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* XML content */}
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs text-dark-500 uppercase tracking-wider">XML Content</span>
                                    <div className="flex-1 h-px bg-dark-700"></div>
                                  </div>
                                  <div className="bg-dark-950 border border-dark-700 rounded-xl overflow-hidden">
                                    {messageDetails.has(msg.id) && messageDetails.get(msg.id)?.xml_content ? (
                                      <XmlHighlight xml={messageDetails.get(msg.id)!.xml_content || ''} />
                                    ) : (
                                      <div className="p-4 text-dark-500 text-sm">No XML content</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Load more indicator */}
        <div ref={observerTarget} className="h-20 flex items-center justify-center border-t border-dark-700">
          {loading && (
            <div className="flex items-center gap-3 text-dark-400">
              <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
              <span>Loading...</span>
            </div>
          )}
          {!loading && !hasMore && messages.length > 0 && (
            <div className="text-dark-500 text-sm">All messages loaded</div>
          )}
        </div>
      </div>

      {/* XML syntax highlighting styles */}
      <style>{xmlStyles}</style>
    </div>
  );
}
