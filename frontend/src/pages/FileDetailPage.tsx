import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FileText, MessageSquare, AlertTriangle, ArrowLeft, Clock, BarChart3, ArrowRight, ArrowDown, Radio } from 'lucide-react';
import { filesAPI, messagesAPI } from '../api/client';
import type { LogFile, ParseStatistics } from '../types';
import { format } from 'date-fns';

export default function FileDetailPage() {
  const { fileId } = useParams<{ fileId: string }>();
  const [file, setFile] = useState<LogFile | null>(null);
  const [stats, setStats] = useState<ParseStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fileId) return;

    const loadData = async () => {
      try {
        const [fileData, statsData] = await Promise.all([
          filesAPI.get(parseInt(fileId)),
          messagesAPI.getStatistics(parseInt(fileId))
        ]);
        setFile(fileData);
        setStats(statsData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [fileId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!file || !stats) {
    return (
      <div className="text-center py-20 text-dark-400">
        File not found or failed to load
      </div>
    );
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-dark-400 hover:text-primary-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to File List
        </Link>
      </div>

      {/* File header */}
      <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-6 mb-8">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-500/10 rounded-xl">
              <FileText className="w-8 h-8 text-primary-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{file.original_filename}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-dark-400">
                <span>{formatFileSize(file.file_size)}</span>
                <span>•</span>
                <span>{format(new Date(file.upload_time), 'yyyy-MM-dd HH:mm:ss')}</span>
                <span>•</span>
                <span>{stats.total_lines.toLocaleString()} lines</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-5">
          <div className="text-3xl font-bold text-primary-400">
            {stats.total_messages.toLocaleString()}
          </div>
          <div className="text-dark-400 text-sm mt-1">Total Messages</div>
        </div>
        <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-5">
          <div className="text-3xl font-bold text-blue-400">
            {stats.rpc_count.toLocaleString()}
          </div>
          <div className="text-dark-400 text-sm mt-1">RPC Requests</div>
        </div>
        <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-5">
          <div className="text-3xl font-bold text-purple-400">
            {stats.notification_count.toLocaleString()}
          </div>
          <div className="text-dark-400 text-sm mt-1">Notifications</div>
        </div>
        <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-5">
          <div className="text-3xl font-bold text-red-400">
            {stats.error_count}
          </div>
          <div className="text-dark-400 text-sm mt-1">Errors/Alarms</div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Link
          to={`/file/${fileId}/rpc`}
          className="group bg-dark-800/50 border border-dark-700 hover:border-primary-500/50 rounded-2xl p-6 transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <MessageSquare className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">RPC Message List</h3>
                <p className="text-dark-400 text-sm mt-1">
                  View all RPC requests, responses and notifications
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-dark-500 group-hover:text-primary-400 transition-colors" />
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-dark-700">
            <div>
              <div className="text-lg font-semibold text-white">{stats.rpc_count}</div>
              <div className="text-xs text-dark-400">RPC</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-white">{stats.rpc_reply_count}</div>
              <div className="text-xs text-dark-400">Responses</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-white">{stats.notification_count}</div>
              <div className="text-xs text-dark-400">Notifications</div>
            </div>
          </div>
        </Link>

        <Link
          to={`/file/${fileId}/errors`}
          className="group bg-dark-800/50 border border-dark-700 hover:border-red-500/50 rounded-2xl p-6 transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-500/10 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Errors and Alarms</h3>
                <p className="text-dark-400 text-sm mt-1">
                  View error replies, fault reports, etc.
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-dark-500 group-hover:text-red-400 transition-colors" />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-dark-700">
            <div>
              <div className="text-lg font-semibold text-white">{stats.error_count}</div>
              <div className="text-xs text-dark-400">Error</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-white">{stats.fault_count}</div>
              <div className="text-xs text-dark-400">Alarms</div>
            </div>
          </div>
        </Link>

        <Link
          to={`/file/${fileId}/carriers`}
          className="group bg-dark-800/50 border border-dark-700 hover:border-green-500/50 rounded-2xl p-6 transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-xl">
                <Radio className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Carrier Tracking</h3>
                <p className="text-dark-400 text-sm mt-1">
                  Track RX/TX Array Carriers, etc.
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-dark-500 group-hover:text-green-400 transition-colors" />
          </div>

          <div className="mt-6 pt-6 border-t border-dark-700">
            <div className="text-xs text-dark-400">
              Including Create, Update, Delete and State Change for array-carriers, low-level-endpoints, low-level-links
            </div>
          </div>
        </Link>
      </div>

      {/* Response time stats */}
      {stats.avg_response_time_ms && (
        <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-6 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-400" />
            Response Time Statistics
          </h3>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-2xl font-bold text-green-400">
                {stats.min_response_time_ms?.toFixed(2)} ms
              </div>
              <div className="text-dark-400 text-sm">Minimum</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary-400">
                {stats.avg_response_time_ms?.toFixed(2)} ms
              </div>
              <div className="text-dark-400 text-sm">Average</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-400">
                {stats.max_response_time_ms?.toFixed(2)} ms
              </div>
              <div className="text-dark-400 text-sm">Maximum</div>
            </div>
          </div>
        </div>
      )}

      {/* Operation stats */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-400" />
            Operation Type Distribution
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.operation_stats)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10)
              .map(([op, count]) => {
                const total = Object.values(stats.operation_stats).reduce((a, b) => a + b, 0);
                const pct = (count / total) * 100;
                return (
                  <div key={op} className="flex items-center gap-3">
                    <span className="w-40 text-sm text-dark-300 truncate" title={op}>
                      {op}
                    </span>
                    <div className="flex-1 h-2 bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-16 text-sm text-right text-primary-400">{count}</span>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ArrowDown className="w-5 h-5 text-primary-400" />
            Message Direction Distribution
          </h3>
          <div className="space-y-4">
            {Object.entries(stats.direction_stats).map(([dir, count]) => {
              const total = Object.values(stats.direction_stats).reduce((a, b) => a + b, 0);
              const pct = (count / total) * 100;
              const isDUtoRU = dir === 'DU->RU';
              return (
                <div key={dir} className="flex items-center gap-4">
                  <span className={`badge ${isDUtoRU ? 'badge-du-ru' : 'badge-ru-du'}`}>
                    {dir}
                  </span>
                  <div className="flex-1 h-3 bg-dark-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isDUtoRU ? 'bg-cyan-500' : 'bg-orange-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm text-dark-300">
                    {count.toLocaleString()} ({pct.toFixed(1)}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
