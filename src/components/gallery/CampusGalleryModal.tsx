import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Upload,
  Plus,
  Trash2,
  Image as ImageIcon,
  Shield,
  Calendar,
  Tag,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { useAlumni } from '../../context/AlumniContext';
import { GalleryItem } from '../../types';
import { validateUploadedFile } from '../../lib/security';

interface CampusGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_SAMPLE_PHOTOS = [
  {
    title: "St. Cecilia's Academic Tower",
    category: 'campus' as const,
    year: '2026 Landmark',
    url: '/assets/landing-building-2.jpg',
    description: 'Modern academic high-rise tower facade featuring the signature red entrance canopy.'
  },
  {
    title: "Main Campus Entrance & Grounds",
    category: 'campus' as const,
    year: 'Campus Life',
    url: '/assets/landing-building-1.jpg',
    description: 'Collegiate front entrance facade, student transit lines, and daily campus grounds.'
  },
  {
    title: 'Aerial Campus Complex',
    category: 'campus' as const,
    year: 'Campus Overview',
    url: '/assets/landing-building-3.jpg',
    description: 'Bird’s-eye perspective of St. Cecilia’s College - Cebu, Inc. educational facilities.'
  },
  {
    title: "Official College Seal of St. Cecilia's",
    category: 'heritage' as const,
    year: '1999 Founding',
    url: '/assets/cecilians-seal.jpg',
    description: "Official institutional circular seal of St. Cecilia's College - Cebu, Inc., Est. 1999."
  },
  {
    title: 'University Library & Digital Archives',
    category: 'campus' as const,
    year: '2026',
    url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1200&auto=format&fit=crop&q=80',
    description: 'Renovated university library wing housing academic journals and digital research hubs.'
  },
  {
    title: 'Silver Jubilarian Torch Ceremony',
    category: 'homecoming' as const,
    year: '2025 Reunion',
    url: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1200&auto=format&fit=crop&q=80',
    description: 'Annual lighting of the alumni torch by Class of 2000 Silver Jubilarians.'
  },
  {
    title: 'Baccalaureate Mass & Honors Investiture',
    category: 'commencement' as const,
    year: 'Batch 2025',
    url: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=1200&auto=format&fit=crop&q=80',
    description: 'Conferment ceremony for graduating seniors in the University Auditorium.'
  }
];

