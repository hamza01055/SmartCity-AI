import { useEffect, useState } from 'react'
import { Formik, Form, Field, ErrorMessage } from 'formik'
import * as Yup from 'yup'
import { api } from '../lib/api'
import SmartCityHero from '../components/SmartCityHero'

const schema = Yup.object({
  reporterName:    Yup.string().max(120),
  reporterContact: Yup.string().max(120),
  latitude:  Yup.number().required('Location is required').min(-90).max(90),
  longitude: Yup.number().required('Location is required').min(-180).max(180),
})

export default function ReportPage() {
  const [image,     setImage]     = useState<File | null>(null)
  const [preview,   setPreview]   = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<{ id: number } | null>(null)
  const [error,     setError]     = useState<string | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'ok' | 'denied'>('idle')

  useEffect(() => {
    if (!image) return setPreview(null)
    const url = URL.createObjectURL(image)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  const detectGps = (setField: (k: string, v: number) => void) => {
    setGpsStatus('loading')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setField('latitude',  pos.coords.latitude)
        setField('longitude', pos.coords.longitude)
        setGpsStatus('ok')
      },
      () => setGpsStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  if (submitted) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6">
        <div className="glass rounded-3xl p-10 text-center max-w-md w-full"
          style={{ border: '1px solid rgba(52,211,153,0.25)' }}>
          <div className="w-20 h-20 rounded-full bg-mint/10 border border-mint/30 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-mint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-bold text-white mb-2">Report Submitted!</h1>
          <p className="text-slate-400 text-sm mb-1">Tracking ID</p>
          <p className="font-mono text-4xl font-bold text-sky glow-sky mb-3">#{submitted.id}</p>
          <p className="text-sm text-slate-500 mb-8">
            Our AI is now analyzing your photo to classify the issue automatically.
          </p>
          <button
            onClick={() => { setSubmitted(null); setImage(null) }}
            className="px-6 py-2.5 rounded-xl border border-sky/30 text-sky hover:bg-sky/10 transition font-medium text-sm"
          >
            ← Report another issue
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <SmartCityHero />

      <div className="mb-7">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-0.5 h-5 rounded-full bg-sky" style={{ boxShadow: '0 0 8px #38bdf8' }} />
          <span className="text-sky text-xs font-bold tracking-[0.18em] uppercase glow-sky">New Report</span>
        </div>
        <h1 className="font-display text-3xl font-bold text-white">Report a City Issue</h1>
        <p className="text-slate-400 text-sm mt-1">
          Take a photo and share your location — our AI detects and classifies the issue automatically.
        </p>
      </div>

      {/* AI badge */}
      <div className="flex items-center gap-3 glass rounded-xl px-4 py-3 mb-6"
        style={{ border: '1px solid rgba(129,140,248,0.2)' }}>
        <div className="w-8 h-8 rounded-full bg-violet/15 border border-violet/30 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-violet" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
          </svg>
        </div>
        <div>
          <div className="text-xs font-semibold text-violet">AI-Powered Detection</div>
          <div className="text-xs text-slate-500 mt-0.5">
            YOLOv8 automatically classifies potholes, garbage, broken streetlights & more
          </div>
        </div>
      </div>

      <Formik
        initialValues={{ reporterName: '', reporterContact: '', latitude: 0, longitude: 0 }}
        validationSchema={schema}
        onSubmit={async (values, { setSubmitting }) => {
          setError(null)
          if (!image) { setError('Please attach a photo for AI analysis'); setSubmitting(false); return }
          if (values.latitude === 0 && values.longitude === 0) {
            setError('Please share your location so crews can be dispatched')
            setSubmitting(false)
            return
          }
          const fd = new FormData()
          fd.append('reporterName',    values.reporterName)
          fd.append('reporterContact', values.reporterContact)
          fd.append('latitude',        String(values.latitude))
          fd.append('longitude',       String(values.longitude))
          fd.append('image',           image)
          try {
            const { data } = await api.post('/api/report', fd)
            setSubmitted({ id: data.id })
          } catch (e: any) {
            setError(e?.response?.data?.message || e?.response?.data?.error || 'Submission failed')
          } finally {
            setSubmitting(false)
          }
        }}
      >
        {({ isSubmitting, setFieldValue, values }) => (
          <Form className="glass rounded-2xl p-6 space-y-5">

            {/* Photo — primary input */}
            <PhotoUpload image={image} preview={preview} onChange={setImage} />

            {/* Name + Contact */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                  Your Name
                </label>
                <Field name="reporterName" placeholder="Optional"
                  className="w-full px-4 py-3 rounded-xl bg-void border border-mid text-slate-100 placeholder-slate-600 focus:border-sky/50 focus:outline-none transition text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                  Email / Phone
                </label>
                <Field name="reporterContact" placeholder="Optional"
                  className="w-full px-4 py-3 rounded-xl bg-void border border-mid text-slate-100 placeholder-slate-600 focus:border-sky/50 focus:outline-none transition text-sm" />
              </div>
            </div>
            <ErrorMessage name="reporterContact" component="div" className="text-xs text-rose -mt-2" />

            {/* GPS */}
            <div className="rounded-xl bg-void border border-mid p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="text-sky text-base">⌖</span> Location
                    <span className="text-rose text-xs font-normal">(required)</span>
                  </div>
                  {values.latitude !== 0
                    ? <div className="text-xs text-sky font-mono mt-0.5 glow-sky">
                        {values.latitude.toFixed(5)}, {values.longitude.toFixed(5)}
                      </div>
                    : <div className="text-xs text-slate-500 mt-0.5">
                        Needed so crews can find and fix the issue
                      </div>}
                </div>
                <button type="button" onClick={() => detectGps(setFieldValue)}
                  className={`shrink-0 px-4 py-2 text-xs font-semibold rounded-xl transition ${
                    gpsStatus === 'ok'
                      ? 'border border-mint/30 text-mint bg-mint/10'
                      : 'border border-sky/25 text-sky hover:bg-sky/10'
                  }`}>
                  {gpsStatus === 'loading' ? 'Locating…'
                    : gpsStatus === 'ok'   ? '✓ Location set'
                    : 'Share location'}
                </button>
              </div>
              {gpsStatus === 'denied' && (
                <p className="text-xs text-rose mt-2">
                  Location access denied. Please enable it in your browser settings.
                </p>
              )}
            </div>
            <ErrorMessage name="latitude" component="div" className="text-xs text-rose -mt-2" />

            {error && (
              <div className="px-4 py-3 rounded-xl bg-rose/10 border border-rose/25 text-rose text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={isSubmitting}
              className="btn-primary w-full py-3.5 rounded-xl text-sm tracking-wide">
              {isSubmitting ? 'Submitting…' : '↑ Submit for AI Analysis'}
            </button>
          </Form>
        )}
      </Formik>
    </div>
  )
}

function PhotoUpload({ image, preview, onChange }: {
  image: File | null; preview: string | null; onChange: (f: File | null) => void
}) {
  return (
    <label className="block cursor-pointer group">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
        Photo
        <span className="text-rose ml-1">(required for AI)</span>
      </div>
      <div className={`relative rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-all bg-void ${
        preview ? 'border-sky/40 aspect-video' : 'border-mid hover:border-sky/30 h-48'
      }`}>
        {preview ? (
          <>
            <img src={preview} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition flex items-end p-3">
              <span className="text-xs text-white font-medium">Click to change photo</span>
            </div>
          </>
        ) : (
          <div className="text-center py-6 px-4">
            <div className="w-16 h-16 rounded-full bg-sky/10 border border-sky/20 flex items-center justify-center mx-auto mb-3 group-hover:border-sky/45 group-hover:bg-sky/15 transition">
              <svg className="w-8 h-8 text-sky" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-sm text-slate-300 font-medium group-hover:text-white transition">
              Take or upload a photo
            </p>
            <p className="text-xs text-slate-600 mt-1">Pothole · Garbage · Broken streetlight · etc.</p>
            <p className="text-xs text-slate-700 mt-0.5">JPG, PNG, HEIC · Max 10 MB</p>
          </div>
        )}
      </div>
      <input type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => onChange(e.target.files?.[0] || null)} />
      {image && <p className="text-xs text-slate-500 mt-1 truncate">{image.name}</p>}
    </label>
  )
}
