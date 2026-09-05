/**
 * A lightweight contour picker for the create form: search by number, pick
 * from the matches. Deliberately NOT the full map-based
 * `applicant/wizard/ContourPicker.tsx` (a citizen's own two-column
 * map+list flow with an interactive `ContourMapPreview`) — task 6's brief is
 * the lifecycle screen, not a GIS picker, and that component is private to
 * the applicant track besides (its imports come from `applicant/api.ts`).
 * This is the same "list" half of that idiom on its own: `GET /gis/contours`
 * (published contours, needs no permission — `api.ts::listContours`'s own
 * note), fetched once at a generous page size and filtered CLIENT-SIDE by
 * number substring, the identical trade-off `ContourPicker.tsx` documents
 * for the same endpoint (no server-side search-by-number parameter exists).
 */
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '../../../components/ui/FormControls';
import { useContourSearch } from './queries';

export interface PickedContour {
  id: string;
  number: string;
}

export function ContourSearchField({
  value,
  onChange,
  placeholder,
  noMatches,
}: {
  value: PickedContour | null;
  onChange: (contour: PickedContour) => void;
  placeholder: string;
  noMatches: string;
}) {
  const [search, setSearch] = useState(value?.number ?? '');
  const contours = useContourSearch({ page: 1, page_size: 100 });

  const matches = useMemo(() => {
    const items = contours.data?.items ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((c) => c.number.toLowerCase().includes(needle));
  }, [contours.data, search]);

  return (
    <div className="space-y-2">
      <Input
        data-testid="norm-contour-search"
        leftIcon={<Search className="h-4 w-4" />}
        placeholder={placeholder}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="max-h-48 overflow-y-auto rounded-lg border border-[#E4E7EA] divide-y divide-[#E4E7EA]">
        {matches.length === 0 && <p className="p-3 text-xs text-[#5A646D]">{noMatches}</p>}
        {matches.map((contour) => (
          <button
            key={contour.id}
            type="button"
            data-testid={`norm-contour-option-${contour.id}`}
            onClick={() => {
              onChange({ id: contour.id, number: contour.number });
              setSearch(contour.number);
            }}
            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#F8F9FA] ${
              value?.id === contour.id ? 'bg-[#F0F7F1] font-semibold text-[#123522]' : 'text-[#1A1F24]'
            }`}
          >
            <span className="font-mono">№ {contour.number}</span>
            {contour.area_ha != null && <span className="text-xs text-[#5A646D]">{contour.area_ha} ha</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
