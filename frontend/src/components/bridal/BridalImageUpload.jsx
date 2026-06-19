import { useId, useState } from 'react'
import { ImagePlus, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { bridalAPI } from '../../api'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

/**
 * Reusable bridal set image uploader: validates type/size, uploads to the
 * server (`/bridal/upload`), and reports back the stored URL via onChange.
 * Shows a thumbnail preview with a remove button once an image is set.
 *
 * @param {string|null} value   current image URL (or data URL)
 * @param {(url:string|null)=>void} onChange
 * @param {string} [label]
 */
export default function BridalImageUpload({ value, onChange, label = 'Bridal Set Image' }) {
  const inputId = useId()
  const [uploading, setUploading] = useState(false)

  const pick = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file'); return }
    if (file.size > MAX_BYTES) { toast.error('Image must be 5 MB or smaller'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const { data } = await bridalAPI.uploadImage(fd)
      if (data?.url) { onChange(data.url); toast.success('Image uploaded') }
      else toast.error('Upload failed')
    } catch { toast.error('Could not upload image') }
    finally { setUploading(false) }
  }

  return (
    <div>
      {label && <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>}
      {/* Native <label htmlFor> opens the picker even in Safari with a hidden input */}
      <input id={inputId} type="file" accept="image/*" className="hidden"
        onChange={e => pick(e.target.files?.[0])} />
      {value ? (
        <div className="flex items-center gap-3">
          <img src={value} alt="Bridal set" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
          <div className="flex flex-col gap-1">
            <label htmlFor={inputId}
              className="bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer inline-block select-none text-center">
              {uploading ? 'Uploading…' : 'Replace'}
            </label>
            <button type="button" onClick={() => onChange(null)}
              className="text-slate-500 hover:text-red-600 text-xs flex items-center gap-1 justify-center">
              <X className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <label htmlFor={inputId}
            className="bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer inline-flex items-center gap-2 select-none">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {uploading ? 'Uploading…' : 'Choose image'}
          </label>
          <span className="text-sm text-slate-500">No image</span>
        </div>
      )}
    </div>
  )
}
