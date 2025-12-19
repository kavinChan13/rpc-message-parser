import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Upload, FileText, Trash2, RefreshCw, AlertCircle, CheckCircle, Clock, Loader2, FolderOpen, X } from 'lucide-react';
import { filesAPI } from '../api/client';
import type { LogFile, ExtractedFilesResponse } from '../types';
import { format } from 'date-fns';

export default function DashboardPage() {
  const [files, setFiles] = useState<LogFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // 文件选择状态
  const [extractedFiles, setExtractedFiles] = useState<ExtractedFilesResponse | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [parsing, setParsing] = useState(false);

  const loadFiles = useCallback(async () => {
    try {
      const data = await filesAPI.list();
      setFiles(data.files);
    } catch (err) {
      setError('加载文件列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();

    // Optimized polling: only poll when there are files being parsed, and increased interval to 5s
    const interval = setInterval(() => {
      const hasPending = files.some(f => f.parse_status === 'pending' || f.parse_status === 'parsing');
      if (hasPending) {
        loadFiles();
      }
    }, 5000); // Changed from 3s to 5s to reduce request frequency

    return () => clearInterval(interval);
  }, [loadFiles, files]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const result = await filesAPI.upload(file);

      // 如果返回了文件列表，显示选择界面
      if (result.files && result.files.length > 0) {
        setExtractedFiles(result);
        // 默认全选
        setSelectedFiles(new Set(result.files.map((_: any, idx: number) => idx)));
      } else {
        // 直接上传成功，刷新列表
        await loadFiles();
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || '上传失败');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleToggleFile = (index: number) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedFiles(newSelected);
  };

  const handleSelectAll = () => {
    if (!extractedFiles) return;
    if (selectedFiles.size === extractedFiles.files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(extractedFiles.files.map((_, idx) => idx)));
    }
  };

  const handleParseSelected = async () => {
    if (!extractedFiles || selectedFiles.size === 0) return;

    setParsing(true);
    setError('');

    try {
      const selected = extractedFiles.files.filter((_, idx) => selectedFiles.has(idx));
      await filesAPI.parseSelected({
        temp_directory: extractedFiles.temp_directory,
        original_filename: extractedFiles.original_filename,
        selected_files: selected
      });

      // 关闭选择对话框
      setExtractedFiles(null);
      setSelectedFiles(new Set());

      // 刷新文件列表
      await loadFiles();
    } catch (err: any) {
      setError(err.response?.data?.detail || '解析失败');
    } finally {
      setParsing(false);
    }
  };

  const handleCancelSelection = () => {
    setExtractedFiles(null);
    setSelectedFiles(new Set());
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个文件吗？相关的解析数据也会被删除。')) return;

    try {
      await filesAPI.delete(id);
      await loadFiles();
    } catch (err) {
      setError('删除失败');
    }
  };

  const getStatusBadge = (status: LogFile['parse_status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="badge badge-success flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            已完成
          </span>
        );
      case 'parsing':
        return (
          <span className="badge badge-warning flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            解析中
          </span>
        );
      case 'pending':
        return (
          <span className="badge flex items-center gap-1 bg-dark-600 text-dark-300 border border-dark-500">
            <Clock className="w-3 h-3" />
            等待中
          </span>
        );
      case 'failed':
        return (
          <span className="badge badge-error flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            失败
          </span>
        );
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="animate-fade-in">
      {/* 文件选择对话框 */}
      {extractedFiles && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl max-w-4xl w-full max-h-[80vh] flex flex-col shadow-2xl">
            {/* 标题 */}
            <div className="flex items-center justify-between p-6 border-b border-dark-700">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <FolderOpen className="w-6 h-6 text-primary-400" />
                  选择要解析的RPC日志文件
                </h2>
                <p className="text-dark-400 text-sm mt-1">
                  从 {extractedFiles.original_filename} 中找到 {extractedFiles.total_files} 个RPC日志文件
                </p>
              </div>
              <button
                onClick={handleCancelSelection}
                className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 文件列表 */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4">
                <label className="flex items-center gap-2 text-dark-300 hover:text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFiles.size === extractedFiles.files.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-dark-500 bg-dark-700 text-primary-500 focus:ring-primary-500 focus:ring-offset-dark-800"
                  />
                  <span className="font-medium">全选 / 取消全选</span>
                </label>
              </div>

              <div className="space-y-2">
                {extractedFiles.files.map((file: any, index: number) => (
                  <label
                    key={index}
                    className="flex items-center gap-3 p-4 bg-dark-700/50 hover:bg-dark-700 border border-dark-600 rounded-xl cursor-pointer transition-all"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(index)}
                      onChange={() => handleToggleFile(index)}
                      className="w-4 h-4 rounded border-dark-500 bg-dark-700 text-primary-500 focus:ring-primary-500 focus:ring-offset-dark-800"
                    />
                    <FileText className="w-5 h-5 text-primary-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate">{file.filename}</div>
                      <div className="text-dark-400 text-sm truncate">{file.relative_path}</div>
                    </div>
                    <div className="text-dark-400 text-sm flex-shrink-0">
                      {formatFileSize(file.size)}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="p-6 border-t border-dark-700 flex items-center justify-between">
              <div className="text-dark-400 text-sm">
                已选择 <span className="text-primary-400 font-medium">{selectedFiles.size}</span> 个文件
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCancelSelection}
                  className="px-4 py-2 text-dark-300 hover:text-white hover:bg-dark-700 rounded-xl transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleParseSelected}
                  disabled={selectedFiles.size === 0 || parsing}
                  className="px-6 py-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl transition-all shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {parsing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      解析中...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      开始解析
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">我的日志文件</h1>
          <p className="text-dark-400 mt-1">上传并分析 O-RAN RPC 消息日志</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadFiles}
            className="p-2 text-dark-400 hover:text-primary-400 hover:bg-dark-700 rounded-lg transition-all"
            title="刷新"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          <label className="cursor-pointer">
            <input
              type="file"
              accept=".log,.zip,.tar,.gz,.tgz,.bz2,.xz"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl transition-all shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40">
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
              <span>{uploading ? '解压中...' : '上传文件'}</span>
            </span>
          </label>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-300">
            ✕
          </button>
        </div>
      )}

      {/* Files list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-20 bg-dark-800/30 border border-dark-700 rounded-2xl">
          <FileText className="w-16 h-16 text-dark-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-dark-300 mb-2">暂无文件</h3>
          <p className="text-dark-500">上传一个 .log 文件开始分析</p>
        </div>
      ) : (
        <div className="bg-dark-800/50 border border-dark-700 rounded-2xl overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>文件名</th>
                <th>大小</th>
                <th>上传时间</th>
                <th>状态</th>
                <th>消息数</th>
                <th>错误数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id}>
                  <td>
                    {file.parse_status === 'completed' ? (
                      <Link
                        to={`/file/${file.id}`}
                        className="text-primary-400 hover:text-primary-300 flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        {file.original_filename}
                      </Link>
                    ) : (
                      <span className="flex items-center gap-2 text-dark-300">
                        <FileText className="w-4 h-4" />
                        {file.original_filename}
                      </span>
                    )}
                  </td>
                  <td className="text-dark-400">{formatFileSize(file.file_size)}</td>
                  <td className="text-dark-400">
                    {format(new Date(file.upload_time), 'yyyy-MM-dd HH:mm')}
                  </td>
                  <td>{getStatusBadge(file.parse_status)}</td>
                  <td className="text-dark-300">{file.total_messages.toLocaleString()}</td>
                  <td>
                    {file.error_count > 0 ? (
                      <span className="text-red-400">{file.error_count}</span>
                    ) : (
                      <span className="text-dark-500">0</span>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => handleDelete(file.id)}
                      className="p-2 text-dark-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
