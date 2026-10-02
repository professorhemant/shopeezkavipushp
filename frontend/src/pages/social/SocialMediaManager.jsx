import { useState, useEffect, useRef } from 'react'
import { socialMediaAPI } from '../../api'
import {
  Instagram, Facebook, Share2, Settings, Clock, CheckCircle,
  XCircle, Upload, Trash2, Send, Eye, Image, AlertCircle, Info
} from 'lucide-react'

const TABS = ['Create Post', 'Post History', 'Settings']

const PLATFORM_OPTIONS = [
  { value: 'both',      label: 'Instagram + Facebook', icon: null },
  { value: 'instagram', label: 'Instagram only',        icon: Instagram },
  { value: 'facebook',  label: 'Facebook only',         icon: Facebook },
]

const STATUS_BADGE = {
  posted:  { cls: 'bg-green-500/15 text-green-400',  icon: CheckCircle, label: 'Posted' },
  failed:  { cls: 'bg-red-500/15 text-red-400',      icon: XCircle,     label: 'Failed' },
  pending: { cls: 'bg-amber-500/15 text-amber-400',  icon: Clock,       label: 'Pending' },
}

const PLATFORM_LABEL = {
  instagram: 'Instagram',
  facebook:  'Facebook',
  both:      'IG + FB',
}

