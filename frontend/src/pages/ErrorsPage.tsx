import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Filter, AlertTriangle, AlertCircle, Bell, ChevronDown, ChevronUp } from 'lucide-react';
import { messagesAPI } from '../api/client';
import type { ErrorMessage } from '../types';
import { format } from 'date-fns';
import { XmlHighlight, xmlStyles } from '../components/XmlViewer';

export default function ErrorsPage() {
  const { fileId } = useParams<{ fileId: string }>();
  const [messages, setMessages] = useState<ErrorMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 100;

  // Filters
  const [errorType, setErrorType] = useState('');

  // Expand的MessageID集合
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  // Loading message ID set
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  // Loaded message details cache
  const [messageDetails, setMessageDetails] = useState<Map<number, ErrorMessage>>(new Map());

  // Scroll loading listener
  const observerTarget = useRef<HTMLDivElement>(null);

  // 加载Message
  const loadMessages = useCallback(async (pageNum: number, append: boolean = false) => {
    if (!fileId) return;
    setLoading(true);

    try {
      const data = await messagesAPI.getErrors(
        parseInt(fileId),
        {
          page: pageNum,
          page_size: pageSize,
          error_type: errorType || undefined
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
  }, [fileId, errorType, pageSize]);

  // Initial load
  useEffect(() => {
    setPage(1);
    loadMessages(1, false);
  }, [fileId, errorType]);

  // 滚动Load More
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
      // 折叠
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
          const detail = await messagesAPI.getErrorDetail(parseInt(fileId), msgId);
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

  const getErrorTypeBadge = (type: string) => {
    switch (type) {
      case 'rpc-error':
        return (
          <span className="badge badge-error flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            RPCError
          </span>
        );
      case 'fault':
        return (
          <span className="badge badge-warning flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            告警
          </span>
        );
      case 'warning':
        return (
          <span className="badge flex items-center gap-1 bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Bell className="w-3 h-3" />
            警告
          </span>
        );
      default:
        return <span className="badge">{type}</span>;
    }
  };

  const getSeverityBadge = (severity: string | undefined) => {
    if (!severity) return null;

    const colors: Record<string, string> = {
      'critical': 'badge-error',
      'major': 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
      'minor': 'badge-warning',
      'warning': 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
      'error': 'badge-error'
    };

    return (
      <span className={`badge ${colors[severity.toLowerCase()] || ''}`}>
        {severity}
      </span>
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
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <AlertTriangle className="w-7 h-7 text-red-400" />
            Errors and Alarms
          </h1>
          <p className="text-dark-400 mt-1">
            Loaded {messages.length.toLocaleString()} records {hasMore && '(scroll to load more)'}
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
            value={errorType}
            onChange={(e) => setErrorType(e.target.value)}
            className="px-3 py-1.5 bg-dark-700 border border-dark-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
          >
            <option value="">所有Type</option>
            <option value="rpc-error">RPC Error</option>
            <option value="fault">告警 (Fault)</option>
            <option value="warning">警告</option>
          </select>

          {errorType && (
            <button
              onClick={() => setErrorType('')}
              className="text-sm text-dark-400 hover:text-primary-400"
            >
              清除Filter
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-dark-800/50 border border-dark-700 rounded-2xl overflow-hidden">
        {messages.length === 0 && !loading ? (
          <div className="text-center py-20 text-dark-400">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-dark-600" />
            <p>No errors or alarm records</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-12"></th>
                  <th>行号</th>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Error标签</th>
                  <th>ErrorMessage</th>
                  <th>故障ID</th>
                  <th>Status</th>
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
                      <td>{getErrorTypeBadge(msg.error_type)}</td>
                      <td>{getSeverityBadge(msg.error_severity)}</td>
                      <td className="text-dark-300 text-sm">{msg.error_tag || '-'}</td>
                      <td className="text-dark-300 text-sm max-w-xs truncate" title={msg.error_message || ''}>
                        {msg.error_message || '-'}
                      </td>
                      <td className="text-dark-400 font-mono text-xs">{msg.fault_id || '-'}</td>
                      <td>
                        {msg.error_type === 'fault' && (
                          msg.is_cleared ? (
                            <span className="badge badge-success">Cleared</span>
                          ) : (
                            <span className="badge badge-error">Active</span>
                          )
                        )}
                      </td>
                    </tr>

                    {/* Expand的Details行 */}
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
                                {/* Error metadata */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                  <div>
                                    <div className="text-xs text-dark-500 mb-1">行号</div>
                                    <div className="text-white font-mono">{msg.line_number}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-dark-500 mb-1">Time</div>
                                    <div className="text-white">
                                      {msg.timestamp ? format(new Date(msg.timestamp), 'yyyy-MM-dd HH:mm:ss.SSS') : '-'}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-dark-500 mb-1">Type</div>
                                    <div>{getErrorTypeBadge(msg.error_type)}</div>
                                  </div>
                                  {msg.error_severity && (
                                    <div>
                                      <div className="text-xs text-dark-500 mb-1">Severity</div>
                                      <div>{getSeverityBadge(msg.error_severity)}</div>
                                    </div>
                                  )}
                                  {msg.error_tag && (
                                    <div>
                                      <div className="text-xs text-dark-500 mb-1">Error标签</div>
                                      <div className="text-white">{msg.error_tag}</div>
                                    </div>
                                  )}
                                  {msg.fault_id && (
                                    <div>
                                      <div className="text-xs text-dark-500 mb-1">故障ID</div>
                                      <div className="text-primary-400 font-mono">{msg.fault_id}</div>
                                    </div>
                                  )}
                                  {msg.fault_source && (
                                    <div>
                                      <div className="text-xs text-dark-500 mb-1">Fault Source</div>
                                      <div className="text-white">{msg.fault_source}</div>
                                    </div>
                                  )}
                                  {msg.error_type === 'fault' && (
                                    <div>
                                      <div className="text-xs text-dark-500 mb-1">Status</div>
                                      <div>
                                        {msg.is_cleared ? (
                                          <span className="badge badge-success">Cleared</span>
                                        ) : (
                                          <span className="badge badge-error">Active</span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* ErrorMessage */}
                                {msg.error_message && (
                                  <div>
                                    <div className="text-xs text-dark-500 mb-2">ErrorMessage</div>
                                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300">
                                      {msg.error_message}
                                    </div>
                                  </div>
                                )}

                                {/* XML 内容 */}
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs text-dark-500 uppercase tracking-wider">XML 内容</span>
                                    <div className="flex-1 h-px bg-dark-700"></div>
                                  </div>
                                  <div className="bg-dark-950 border border-dark-700 rounded-xl overflow-hidden">
                                    {messageDetails.has(msg.id) && messageDetails.get(msg.id)?.xml_content ? (
                                      <XmlHighlight xml={messageDetails.get(msg.id)!.xml_content || ''} />
                                    ) : (
                                      <div className="p-4 text-dark-500 text-sm">无 XML 内容</div>
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
            <div className="text-dark-500 text-sm">All records loaded</div>
          )}
        </div>
      </div>

      {/* XML syntax highlighting styles */}
      <style>{xmlStyles}</style>
    </div>
  );
}
