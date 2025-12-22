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

  // File selection state
  const [extractedFiles, setExtractedFiles] = useState<ExtractedFilesResponse | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [parsing, setParsing] = useState(false);

  const loadFiles = useCallback(async () => {
    try {
      const data = await filesAPI.list();
      setFiles(data.files);
    } catch (err) {
      setError('Failed to load file list');
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

      // If file list returned, show selection dialog
      if (result.files && result.files.length > 0) {
        setExtractedFiles(result);
        // Select all by default
        setSelectedFiles(new Set(result.files.map((_: any, idx: number) => idx)));
      } else {
        // Direct upload success, refresh list
        await loadFiles();
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Upload failed');
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

      // Close selection dialog
      setExtractedFiles(null);
      setSelectedFiles(new Set());

      // Refresh file list
      await loadFiles();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Parsing failed');
    } finally {
      setParsing(false);
    }
  };

  const handleCancelSelection = () => {
    setExtractedFiles(null);
    setSelectedFiles(new Set());
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this file? Related parsing data will also be deleted.')) return;

    try {
      await filesAPI.delete(id);
      await loadFiles();
    } catch (err) {
      setError('Delete failed');
    }
  };

  const getStatusBadge = (status: LogFile['parse_status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="badge badge-success flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Completed
          </span>
        );
      case 'parsing':
        return (
          <span className="badge badge-warning flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Parse中
          </span>
        );
      case 'pending':
        return (
          <span className="badge flex items-center gap-1 bg-dark-600 text-dark-300 border border-dark-500">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'failed':
        return (
          <span className="badge badge-error flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Failed
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
      {/* File selection dialog */}
      {extractedFiles && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl max-w-4xl w-full max-h-[80vh] flex flex-col shadow-2xl">
            {/* Title */}
            <div className="flex items-center justify-between p-6 border-b border-dark-700">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <FolderOpen className="w-6 h-6 text-primary-400" />
                  Select RPC log files to parse
                </h2>
                <p className="text-dark-400 text-sm mt-1">
                  Found {extractedFiles.total_files} RPC log files in {extractedFiles.original_filename}
                </p>
              </div>
              <button
                onClick={handleCancelSelection}
                className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* File list */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4">
                <label className="flex items-center gap-2 text-dark-300 hover:text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFiles.size === extractedFiles.files.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-dark-500 bg-dark-700 text-primary-500 focus:ring-primary-500 focus:ring-offset-dark-800"
                  />
                  <span className="font-medium">Select All / Deselect All</span>
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

            {/* Bottom buttons */}
            <div className="p-6 border-t border-dark-700 flex items-center justify-between">
              <div className="text-dark-400 text-sm">
                <span className="text-primary-400 font-medium">{selectedFiles.size}</span> file(s) selected
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCancelSelection}
                  className="px-4 py-2 text-dark-300 hover:text-white hover:bg-dark-700 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleParseSelected}
                  disabled={selectedFiles.size === 0 || parsing}
                  className="px-6 py-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl transition-all shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {parsing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Parsing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Start Parsing
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
          <h1 className="text-2xl font-bold text-white">My Log Files</h1>
          <p className="text-dark-400 mt-1">Upload and analyze O-RAN RPC message logs</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadFiles}
            className="p-2 text-dark-400 hover:text-primary-400 hover:bg-dark-700 rounded-lg transition-all"
            title="Refresh"
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
              <span>{uploading ? 'Extracting...' : 'Upload File'}</span>
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
          <h3 className="text-lg font-medium text-dark-300 mb-2">No Files</h3>
          <p className="text-dark-500">Upload a .log file to start analysis</p>
        </div>
      ) : (
        <div className="bg-dark-800/50 border border-dark-700 rounded-2xl overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Size</th>
                <th>Upload Time</th>
                <th>Status</th>
                <th>Messages</th>
                <th>Errors</th>
                <th>Actions</th>
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
                      title="Delete"
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
