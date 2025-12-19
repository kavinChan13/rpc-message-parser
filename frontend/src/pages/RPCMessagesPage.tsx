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
  const pageSize = 100; // 每次加载更多条

  // Filters
  const [messageType, setMessageType] = useState('');
  const [direction, setDirection] = useState('');
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState<'default' | 'rt_asc' | 'rt_desc'>('default');

  // 展开的消息ID集合
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  // 加载中的消息ID集合
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  // 已加载的消息详情缓存
  const [messageDetails, setMessageDetails] = useState<Map<number, RPCMessage>>(new Map());

  // 滚动加载监听
  const observerTarget = useRef<HTMLDivElement>(null);

  // 加载消息
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

  // 初始加载
  useEffect(() => {
    setPage(1);
    loadMessages(1, false);
  }, [fileId, messageType, direction, keyword, sort]);

  // 滚动加载更多
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
      // 展开
      newExpandedIds.add(msgId);
      setExpandedIds(newExpandedIds);

      // 如果还没有加载过详情，则加载
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
        return <span className="badge badge-reply">响应</span>;
      case 'notification':
        return <span className="badge badge-notification">通知</span>;
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
          返回文件详情
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">RPC 消息列表</h1>
          <p className="text-dark-400 mt-1">
            {keyword ? (
              <>
                搜索 "<span className="text-primary-400">{keyword}</span>" 找到 {messages.length.toLocaleString()} 条消息 {hasMore && '(滚动加载更多)'}
              </>
            ) : (
              <>
                已加载 {messages.length.toLocaleString()} 条消息 {hasMore && '(滚动加载更多)'}
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
            <span className="text-sm text-dark-400">筛选:</span>
          </div>

          <select
            value={messageType}
            onChange={(e) => setMessageType(e.target.value)}
            className="px-3 py-1.5 bg-dark-700 border border-dark-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
          >
            <option value="">所有类型</option>
            <option value="rpc">RPC</option>
            <option value="rpc-reply">RPC-Reply</option>
            <option value="notification">Notification</option>
          </select>

          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            className="px-3 py-1.5 bg-dark-700 border border-dark-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
          >
            <option value="">所有方向</option>
            <option value="DU->RU">DU → RU</option>
            <option value="RU->DU">RU → DU</option>
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="px-3 py-1.5 bg-dark-700 border border-dark-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
          >
            <option value="default">默认排序</option>
            <option value="rt_desc">响应时间 ↓</option>
            <option value="rt_asc">响应时间 ↑</option>
          </select>

          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="w-4 h-4 text-dark-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="搜索 XML 内容关键字（如：edit-config、ACTIVE、carrier 名称等）..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-dark-700 border border-dark-600 rounded-lg text-sm text-white placeholder-dark-400 focus:outline-none focus:border-primary-500"
              />
              {keyword && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dark-500">
                  按 Enter 搜索
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
              清除筛选
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-dark-800/50 border border-dark-700 rounded-2xl overflow-hidden">
        {messages.length === 0 && !loading ? (
          <div className="flex items-center justify-center py-20 text-dark-400">
            暂无数据
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-12"></th>
                  <th>行号</th>
                  <th>时间</th>
                  <th>消息ID</th>
                  <th>方向</th>
                  <th>类型</th>
                  <th>操作/通知</th>
                  <th>YANG 模块</th>
                  <th>响应时间</th>
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

                    {/* 展开的详情行 */}
                    {expandedIds.has(msg.id) && (
                      <tr key={`${msg.id}-detail`} className="bg-dark-900/50">
                        <td colSpan={9} className="!p-0">
                          <div className="p-4 border-t border-dark-700">
                            {loadingIds.has(msg.id) ? (
                              <div className="flex items-center justify-center py-8">
                                <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                                <span className="ml-3 text-dark-400">加载中...</span>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {/* 消息元信息 */}
                                <div className="flex flex-wrap gap-6 text-sm">
                                  <div>
                                    <span className="text-dark-500">行号:</span>
                                    <span className="ml-2 text-dark-300 font-mono">{msg.line_number}</span>
                                  </div>
                                  <div>
                                    <span className="text-dark-500">消息ID:</span>
                                    <span className="ml-2 text-primary-400 font-mono">{msg.message_id || '-'}</span>
                                  </div>
                                  <div>
                                    <span className="text-dark-500">时间:</span>
                                    <span className="ml-2 text-dark-300">
                                      {msg.timestamp ? format(new Date(msg.timestamp), 'yyyy-MM-dd HH:mm:ss.SSS') : '-'}
                                    </span>
                                  </div>
                                  {msg.response_time_ms && (
                                    <div>
                                      <span className="text-dark-500">响应时间:</span>
                                      <span className={`ml-2 ${msg.response_time_ms > 100 ? 'text-amber-400' : 'text-green-400'}`}>
                                        {msg.response_time_ms.toFixed(2)} ms
                                      </span>
                                    </div>
                                  )}
                                </div>

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

        {/* 加载更多指示器 */}
        <div ref={observerTarget} className="h-20 flex items-center justify-center border-t border-dark-700">
          {loading && (
            <div className="flex items-center gap-3 text-dark-400">
              <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
              <span>加载中...</span>
            </div>
          )}
          {!loading && !hasMore && messages.length > 0 && (
            <div className="text-dark-500 text-sm">已加载全部消息</div>
          )}
        </div>
      </div>

      {/* XML 语法高亮样式 */}
      <style>{xmlStyles}</style>
    </div>
  );
}
