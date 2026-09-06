/**
 * Photo evidence for an inspection act (task 5). `capture="environment"` on
 * the file input is a HINT toward the phone's back camera, not an
 * enforcement — some browsers still let the operator pick from a gallery
 * instead, and nothing here pretends otherwise (Global Constraint 7).
 *
 * The "add photo" control (and only that control) is gated on
 * `act.status === 'draft' && act.inspector_id === me.user.id` — the same
 * ownership rule Task 4's edit form uses, because `POST .../files` refuses
 * a non-owner regardless of permissions. The thumbnail GALLERY itself stays
 * visible past that point too (a signed act's own photographic evidence
 * does not disappear once frozen) — mirrors how `ChecklistFields`/
 * `ActGpsCard` keep showing their read state under `readOnly`, hiding only
 * the interactive controls.
 *
 * `ActFileOut` carries no URL, only `file_id`/`kind`/`created_at` — but
 * `GET /api/v1/files/{file_id}` (`app/files_router.py::download_file`,
 * `get_current_user` only) turns out to be a real, working download route
 * this plan's own route list omitted (see the task report). This card uses
 * it for a real inline thumbnail on `kind: 'photo'` rows, falling back to a
 * plain icon card — for a `video` row, or if the fetch fails for any
 * reason — never a broken `<img>`.
 */
import { useEffect, useRef, useState } from 'react';
import { Camera, FileText, Loader2, Video } from 'lucide-react';
import { api } from '../../../api/client';
import { apiError, ApiError } from '../../../api/errors';
import { useT } from '../../../i18n/useT';
import { Button } from '../../../components/ui/button';
import { formatDateTime } from '../format';
import { uploadActFile, useAttachActFile, type ActFileOut } from '../queries';
import type { GeoFix } from '../geo';

/** One `act.files` row's thumbnail — its own small fetch-and-render unit so
 *  a failed or slow load for one photo never blocks the rest of the grid.
 *  Keyed by `file.id` in the grid below, so a genuinely different file
 *  always gets a fresh instance (fresh `url`/`failed` state for free) —
 *  this effect never needs to reset either for a REUSED instance, since
 *  there is none. */
function ActPhotoThumbnail({ file }: { file: ActFileOut }) {
  const t = useT();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (file.kind !== 'photo') return;
    let objectUrl: string | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await api.GET('/api/v1/files/{file_id}', {
          params: { path: { file_id: file.file_id } },
          parseAs: 'blob',
        });
        if (error) throw apiError(error);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(data as Blob);
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.file_id, file.kind]);

  const FallbackIcon = file.kind === 'video' ? Video : FileText;

  return (
    <div className="border border-[#E4E7EA] rounded-xl overflow-hidden bg-[#F8F9FA]" data-testid="act-photo-thumbnail">
      {url ? (
        <img src={url} alt="" className="w-full h-24 object-cover" />
      ) : (
        <div className="w-full h-24 flex items-center justify-center text-[#9AA3AB]">
          {!failed && file.kind === 'photo' ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <FallbackIcon className="w-6 h-6" />
          )}
        </div>
      )}
      <div className="px-2 py-1.5 text-[10px] text-[#5A646D] space-y-0.5">
        <p className="font-semibold text-[#1A1F24] truncate">
          {t('inspector.actForm.photos.fileLabel')} {file.file_id.slice(0, 8)}
        </p>
        <p>{formatDateTime(file.created_at)}</p>
      </div>
    </div>
  );
}

export interface ActPhotosCardProps {
  actId: string;
  files: ActFileOut[];
  /** The inspector's currently-captured GPS fix (`ActFormPage`'s own lifted
   *  state, task 4) — attached to a photo taken after a capture; omitted
   *  entirely, never invented, when nothing has been captured yet. */
  currentFix: GeoFix | null;
  readOnly?: boolean;
}

export function ActPhotosCard({ actId, files, currentFix, readOnly = false }: ActPhotosCardProps) {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const attachFile = useAttachActFile(actId);

  async function handleFiles(fileList: FileList) {
    setUploadError(null);
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const uploaded = await uploadActFile(file);
        await attachFile.mutateAsync({
          file_id: uploaded.id,
          kind: 'photo',
          taken_at: new Date(file.lastModified).toISOString(),
          gps: currentFix ? { lon: currentFix.lon, lat: currentFix.lat } : undefined,
        });
      }
    } catch (err) {
      setUploadError(err instanceof ApiError ? `${err.code}: ${err.message}` : t('inspector.actForm.photos.uploadError'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 space-y-3 shadow-xs">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#5A646D]">{t('inspector.actForm.photos.title')}</p>

      {files.length === 0 ? (
        <p className="text-sm text-[#5A646D]">{t('inspector.actForm.photos.empty')}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {files.map((file) => (
            <ActPhotoThumbnail key={file.id} file={file} />
          ))}
        </div>
      )}

      {!readOnly && (
        <>
          <Button
            type="button"
            size="touch"
            variant="outline"
            disabled={uploading}
            leftIcon={uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            onClick={() => fileInputRef.current?.click()}
          >
            {t('inspector.actForm.photos.addButton')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            data-testid="act-photo-input"
            className="hidden"
            onChange={(e) => {
              const fileList = e.target.files;
              e.target.value = '';
              if (fileList && fileList.length > 0) void handleFiles(fileList);
            }}
          />
        </>
      )}

      {uploadError && (
        <p className="text-xs text-[#B91C1C]" role="alert">
          {uploadError}
        </p>
      )}
    </div>
  );
}
