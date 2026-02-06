import { useState } from 'react';
import { useHiveStore } from '../store';

interface ProvisionToken {
  token: string;
  name: string;
  platform: string;
  tags: string[];
  expires_at: string;
  download_url: string;
}

export default function Provision() {
  const token = useHiveStore((state: any) => state.token);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provisionToken, setProvisionToken] = useState<ProvisionToken | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    platform: 'linux',
    tags: '',
    expires_in_hours: 48,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/provision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          platform: formData.platform,
          tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
          expires_in_hours: formData.expires_in_hours,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create provision token');
      }

      const data = await response.json();
      setProvisionToken({
        token: data.data.token,
        name: data.data.name,
        platform: data.data.platform,
        tags: data.data.tags,
        expires_at: data.data.expires_at,
        download_url: `/api/v1/provision/download/${data.data.token}`,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getInstallCommand = () => {
    if (!provisionToken) return '';
    
    const baseUrl = window.location.origin;
    const downloadUrl = `${baseUrl}${provisionToken.download_url}`;
    
    if (provisionToken.platform === 'windows') {
      return `iwr -useb ${downloadUrl} | iex`;
    } else {
      return `curl -fsSL ${downloadUrl} | sudo bash`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Provision New Agent</h1>

        {!provisionToken ? (
          <div className="bg-gray-800 rounded-lg p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="production-server-01"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Platform
                </label>
                <select
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="linux">Linux</option>
                  <option value="windows">Windows</option>
                  <option value="darwin">macOS</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="production, web-server, us-east"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Expires In (hours)
                </label>
                <input
                  type="number"
                  value={formData.expires_in_hours}
                  onChange={(e) => setFormData({ ...formData, expires_in_hours: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  min="1"
                  max="720"
                />
              </div>

              {error && (
                <div className="bg-red-900/50 border border-red-500 rounded p-4 text-red-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-3 rounded font-medium transition-colors"
              >
                {loading ? 'Creating...' : 'Generate Provision Token'}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-green-900/30 border border-green-500 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-green-400">
                ✓ Provision Token Created
              </h2>
              <p className="text-gray-300 mb-4">
                Use the installation command below to deploy the agent. This token will expire in {formData.expires_in_hours} hours.
              </p>
            </div>

            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Installation Command</h3>
              <div className="bg-gray-900 rounded p-4 font-mono text-sm mb-4 relative">
                <pre className="overflow-x-auto">{getInstallCommand()}</pre>
                <button
                  onClick={() => copyToClipboard(getInstallCommand())}
                  className="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-xs"
                >
                  Copy
                </button>
              </div>

              <div className="space-y-3 text-sm text-gray-400">
                <p><strong>Name:</strong> {provisionToken.name}</p>
                <p><strong>Platform:</strong> {provisionToken.platform}</p>
                <p><strong>Tags:</strong> {provisionToken.tags.join(', ') || 'None'}</p>
                <p><strong>Expires:</strong> {new Date(provisionToken.expires_at).toLocaleString()}</p>
              </div>
            </div>

            <div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2 text-yellow-400">⚠️ Important</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-300">
                <li>Run the installation command on the target machine</li>
                <li>The agent will automatically register with the server</li>
                <li>This token can only be used once</li>
                <li>Keep the installation command secure</li>
              </ul>
            </div>

            <button
              onClick={() => {
                setProvisionToken(null);
                setFormData({ name: '', platform: 'linux', tags: '', expires_in_hours: 48 });
              }}
              className="w-full bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded font-medium transition-colors"
            >
              Create Another Token
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
