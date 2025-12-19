import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, ArrowRight, User } from 'lucide-react';
import { authAPI } from '../api/client';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError('请输入用户名');
      return;
    }

    setLoading(true);

    try {
      const data = await authAPI.login(trimmedUsername);
      login(data);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || '进入失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-xl shadow-primary-500/20 mb-4">
            <Radio className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">O-RAN Log Parser</h1>
          <p className="text-dark-400 mt-2">RPC 消息日志分析系统</p>
        </div>

        {/* Login form */}
        <div className="bg-dark-800/50 backdrop-blur-sm border border-dark-700 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-2">欢迎使用</h2>
          <p className="text-dark-400 text-sm mb-6">输入用户名开始分析您的日志文件</p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                用户名
              </label>
              <div className="relative">
                <User className="w-5 h-5 text-dark-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white placeholder-dark-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
                  placeholder="请输入您的用户名"
                  autoFocus
                />
              </div>
              <p className="mt-2 text-xs text-dark-500">
                每个用户名的数据相互独立，输入相同用户名可访问之前的数据
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>开始使用</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-dark-800/30 rounded-xl border border-dark-700/50">
            <div className="text-2xl mb-1">📊</div>
            <div className="text-xs text-dark-400">RPC 分析</div>
          </div>
          <div className="p-4 bg-dark-800/30 rounded-xl border border-dark-700/50">
            <div className="text-2xl mb-1">⚠️</div>
            <div className="text-xs text-dark-400">错误检测</div>
          </div>
          <div className="p-4 bg-dark-800/30 rounded-xl border border-dark-700/50">
            <div className="text-2xl mb-1">📁</div>
            <div className="text-xs text-dark-400">多文件支持</div>
          </div>
        </div>
      </div>
    </div>
  );
}