export default function SocialMediaManager() {
  const [tab, setTab] = useState(0)

  // ── Settings state ────────────────────────────────────────────────
  const [settings, setSettings] = useState({ fb_page_id: '', fb_page_access_token: '', ig_account_id: '' })
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState(null)

  // ── Create post state ─────────────────────────────────────────────
  const [imageUrl, setImageUrl] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const [caption, setCaption] = useState('')
  const [platform, setPlatform] = useState('both')
  const [uploading, setUploading] = useState(false)
  const [posting, setPosting] = useState(false)
  const [postResult, setPostResult] = useState(null)
  const fileRef = useRef()

  // ── History state ─────────────────────────────────────────────────
  const [posts, setPosts] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(false)

  // ── Load ──────────────────────────────────────────────────────────
  useEffect(() => {
    loadSettings()
    loadPosts()
  }, [])

  const loadSettings = async () => {
    try {
      const res = await socialMediaAPI.getSettings()
      if (res.data?.settings) setSettings(res.data.settings)
    } catch (_) {}
  }

  const loadPosts = async () => {
    setLoadingPosts(true)
    try {
      const res = await socialMediaAPI.listPosts()
      if (res.data?.posts) setPosts(res.data.posts)
    } catch (_) {}
    setLoadingPosts(false)
  }

  // ── Settings save ─────────────────────────────────────────────────
  const handleSaveSettings = async (e) => {
    e.preventDefault()
    setSettingsSaving(true)
    setSettingsMsg(null)
    try {
      await socialMediaAPI.saveSettings(settings)
      setSettingsMsg({ type: 'success', text: 'Settings saved successfully.' })
    } catch (err) {
      setSettingsMsg({ type: 'error', text: err.response?.data?.message || 'Failed to save settings.' })
    }
    setSettingsSaving(false)
  }

  // ── Image upload ──────────────────────────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImagePreview(URL.createObjectURL(file))
    setUploading(true)
    setPostResult(null)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await socialMediaAPI.uploadImage(fd)
      if (res.data?.url) setImageUrl(res.data.url)
    } catch (err) {
      setPostResult({ type: 'error', text: 'Image upload failed: ' + (err.response?.data?.message || err.message) })
    }
    setUploading(false)
  }

  // ── Post ──────────────────────────────────────────────────────────
  const handlePost = async () => {
    if (!imageUrl) { setPostResult({ type: 'error', text: 'Please upload an image first.' }); return }
    setPosting(true)
    setPostResult(null)
    try {
      const res = await socialMediaAPI.createPost({ image_url: imageUrl, caption, platform })
      const { posted, errors } = res.data
      const successes = []
      if (posted?.instagram) successes.push('Instagram')
      if (posted?.facebook) successes.push('Facebook')

      if (successes.length) {
        setPostResult({ type: 'success', text: `Posted to ${successes.join(' & ')} successfully!` })
        setImageUrl('')
        setImagePreview('')
        setCaption('')
        loadPosts()
      } else {
        setPostResult({ type: 'error', text: errors ? errors.join('\n') : 'Post failed.' })
      }
    } catch (err) {
      setPostResult({ type: 'error', text: err.response?.data?.message || 'Post failed.' })
    }
    setPosting(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this post from history?')) return
    try {
      await socialMediaAPI.deletePost(id)
      setPosts(p => p.filter(x => x.id !== id))
    } catch (_) {}
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Share2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Social Media Manager</h1>
          <p className="text-xs text-slate-400">Post images to Instagram &amp; Facebook from one place</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-700">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === i
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Tab 0: Create Post ──────────────────────────────────────── */}
      {tab === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Form */}
          <div className="space-y-4">
            {/* Image upload */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Image className="h-4 w-4" /> Post Image
              </label>
              <div
                onClick={() => !uploading && fileRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  uploading ? 'border-amber-500/50 bg-amber-500/5' : 'border-slate-600 hover:border-amber-500/50 hover:bg-amber-500/5'
                }`}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" className="max-h-48 mx-auto rounded-lg object-contain" />
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-slate-500" />
                    <p className="text-sm text-slate-400">Click to upload image</p>
                    <p className="text-xs text-slate-500">JPG, PNG, WebP — max 10 MB</p>
                  </div>
                )}
                {uploading && <p className="mt-2 text-xs text-amber-400 animate-pulse">Uploading…</p>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              {imagePreview && !uploading && (
                <button
                  onClick={() => { setImageUrl(''); setImagePreview(''); if (fileRef.current) fileRef.current.value = ''; }}
                  className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                >
                  Remove image
                </button>
              )}
            </div>

            {/* Caption */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-300">Caption</label>
                <span className={`text-xs ${caption.length > 2200 ? 'text-red-400' : 'text-slate-500'}`}>
                  {caption.length}/2200
                </span>
              </div>
              <textarea
                rows={5}
                value={caption}
                onChange={e => setCaption(e.target.value)}
                maxLength={2200}
                placeholder="Write your post caption… Use hashtags, emojis, etc."
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            {/* Platform */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
              <label className="text-sm font-medium text-slate-300">Post to</label>
              <div className="grid grid-cols-3 gap-2">
                {PLATFORM_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPlatform(opt.value)}
                    className={`py-2.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
                      platform === opt.value
                        ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                        : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                    }`}
                  >
                    {opt.value === 'both' && (
                      <span className="flex items-center justify-center gap-1">
                        <Instagram className="h-3.5 w-3.5" />
                        <Facebook className="h-3.5 w-3.5" />
                      </span>
                    )}
                    {opt.value === 'instagram' && <Instagram className="h-3.5 w-3.5 mx-auto mb-0.5" />}
                    {opt.value === 'facebook' && <Facebook className="h-3.5 w-3.5 mx-auto mb-0.5" />}
                    <span className="block mt-1 leading-tight">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Result message */}
            {postResult && (
              <div className={`rounded-lg p-3 flex items-start gap-2 text-sm ${
                postResult.type === 'success'
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}>
                {postResult.type === 'success'
                  ? <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  : <XCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                <pre className="whitespace-pre-wrap font-sans">{postResult.text}</pre>
              </div>
            )}

            {/* Post button */}
            <button
              onClick={handlePost}
              disabled={posting || uploading || !imageUrl}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {posting ? (
                <span className="animate-pulse">Posting…</span>
              ) : (
                <><Send className="h-4 w-4" /> Post Now</>
              )}
            </button>
          </div>

          {/* Right: Preview */}
          <div className="space-y-4">
            <p className="text-sm font-medium text-slate-300 flex items-center gap-2"><Eye className="h-4 w-4" /> Preview</p>
            {/* Instagram preview */}
            {(platform === 'instagram' || platform === 'both') && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Instagram className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Instagram Post</p>
                    <p className="text-xs text-slate-500">@kavipushp</p>
                  </div>
                </div>
                {imagePreview
                  ? <img src={imagePreview} alt="ig preview" className="w-full object-cover max-h-72" />
                  : <div className="bg-slate-900 h-48 flex items-center justify-center"><Image className="h-10 w-10 text-slate-600" /></div>
                }
                <div className="px-4 py-3">
                  <p className="text-xs text-slate-200 whitespace-pre-wrap line-clamp-4">
                    {caption || <span className="text-slate-600 italic">Caption will appear here…</span>}
                  </p>
                </div>
              </div>
            )}
            {/* Facebook preview */}
            {(platform === 'facebook' || platform === 'both') && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                    <Facebook className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Facebook Post</p>
                    <p className="text-xs text-slate-500">Kavipushp Jewels</p>
                  </div>
                </div>
                <div className="px-4 py-2">
                  <p className="text-xs text-slate-200 whitespace-pre-wrap line-clamp-3">
                    {caption || <span className="text-slate-600 italic">Caption will appear here…</span>}
                  </p>
                </div>
                {imagePreview
                  ? <img src={imagePreview} alt="fb preview" className="w-full object-cover max-h-64" />
                  : <div className="bg-slate-900 h-40 flex items-center justify-center"><Image className="h-10 w-10 text-slate-600" /></div>
                }
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 1: Post History ─────────────────────────────────────── */}
      {tab === 1 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">{posts.length} post{posts.length !== 1 ? 's' : ''}</p>
            <button onClick={loadPosts} className="text-xs text-amber-400 hover:text-amber-300">Refresh</button>
          </div>
          {loadingPosts ? (
            <div className="text-center py-12 text-slate-500 text-sm animate-pulse">Loading…</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Share2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No posts yet. Create your first post!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {posts.map(p => {
                const badge = STATUS_BADGE[p.status] || STATUS_BADGE.pending
                const BadgeIcon = badge.icon
                return (
                  <div key={p.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex gap-4">
                    {/* Thumbnail */}
                    <div className="shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-slate-900">
                      {p.image_url
                        ? <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Image className="h-6 w-6 text-slate-600" /></div>
                      }
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                          <BadgeIcon className="h-3 w-3" />{badge.label}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-300">
                          {(p.platform === 'instagram' || p.platform === 'both') && <Instagram className="h-3 w-3" />}
                          {(p.platform === 'facebook' || p.platform === 'both') && <Facebook className="h-3 w-3" />}
                          {PLATFORM_LABEL[p.platform]}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 line-clamp-2">{p.caption || <span className="italic text-slate-500">No caption</span>}</p>
                      {p.error_message && (
                        <p className="text-xs text-red-400 line-clamp-2">{p.error_message}</p>
                      )}
                      <p className="text-xs text-slate-500">{fmtDate(p.posted_at || p.created_at)}</p>
                    </div>
                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="shrink-0 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Settings ────────────────────────────────────────── */}
      {tab === 2 && (
        <div className="max-w-xl space-y-5">
          {/* How-to guide */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-blue-300 flex items-center gap-2"><Info className="h-4 w-4" /> How to get your Meta credentials</p>
            <ol className="text-xs text-blue-200/80 space-y-1.5 list-decimal list-inside">
              <li>Go to <strong>developers.facebook.com</strong> → Your App → <strong>Graph API Explorer</strong></li>
              <li>Select your app, then click <strong>Generate Access Token</strong> with permissions: <code>pages_manage_posts</code>, <code>instagram_content_publish</code></li>
              <li><strong>Page Access Token</strong>: Use the long-lived page token (not the user token)</li>
              <li><strong>Facebook Page ID</strong>: Found in your Facebook Page → About → Page ID</li>
              <li><strong>Instagram Account ID</strong>: In Graph API Explorer run: <code>GET /me/accounts</code>, find your page, then <code>GET /&#123;page-id&#125;?fields=instagram_business_account</code></li>
              <li>Your Instagram must be a <strong>Business or Creator</strong> account connected to your Facebook Page</li>
            </ol>
          </div>

          <form onSubmit={handleSaveSettings} className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
            <p className="text-sm font-semibold text-white flex items-center gap-2"><Settings className="h-4 w-4 text-amber-400" /> Meta API Configuration</p>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Facebook Page Access Token</label>
              <input
                type="password"
                value={settings.fb_page_access_token || ''}
                onChange={e => setSettings(s => ({ ...s, fb_page_access_token: e.target.value }))}
                placeholder="EAABxxxxxxxxxxxxx..."
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
              <p className="text-xs text-slate-500">Used for both Facebook and Instagram posting</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Facebook Page ID</label>
              <input
                type="text"
                value={settings.fb_page_id || ''}
                onChange={e => setSettings(s => ({ ...s, fb_page_id: e.target.value }))}
                placeholder="123456789012345"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Instagram Business Account ID</label>
              <input
                type="text"
                value={settings.ig_account_id || ''}
                onChange={e => setSettings(s => ({ ...s, ig_account_id: e.target.value }))}
                placeholder="17841400123456789"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            {settingsMsg && (
              <div className={`rounded-lg p-2.5 flex items-center gap-2 text-xs ${
                settingsMsg.type === 'success'
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}>
                {settingsMsg.type === 'success' ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                {settingsMsg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={settingsSaving}
              className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm disabled:opacity-50 transition-colors"
            >
              {settingsSaving ? 'Saving…' : 'Save Settings'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