export const CampusGalleryModal: React.FC<CampusGalleryModalProps> = ({
  isOpen,
  onClose
}) => {
  const {
    currentUser,
    galleryItems,
    addGalleryItem,
    deleteGalleryItem,
    permissions
  } = useAlumni();

  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'campus' | 'homecoming' | 'commencement' | 'heritage'
  >('all');

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'campus' | 'homecoming' | 'commencement' | 'heritage'>('campus');
  const [newYear, setNewYear] = useState('2026');
  const [newUrl, setNewUrl] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [uploadError, setUploadError] = useState('');

  // Selected item for full-view modal
  const [inspectingItem, setInspectingItem] = useState<GalleryItem | null>(null);
  // Item pending deletion confirmation
  const [itemToDelete, setItemToDelete] = useState<GalleryItem | null>(null);

  // Keyboard shortcut (Escape) to close dialogs, and prevent body background scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (itemToDelete) {
          setItemToDelete(null);
        } else if (inspectingItem) {
          setInspectingItem(null);
        } else if (showUploadModal) {
          setShowUploadModal(false);
        } else {
          onClose();
        }
      }
    };

    const handleCloseEvent = () => {
      if (itemToDelete) {
        setItemToDelete(null);
      } else if (inspectingItem) {
        setInspectingItem(null);
      } else if (showUploadModal) {
        setShowUploadModal(false);
      } else {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('applet:close-gallery', handleCloseEvent);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('applet:close-gallery', handleCloseEvent);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, itemToDelete, inspectingItem, showUploadModal, onClose]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const canUpload = permissions.canUploadGallery; // Admin and Registrar only

  const filteredItems =
    selectedCategory === 'all'
      ? galleryItems
      : galleryItems.filter((item) => item.category === selectedCategory);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const val = await validateUploadedFile(file, 'images');
      if (!val.valid) {
        setUploadError(val.error || 'Invalid image file.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewUrl(reader.result as string);
        setUploadError('');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectPreset = (preset: typeof PRESET_SAMPLE_PHOTOS[0]) => {
    setNewTitle(preset.title);
    setNewCategory(preset.category);
    setNewYear(preset.year);
    setNewUrl(preset.url);
    setNewDescription(preset.description);
    setUploadError('');
  };

  const handleSubmitUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUpload) {
      setUploadError('Only Admin and Registrar can upload to the Campus & Heritage Gallery.');
      return;
    }
    if (!newTitle.trim()) {
      setUploadError('Please provide a photo title.');
      return;
    }
    if (!newUrl.trim()) {
      setUploadError('Please provide an image URL or upload a file.');
      return;
    }

    const success = addGalleryItem({
      title: newTitle.trim(),
      category: newCategory,
      year: newYear.trim() || '2026',
      url: newUrl.trim(),
      description: newDescription.trim() || undefined
    });

    if (success) {
      // Reset form
      setNewTitle('');
      setNewCategory('campus');
      setNewYear('2026');
      setNewUrl('');
      setNewDescription('');
      setUploadError('');
      setShowUploadModal(false);
    }
  };

  return createPortal(
    <div
      data-campus-gallery-modal="true"
      className="fixed inset-0 z-[100] bg-stone-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="campus-gallery-title"
    >
      {/* Floating Card Container */}
      <div
        className="relative bg-white dark:bg-stone-900 rounded-2xl max-w-5xl w-full p-4 sm:p-8 max-h-[88vh] overflow-y-auto shadow-[0_25px_70px_rgba(0,0,0,0.35)] border border-stone-200/90 dark:border-stone-800 flex flex-col my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-stone-200 dark:border-stone-800 pb-4 mb-5 gap-3">
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
              <span className="editorial-kicker">
                ST. CECILIA'S COLLEGE · CEBU
              </span>
              <span className="text-stone-300 dark:text-stone-700 hidden sm:inline">·</span>
              <span className="text-[10px] font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest font-mono">
                ARCHIVAL COLLECTION
              </span>
            </div>
            <h3 id="campus-gallery-title" className="editorial-title text-xl sm:text-3xl leading-tight mt-1 text-stone-900 dark:text-stone-100">
              Campus <span className="editorial-accent italic">& Heritage Gallery</span>
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canUpload ? (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#8B181B] hover:bg-[#721316] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Upload Photo</span>
                <span className="sm:hidden">Upload</span>
                <span className="hidden md:inline ml-1 text-[10px] bg-white/20 px-1.5 py-0.5 rounded-md font-mono uppercase">
                  {currentUser?.role}
                </span>
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs border border-stone-200 dark:border-stone-700">
                <Shield className="w-3.5 h-3.5 text-[#8B181B] dark:text-rose-400" />
                <span>Uploads restricted to <strong>Admin</strong> & <strong>Registrar</strong></span>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer shrink-0"
              aria-label="Close Gallery"
              title="Close Gallery (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'All Photos' },
              { id: 'campus', label: 'Campus & Facilities' },
              { id: 'commencement', label: 'Commencement & Honors' },
              { id: 'homecoming', label: 'Homecoming & Gala' },
              { id: 'heritage', label: 'Heritage Archives' }
            ].map((cat) => {
              const count =
                cat.id === 'all'
                  ? galleryItems.length
                  : galleryItems.filter((i) => i.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-[#991B1B] text-white shadow-xs'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      selectedCategory === cat.id
                        ? 'bg-white/20 text-white'
                        : 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <span className="text-xs text-stone-400 dark:text-stone-500">
            {filteredItems.length} {filteredItems.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        {/* Gallery Grid */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-14 px-4 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-dashed border-stone-300 dark:border-stone-700">
            <ImageIcon className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-stone-700 dark:text-stone-200">No photos in this collection yet</p>
            <p className="text-xs text-stone-400 mt-1">
              {canUpload
                ? 'As an Administrator or Registrar, click "Upload Photo" above to contribute archival imagery.'
                : 'Archival photos will appear here once uploaded by the Administrator or Registrar.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="group relative rounded-xl overflow-hidden border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-700 hover:shadow-md transition-all flex flex-col"
              >
                <div
                  className="relative h-48 w-full overflow-hidden bg-stone-100 dark:bg-stone-800 cursor-pointer"
                  onClick={() => setInspectingItem(item)}
                >
                  <img
                    src={item.url}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                    <span className="text-white text-xs font-semibold flex items-center gap-1">
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Archival Details
                    </span>
                  </div>

                  <div className="absolute top-2 left-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-black/60 text-white backdrop-blur-xs">
                      {item.category}
                    </span>
                  </div>

                  <div className="absolute top-2 right-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white bg-[#991B1B]/80 backdrop-blur-xs">
                      {item.year}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 flex flex-col justify-between flex-1">
                  <div>
                    <h4
                      onClick={() => setInspectingItem(item)}
                      className="text-xs font-bold text-stone-900 dark:text-stone-100 line-clamp-1 hover:text-[#991B1B] dark:hover:text-rose-400 cursor-pointer"
                    >
                      {item.title}
                    </h4>
                    {item.description && (
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2 mt-1">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-[10px] text-stone-400 dark:text-stone-500">
                    <div className="flex items-center gap-1.5 truncate">
                      <Shield className="w-3 h-3 text-[#991B1B] dark:text-rose-400" />
                      <span className="truncate">
                        By {item.uploadedByName || 'Institution'} ({item.uploaderRole || 'admin'})
                      </span>
                    </div>

                    {canUpload && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setItemToDelete(item);
                        }}
                        className="p-1.5 text-stone-400 hover:text-red-600 dark:hover:text-rose-400 rounded-lg hover:bg-red-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                        title="Delete photo (Admin/Registrar)"
                        aria-label="Delete photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-stone-500 dark:text-stone-400 text-center sm:text-left">
            <span>Preserving St. Cecilia's legacy across generations.</span>
            {!canUpload && (
              <span className="block sm:inline sm:ml-2 text-stone-400 dark:text-stone-500">
                (Upload access restricted to Admin and Registrar)
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-stone-900 dark:bg-stone-800 hover:bg-black dark:hover:bg-stone-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Close Gallery
          </button>
        </div>
      </div>

      {/* ========================================================
          SUB-MODAL: UPLOAD ARCHIVAL PHOTO (Admin & Registrar Only)
          ======================================================== */}
      {showUploadModal && canUpload && (
        <div
          className="fixed inset-0 z-[110] bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
          onClick={() => setShowUploadModal(false)}
        >
          <div
            className="bg-white dark:bg-stone-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 dark:border-stone-800 my-auto animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-50 dark:bg-rose-950/50 text-[#8B181B] dark:text-rose-400 rounded-xl border border-red-100 dark:border-rose-900/60">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">Upload to Campus & Heritage Gallery</h4>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Authorized as <strong className="text-[#8B181B] dark:text-rose-400 uppercase">{currentUser?.role}</strong> ({currentUser?.name})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors cursor-pointer"
                aria-label="Close upload modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {uploadError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-rose-950/40 text-red-800 dark:text-rose-300 text-xs border border-red-200 dark:border-rose-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-rose-400 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* One-Click Presets for Easy Demo/Testing */}
            <div className="mb-4 p-3 bg-stone-50 dark:bg-stone-800/80 rounded-xl border border-stone-200 dark:border-stone-700">
              <div className="flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-200 mb-2">
                <span className="flex items-center gap-1 text-[11px] text-stone-700 dark:text-stone-200">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Quick Fill Archival Samples:
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {PRESET_SAMPLE_PHOTOS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className="p-2 text-left bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 hover:border-[#8B181B] dark:hover:border-rose-500 rounded-lg transition-colors truncate cursor-pointer"
                  >
                    <div className="font-semibold text-stone-900 dark:text-stone-100 text-[11px] truncate">{p.title}</div>
                    <div className="text-[10px] text-stone-500 dark:text-stone-400 uppercase">{p.category} • {p.year}</div>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmitUpload} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Photo Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., St. Cecilia Quadrangle Dedication"
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 rounded-xl focus:outline-hidden focus:border-[#8B181B] text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl font-medium text-stone-800 dark:text-stone-100 focus:outline-hidden focus:border-[#8B181B]"
                  >
                    <option value="campus">Campus & Facilities</option>
                    <option value="commencement">Commencement & Honors</option>
                    <option value="homecoming">Homecoming & Gala</option>
                    <option value="heritage">Heritage Archives</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Year / Batch / Era *
                  </label>
                  <input
                    type="text"
                    required
                    value={newYear}
                    onChange={(e) => setNewYear(e.target.value)}
                    placeholder="e.g. 2026 or 1998 Founding"
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 rounded-xl focus:outline-hidden focus:border-[#8B181B]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Image Source (Web URL or Upload) *
                </label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 rounded-xl mb-2 focus:outline-hidden focus:border-[#8B181B]"
                />

                <div className="flex items-center gap-2">
                  <label className="flex-1 px-3 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 border border-dashed border-stone-300 dark:border-stone-700 rounded-xl cursor-pointer text-center text-stone-600 dark:text-stone-300 font-medium transition-colors">
                    <span className="truncate">Choose Local File (PNG / JPG)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Preview */}
              {newUrl && (
                <div className="p-2 border border-stone-200 dark:border-stone-700 rounded-xl bg-stone-50 dark:bg-stone-800">
                  <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase mb-1">Preview:</p>
                  <img
                    src={newUrl}
                    alt="Preview"
                    className="w-full h-32 object-cover rounded-lg"
                    onError={() => setUploadError('Image preview failed. Please check the URL.')}
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Historical Description / Archival Notes
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Notes on alumni honors, architectural heritage, ceremony details, or historical context..."
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 rounded-xl resize-none focus:outline-hidden focus:border-[#8B181B]"
                />
              </div>

              <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#8B181B] hover:bg-[#721316] text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Publish to Gallery</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          SUB-MODAL: INSPECT ITEM / FULL ARCHIVAL DETAILS
          ======================================================== */}
      {inspectingItem && (
        <div
          className="fixed inset-0 z-[110] bg-stone-950/85 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
          onClick={() => setInspectingItem(null)}
        >
          <div
            className="bg-white dark:bg-stone-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-stone-200 dark:border-stone-800 my-auto overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800 mb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#8B181B] dark:text-rose-400 tracking-wider">
                  {inspectingItem.category} • {inspectingItem.year}
                </span>
                <h4 className="text-base font-bold text-stone-900 dark:text-stone-100">{inspectingItem.title}</h4>
              </div>
              <button
                onClick={() => setInspectingItem(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 cursor-pointer"
                aria-label="Close photo preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-xl overflow-hidden border border-stone-200 dark:border-stone-800 mb-4 bg-black max-h-[60vh]">
              <img
                src={inspectingItem.url}
                alt={inspectingItem.title}
                className="w-full h-auto max-h-[55vh] object-contain mx-auto"
              />
            </div>

            {inspectingItem.description && (
              <div className="p-3 bg-stone-50 dark:bg-stone-800/80 rounded-xl border border-stone-200 dark:border-stone-700 text-xs text-stone-700 dark:text-stone-300 mb-3">
                <p className="font-semibold text-stone-900 dark:text-stone-100 mb-0.5">Archival Description:</p>
                <p>{inspectingItem.description}</p>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 pt-2 border-t border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-[#8B181B] dark:text-rose-400" />
                <span>
                  Archived by: <strong className="text-stone-800 dark:text-stone-200">{inspectingItem.uploadedByName || 'Institution'}</strong> ({inspectingItem.uploaderRole || 'admin'})
                </span>
              </div>
              <button
                onClick={() => setInspectingItem(null)}
                className="px-4 py-1.5 bg-stone-900 dark:bg-stone-800 hover:bg-black dark:hover:bg-stone-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          SUB-MODAL: DELETE CONFIRMATION
          ======================================================== */}
      {itemToDelete && (
        <div
          className="fixed inset-0 z-[120] bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setItemToDelete(null)}
        >
          <div
            className="bg-white dark:bg-stone-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-stone-200 dark:border-stone-800 animate-in zoom-in-95 duration-150 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-rose-950/50 text-red-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-red-100 dark:border-rose-900/60">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">Remove Photo?</h4>
                <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-1">{itemToDelete.title}</p>
              </div>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              Are you sure you want to remove this photograph from the archival gallery? This action is recorded in the institutional logs.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-3.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteGalleryItem(itemToDelete.id);
                  setItemToDelete(null);
                }}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                Delete Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
