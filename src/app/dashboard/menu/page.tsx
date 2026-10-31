'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Check,
  X,
  Box,
  Image as ImageIcon,
  UtensilsCrossed,
  Filter,
  RefreshCw,
  Sparkles,
  Camera,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Link2,
  ZoomIn,
  Flame,
  ArrowUpDown,
  Award,
  TrendingUp,
} from 'lucide-react';
import { MenuItemData } from '@/lib/types';
import { formatNPR, SYSTEM_CATEGORIES, getCategoryDetails } from '@/lib/utils';
import ImageZoomModal from '@/components/ImageZoomModal';

export default function HotelMenuManagerPage() {
  const [items, setItems] = useState<MenuItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'most_ordered' | 'price_asc' | 'price_desc' | 'name'>('default');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemData | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'SNAKS,CUISINE',
    price: '',
    imageUrl: '',
    description: '',
    isAvailable: true,
    is3dEnabled: false,
    modelUrl: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Picture Upload from Device State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [uploadStats, setUploadStats] = useState<{
    size?: number;
    originalSize?: number;
    compressionRatio?: string;
  } | null>(null);

  // Category Selection State
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  // Photo Zoom Modal state
  const [zoomItem, setZoomItem] = useState<{
    isOpen: boolean;
    name: string;
    imageUrl: string;
    price?: number;
    category?: string;
    description?: string | null;
  }>({
    isOpen: false,
    name: '',
    imageUrl: '',
  });

  // 3D Model File Upload State
  const modelFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingModel, setIsUploadingModel] = useState(false);
  const [modelUploadError, setModelUploadError] = useState<string | null>(null);
  const [showModelUrlInput, setShowModelUrlInput] = useState(false);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/hotel/menu');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const compressOnDevice = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      if (
        !file.type.startsWith('image/') ||
        file.type === 'image/svg+xml' ||
        file.type === 'image/gif'
      ) {
        return resolve(file);
      }
      if (file.size < 400 * 1024) {
        return resolve(file);
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const maxDimension = 1600;
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              const compressed = new File([blob], file.name, { type: 'image/jpeg' });
              resolve(compressed);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => resolve(file);
      img.src = objectUrl;
    });
  };

  const uploadImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (JPG, PNG, WEBP)');
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setUploadError('Image size must be under 30MB');
      return;
    }

    setUploadError(null);
    setIsUploadingImage(true);

    try {
      // Step 1: Pre-compress high-res mobile photos client-side to speed up upload
      const fileToUpload = await compressOnDevice(file);

      const data = new FormData();
      data.append('file', fileToUpload);

      // Step 2: Server-side Sharp compression (WebP conversion + EXIF orientation)
      const res = await fetch('/api/hotel/upload', {
        method: 'POST',
        body: data,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to upload image');
      }

      setFormData((prev) => ({ ...prev, imageUrl: json.url }));
      if (json.size) {
        setUploadStats({
          size: json.size,
          originalSize: file.size,
          compressionRatio:
            json.compressionRatio ||
            (file.size > json.size
              ? `${Math.round((1 - json.size / file.size) * 100)}%`
              : '0%'),
        });
      }
    } catch (err: any) {
      console.error('Image upload failed:', err);
      setUploadError(err.message || 'Failed to upload picture from device');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadImageFile(file);
    }
    if (e.target) e.target.value = '';
  };

  const handleDropImage = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadImageFile(file);
    }
  };

  const uploadModelFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.glb') && !file.name.toLowerCase().endsWith('.gltf')) {
      setModelUploadError('Please select a .glb or .gltf 3D model file');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setModelUploadError('Model size exceeds 25MB limit');
      return;
    }

    setModelUploadError(null);
    setIsUploadingModel(true);

    try {
      const data = new FormData();
      data.append('file', file);

      const res = await fetch('/api/hotel/upload', {
        method: 'POST',
        body: data,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to upload 3D model');
      }

      setFormData((prev) => ({ ...prev, modelUrl: json.url }));
    } catch (err: any) {
      console.error('3D model upload failed:', err);
      setModelUploadError(err.message || 'Failed to upload 3D model');
    } finally {
      setIsUploadingModel(false);
    }
  };

  const handleModelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadModelFile(file);
    }
    if (e.target) e.target.value = '';
  };

  const openAddModal = (defaultCategory?: string) => {
    setEditingItem(null);
    const initialCat =
      defaultCategory || (activeCategory !== 'all' ? activeCategory : 'SNAKS,CUISINE');
    setFormData({
      name: '',
      category: initialCat,
      price: '',
      imageUrl: '',
      description: '',
      isAvailable: true,
      is3dEnabled: false,
      modelUrl: '',
    });
    setIsCustomCategory(
      !SYSTEM_CATEGORIES.some((c) => c.key.toUpperCase() === initialCat.toUpperCase())
    );
    setShowUrlInput(false);
    setUploadError(null);
    setUploadStats(null);
    setShowModelUrlInput(false);
    setModelUploadError(null);
    setIsDragging(false);
    setIsModalOpen(true);
  };

  const openEditModal = (item: MenuItemData) => {
    setEditingItem(item);
    const standardKeys = [
      'BED ROOM',
      'DRINK',
      'SNAKS,CUISINE',
      'SNACKS',
      'CUISINE',
      'BREAKFAST',
      'FAST FOOD',
      'DESSERT',
      'SPECIALS',
    ];
    const isStandard = standardKeys.includes((item.category || '').toUpperCase());

    setIsCustomCategory(!isStandard);
    setFormData({
      name: item.name,
      category: item.category,
      price: item.price.toString(),
      imageUrl: item.imageUrl || '',
      description: item.description || '',
      isAvailable: item.isAvailable,
      is3dEnabled: item.is3dEnabled,
      modelUrl: item.modelUrl || '',
    });
    setShowUrlInput(false);
    setUploadError(null);
    setUploadStats(null);
    setShowModelUrlInput(false);
    setModelUploadError(null);
    setIsDragging(false);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category || !formData.price) {
      alert('Please fill out all required fields');
      return;
    }

    setIsSaving(true);
    try {
      if (editingItem) {
        const res = await fetch(`/api/hotel/menu/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          await fetchItems();
          setIsModalOpen(false);
        }
      } else {
        const res = await fetch('/api/hotel/menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          await fetchItems();
          setIsModalOpen(false);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAvailability = async (item: MenuItemData) => {
    try {
      const res = await fetch(`/api/hotel/menu/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !item.isAvailable }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, isAvailable: !item.isAvailable } : i
          )
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('Are you sure you want to remove this dish from the menu?')) return;

    try {
      const res = await fetch(`/api/hotel/menu/${itemId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // List all system categories + any custom categories present in the hotel's items
  const allCategories = useMemo(() => {
    const standardKeys = SYSTEM_CATEGORIES.map((c) => c.key);
    const existingCustom = Array.from(new Set(items.map((i) => i.category))).filter(
      (c) => !standardKeys.some((sk) => sk.toUpperCase() === c.toUpperCase())
    );
    return [...standardKeys, ...existingCustom];
  }, [items]);

  // Hotel-wide sorted rank map based on order sales
  const itemRankMap = useMemo(() => {
    const sorted = [...items].sort((a, b) => (b.totalOrdered || 0) - (a.totalOrdered || 0));
    const map = new Map<string, number>();
    sorted.forEach((it, idx) => {
      if ((it.totalOrdered || 0) > 0) {
        map.set(it.id, idx + 1);
      }
    });
    return map;
  }, [items]);

  const filteredItems = useMemo(() => {
    const filtered = items.filter((item) => {
      const matchesCategory =
        activeCategory === 'all' || item.category === activeCategory;
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description &&
          item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });

    if (sortBy === 'most_ordered') {
      return [...filtered].sort((a, b) => {
        const countA = a.totalOrdered || 0;
        const countB = b.totalOrdered || 0;
        if (countB !== countA) return countB - countA;
        return (b.totalRevenue || 0) - (a.totalRevenue || 0);
      });
    } else if (sortBy === 'price_asc') {
      return [...filtered].sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      return [...filtered].sort((a, b) => b.price - a.price);
    } else if (sortBy === 'name') {
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }

    return filtered;
  }, [items, activeCategory, searchQuery, sortBy]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-extrabold text-stone-900">
            Digital Menu Manager
          </h1>
          <p className="text-xs text-stone-600 mt-1">
            Manage your food & drink catalog, prices, and instant stock availability
          </p>
        </div>

        <button
          onClick={() => openAddModal()}
          className="px-5 py-3 rounded-2xl gold-btn text-xs font-extrabold flex items-center justify-center space-x-2 shadow-sm text-stone-950"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Menu Item</span>
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Category Pills & Most Ordered Quick Pill */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {/* Quick Toggle: Most Ordered */}
          <button
            onClick={() => {
              if (sortBy === 'most_ordered') {
                setSortBy('default');
              } else {
                setSortBy('most_ordered');
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center space-x-1.5 shadow-sm ${
              sortBy === 'most_ordered'
                ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-sm border border-amber-300 ring-2 ring-amber-400/40'
                : 'dark-btn text-amber-700 hover:text-amber-800 border-amber-300/60'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${sortBy === 'most_ordered' ? 'animate-bounce text-yellow-200' : 'text-amber-600'}`} />
            <span>Most Ordered</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              sortBy === 'most_ordered' ? 'bg-black/30 text-yellow-200' : 'bg-amber-100 text-amber-800'
            }`}>
              Top
            </span>
          </button>

          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-1.5 ${
              activeCategory === 'all' && sortBy !== 'most_ordered'
                ? 'gold-btn text-stone-950 shadow-sm'
                : 'dark-btn text-stone-600 hover:text-stone-900 border-stone-200'
            }`}
          >
            <span>🍽️</span>
            <span>All Items</span>
            <span className="opacity-75 text-[11px]">({items.length})</span>
          </button>
          {allCategories.map((cat) => {
            const info = getCategoryDetails(cat);
            const count = items.filter((i) => i.category.toUpperCase() === cat.toUpperCase()).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-1.5 ${
                  activeCategory === cat && sortBy !== 'most_ordered'
                    ? 'gold-btn text-stone-950 shadow-sm'
                    : 'dark-btn text-stone-600 hover:text-stone-900 border-stone-200'
                }`}
              >
                <span>{info.icon}</span>
                <span>{info.label}</span>
                <span className={`text-[11px] ${count > 0 ? 'text-amber-700 font-extrabold' : 'opacity-40'}`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Sort Dropdown */}
        <div className="flex items-center space-x-2.5">
          <div className="relative min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 shadow-sm"
            />
          </div>

          <div className="relative shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 font-bold focus:outline-none focus:border-amber-500 cursor-pointer shadow-sm pr-7"
            >
              <option value="default">Default Order</option>
              <option value="most_ordered">🔥 Most Ordered (First to Last)</option>
              <option value="price_desc">💰 Price: High to Low</option>
              <option value="price_asc">🏷️ Price: Low to High</option>
              <option value="name">🔤 Name (A - Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Most Ordered Informational Insights Banner */}
      {sortBy === 'most_ordered' && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm animate-fade-in">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200 shrink-0">
              <Flame className="w-5 h-5 animate-pulse text-amber-600" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-serif font-black text-stone-900 text-sm">Most Ordered & Bestseller Ranking</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                  Real Sales Data
                </span>
              </div>
              <p className="text-stone-600 text-[11px] mt-0.5">
                Displaying all dishes sorted strictly from #1 highest selling down to least ordered (first to last).
              </p>
            </div>
          </div>
          <button
            onClick={() => setSortBy('default')}
            className="text-[11px] font-bold text-amber-700 hover:text-amber-800 px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:border-amber-300 whitespace-nowrap self-start sm:self-center transition shadow-sm"
          >
            Reset to Default
          </button>
        </div>
      )}

      {/* Items Grid */}
      {loading ? (
        <div className="p-16 text-center">
          <RefreshCw className="w-8 h-8 text-amber-600 animate-spin mx-auto mb-2" />
          <p className="text-xs text-stone-500">Loading catalog...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-16 text-center bg-white border border-stone-200/80 rounded-3xl shadow-sm">
          <div className="text-4xl mb-3">
            {activeCategory !== 'all' ? getCategoryDetails(activeCategory).icon : '🍽️'}
          </div>
          <h3 className="font-serif font-bold text-stone-900 text-base">
            {activeCategory !== 'all'
              ? `No items in ${getCategoryDetails(activeCategory).label} yet`
              : 'No items found'}
          </h3>
          <p className="text-xs text-stone-600 mt-1 mb-5">
            {activeCategory !== 'all'
              ? `Add delicious ${getCategoryDetails(activeCategory).label.toLowerCase()} dishes to your live menu.`
              : 'Add delicious dishes to your live digital menu'}
          </p>
          <button
            onClick={() => openAddModal(activeCategory !== 'all' ? activeCategory : undefined)}
            className="px-6 py-2.5 rounded-xl gold-btn text-xs font-bold shadow-sm text-stone-950 inline-flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>
              {activeCategory !== 'all'
                ? `Add ${getCategoryDetails(activeCategory).label} Item`
                : 'Add First Item'}
            </span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`bg-white border rounded-3xl overflow-hidden shadow-sm hover:shadow-md flex flex-col justify-between transition-all duration-300 ${
                item.isAvailable
                  ? 'border-stone-200/80 hover:border-amber-400/50'
                  : 'border-red-300 opacity-75'
              }`}
            >
              {/* Photo & Badges */}
              <div
                onClick={() => {
                  if (item.imageUrl) {
                    setZoomItem({
                      isOpen: true,
                      name: item.name,
                      imageUrl: item.imageUrl,
                      price: item.price,
                      category: item.category,
                      description: item.description,
                    });
                  }
                }}
                className={`relative w-full h-40 bg-stone-100 overflow-hidden ${
                  item.imageUrl ? 'cursor-zoom-in group/itemphoto' : ''
                }`}
                title={item.imageUrl ? 'Click to zoom and inspect photo' : undefined}
              >
                {item.imageUrl ? (
                  <>
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover/itemphoto:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/75 backdrop-blur border border-white/10 text-white text-[9px] font-bold opacity-0 group-hover/itemphoto:opacity-100 transition-opacity flex items-center space-x-1 pointer-events-none">
                      <ZoomIn className="w-2.5 h-2.5 text-amber-400" />
                      <span>Inspect</span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-stone-400">
                    <ImageIcon className="w-8 h-8 mb-1 opacity-40" />
                    <span className="text-[10px]">No image</span>
                  </div>
                )}

                <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-white/90 backdrop-blur border border-stone-200 text-[10px] font-bold text-amber-800 flex items-center space-x-1 shadow-sm">
                  <span>{getCategoryDetails(item.category).icon}</span>
                  <span>{getCategoryDetails(item.category).label}</span>
                </div>

                {/* Sales Rank & Ordered Count Badge */}
                {(() => {
                  const rank = itemRankMap.get(item.id);
                  const count = item.totalOrdered || 0;
                  if (rank) {
                    return (
                      <div
                        className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-lg text-[10px] font-black flex items-center space-x-1 shadow-sm backdrop-blur z-10 ${
                          rank === 1
                            ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-stone-950 border border-yellow-200'
                            : rank === 2
                            ? 'bg-gradient-to-r from-stone-200 to-stone-400 text-stone-900 border border-white'
                            : rank === 3
                            ? 'bg-gradient-to-r from-amber-700 to-orange-700 text-amber-50 border border-amber-600'
                            : 'bg-stone-900/85 text-amber-300 border border-amber-400/30'
                        }`}
                      >
                        <span>
                          {rank === 1 ? '👑 #1' : rank === 2 ? '🥈 #2' : rank === 3 ? '🥉 #3' : `🔥 #${rank}`}
                        </span>
                        <span className="text-[9px] font-bold">({count} sold)</span>
                      </div>
                    );
                  }
                  if (sortBy === 'most_ordered') {
                    return (
                      <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-lg bg-stone-900/75 text-stone-300 border border-white/10 text-[9px] font-bold z-10">
                        0 sold yet
                      </div>
                    );
                  }
                  return null;
                })()}

                {item.is3dEnabled && !itemRankMap.has(item.id) && (
                  <div className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-brandPink-500 text-white text-[9px] font-bold flex items-center space-x-1 shadow-sm">
                    <Box className="w-3 h-3" />
                    <span>3D</span>
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-serif font-bold text-stone-900 text-base leading-snug">
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="text-xs text-stone-600 mt-1.5 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-3.5 border-t border-stone-100 flex items-center justify-between">
                  <div>
                    <span className="text-base font-serif font-black text-amber-700 block">
                      {formatNPR(item.price)}
                    </span>
                    {(item.totalOrdered || 0) > 0 && (
                      <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
                        {item.totalOrdered} ordered • {formatNPR(item.totalRevenue || 0)}
                      </span>
                    )}
                  </div>

                  {/* 1-Click Availability Toggle */}
                  <button
                    onClick={() => toggleAvailability(item)}
                    className={`px-3 py-1 rounded-xl text-[10px] font-bold transition flex items-center space-x-1.5 ${
                      item.isAvailable
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        item.isAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                      }`}
                    />
                    <span>{item.isAvailable ? 'In Stock' : 'Out of Stock'}</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="px-5 py-3 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
                <button
                  onClick={() => openEditModal(item)}
                  className="text-xs text-stone-700 hover:text-amber-700 font-semibold flex items-center space-x-1.5 transition"
                >
                  <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>Edit</span>
                </button>

                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center space-x-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-white border border-stone-200 rounded-3xl shadow-2xl overflow-hidden text-stone-800">
            <div className="px-6 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
              <h2 className="font-serif font-extrabold text-stone-900 text-base">
                {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Item Name <span className="text-amber-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Special Mutton Sekuwa (मटन सेकुवा)"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 shadow-inner"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-stone-700">
                      Category <span className="text-amber-600">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomCategory(!isCustomCategory);
                        if (isCustomCategory && !formData.category) {
                          setFormData((prev) => ({ ...prev, category: 'SNAKS,CUISINE' }));
                        }
                      }}
                      className="text-[10px] text-amber-600 hover:text-amber-700 font-bold transition"
                    >
                      {isCustomCategory ? 'Choose from list' : '+ Type custom category'}
                    </button>
                  </div>

                  {isCustomCategory ? (
                    <div className="space-y-1">
                      <input
                        type="text"
                        required
                        placeholder="e.g. BED ROOM, DRINK, BAKERY..."
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 shadow-inner"
                      />
                      <p className="text-[10px] text-stone-500">
                        Type any custom category name to create a new category section.
                      </p>
                    </div>
                  ) : (
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => {
                        if (e.target.value === '__OTHER__') {
                          setIsCustomCategory(true);
                          setFormData({ ...formData, category: '' });
                        } else {
                          setFormData({ ...formData, category: e.target.value });
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-500 shadow-inner cursor-pointer"
                    >
                      <option value="" disabled>
                        -- Select Category --
                      </option>
                      <optgroup label="Hotel Rooms & Drinks" className="bg-stone-50 text-amber-700 font-bold">
                        <option value="BED ROOM" className="bg-white text-stone-900">
                          🛏️ Bed Room (Room Service)
                        </option>
                        <option value="DRINK" className="bg-white text-stone-900">
                          🍹 Drink / Beverages
                        </option>
                        <option value="SNAKS,CUISINE" className="bg-white text-stone-900">
                          🍲 Snacks & Cuisine
                        </option>
                      </optgroup>
                      <optgroup label="Food & Dining Categories" className="bg-stone-50 text-amber-700 font-bold">
                        <option value="SNACKS" className="bg-white text-stone-900">
                          🥟 Snacks & Starters
                        </option>
                        <option value="CUISINE" className="bg-white text-stone-900">
                          🍛 Cuisine & Main Course
                        </option>
                        <option value="BREAKFAST" className="bg-white text-stone-900">
                          🍳 Breakfast
                        </option>
                        <option value="FAST FOOD" className="bg-white text-stone-900">
                          🍔 Fast Food / Momo / Sekuwa
                        </option>
                        <option value="DESSERT" className="bg-white text-stone-900">
                          🍰 Desserts & Sweets
                        </option>
                        <option value="SPECIALS" className="bg-white text-stone-900">
                          ✨ Chef Specials
                        </option>
                      </optgroup>
                      {allCategories
                        .filter(
                          (c: string) =>
                            ![
                              'BED ROOM',
                              'DRINK',
                              'SNAKS,CUISINE',
                              'SNACKS',
                              'CUISINE',
                              'BREAKFAST',
                              'FAST FOOD',
                              'DESSERT',
                              'SPECIALS',
                            ].includes(c.toUpperCase())
                        )
                        .map((cat: string) => (
                          <option key={cat} value={cat} className="bg-white text-stone-900">
                            🏷️ {cat}
                          </option>
                        ))}
                      <option value="__OTHER__" className="bg-stone-50 text-amber-600 font-semibold">
                        ➕ Other / Type New Category...
                      </option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Price (NPR) <span className="text-amber-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1"
                    placeholder="e.g. 550"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 shadow-inner"
                  />
                </div>
              </div>

              {/* Picture Upload from Device */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-stone-700">
                    Food Picture
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="text-[11px] text-amber-600 hover:text-amber-700 font-bold transition flex items-center space-x-1"
                  >
                    <Link2 className="w-3 h-3" />
                    <span>{showUrlInput ? 'Upload from device instead' : 'Enter image URL instead'}</span>
                  </button>
                </div>

                {showUrlInput ? (
                  <div>
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/..."
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 shadow-inner"
                    />
                    <p className="text-[10px] text-stone-500 mt-1">
                      Paste a direct web link to an image (Unsplash, Cloudinary, etc.)
                    </p>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />

                    {formData.imageUrl ? (
                      /* Preview & change/remove controls */
                      <div className="border border-stone-200 rounded-2xl overflow-hidden bg-stone-50 flex items-center p-3 space-x-3">
                        <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                          <img
                            src={formData.imageUrl}
                            alt="Food preview"
                            className="w-full h-full object-cover"
                          />
                          {isUploadingImage && (
                            <div className="absolute inset-0 bg-stone-900/40 flex items-center justify-center">
                              <RefreshCw className="w-5 h-5 text-amber-500 animate-spin" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-600 mb-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">
                              {isUploadingImage
                                ? 'Uploading & compressing...'
                                : uploadStats?.compressionRatio && uploadStats.compressionRatio !== '0%'
                                ? `Compressed (${uploadStats.compressionRatio} smaller)`
                                : 'Picture ready'}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-500 truncate mb-2">
                            {uploadStats?.size
                              ? `${(uploadStats.size / 1024).toFixed(0)} KB • WebP Optimized`
                              : formData.imageUrl.startsWith('/uploads/')
                              ? 'Saved & optimized on server'
                              : formData.imageUrl}
                          </p>

                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              disabled={isUploadingImage}
                              onClick={() => fileInputRef.current?.click()}
                              className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg text-[11px] font-medium transition flex items-center space-x-1 shadow-sm"
                            >
                              <Camera className="w-3 h-3 text-amber-600" />
                              <span>Change Photo</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, imageUrl: '' })}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-[11px] font-medium transition flex items-center space-x-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Remove</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Drag & Drop / Click to Upload Box */
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDropImage}
                        className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                          isDragging
                            ? 'border-amber-500 bg-amber-50 scale-[1.01]'
                            : 'border-stone-200 bg-stone-50/70 hover:bg-stone-50 hover:border-amber-400'
                        }`}
                      >
                        {isUploadingImage ? (
                          <div className="py-2 flex flex-col items-center space-y-2">
                            <RefreshCw className="w-7 h-7 text-amber-500 animate-spin" />
                            <p className="text-xs font-semibold text-stone-700">
                              Uploading picture from device...
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 mb-2">
                              <Camera className="w-5 h-5" />
                            </div>
                            <p className="text-xs font-bold text-stone-900 mb-0.5">
                              Click to take photo or choose from device
                            </p>
                            <p className="text-[11px] text-stone-500">
                              Upload directly from your phone camera or gallery (JPG, PNG, WEBP)
                            </p>
                          </>
                        )}
                      </div>
                    )}

                    {uploadError && (
                      <div className="mt-2 text-xs text-rose-600 flex items-center space-x-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{uploadError}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Short description of ingredients, style, or marinade..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 shadow-inner"
                />
              </div>

              {/* 3D Model Option */}
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Box className="w-4 h-4 text-amber-600" />
                    <div>
                      <span className="text-xs font-bold text-stone-900 block">3D Food Preview</span>
                      <span className="text-[10px] text-stone-500">Interactive 360° touch and zoom view</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.is3dEnabled}
                    onChange={(e) => setFormData({ ...formData, is3dEnabled: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                </div>

                {formData.is3dEnabled && (
                  <div className="pt-2 border-t border-stone-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-medium text-stone-600">
                        3D Model File (.glb)
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowModelUrlInput(!showModelUrlInput)}
                        className="text-[10px] text-amber-600 hover:text-amber-700 font-bold"
                      >
                        {showModelUrlInput ? 'Upload .glb from device' : 'Enter URL instead'}
                      </button>
                    </div>

                    {showModelUrlInput ? (
                      <input
                        type="url"
                        placeholder="https://.../model.glb"
                        value={formData.modelUrl}
                        onChange={(e) => setFormData({ ...formData, modelUrl: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500"
                      />
                    ) : (
                      <div>
                        <input
                          type="file"
                          ref={modelFileInputRef}
                          accept=".glb,.gltf"
                          onChange={handleModelFileChange}
                          className="hidden"
                        />
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            disabled={isUploadingModel}
                            onClick={() => modelFileInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-lg bg-white hover:bg-stone-100 border border-stone-200 text-xs text-stone-700 font-medium flex items-center space-x-1.5 transition shadow-sm"
                          >
                            {isUploadingModel ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                            ) : (
                              <UploadCloud className="w-3.5 h-3.5 text-amber-600" />
                            )}
                            <span>
                              {isUploadingModel
                                ? 'Uploading .glb...'
                                : formData.modelUrl
                                ? 'Change .glb Model'
                                : 'Upload .glb from Device'}
                            </span>
                          </button>
                          {formData.modelUrl && (
                            <div className="flex items-center space-x-1 text-[11px] text-emerald-600 truncate max-w-[180px]">
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              <span className="truncate">{formData.modelUrl.split('/').pop()}</span>
                            </div>
                          )}
                        </div>
                        {modelUploadError && (
                          <p className="text-[10px] text-rose-600 mt-1">{modelUploadError}</p>
                        )}
                        <p className="text-[10px] text-stone-500 mt-1">
                          Default demo 3D model used if left blank.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl dark-btn text-stone-700 border border-stone-200 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isUploadingImage || isUploadingModel}
                  className="px-6 py-2.5 rounded-xl gold-btn text-xs font-extrabold shadow-gold-glow disabled:opacity-50"
                >
                  {isSaving
                    ? 'Saving...'
                    : isUploadingImage || isUploadingModel
                    ? 'Uploading...'
                    : editingItem
                    ? 'Save Changes'
                    : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Zoom Inspection Modal */}
      <ImageZoomModal
        isOpen={zoomItem.isOpen}
        onClose={() => setZoomItem((prev) => ({ ...prev, isOpen: false }))}
        imageUrl={zoomItem.imageUrl}
        itemName={zoomItem.name}
        price={zoomItem.price}
        category={zoomItem.category}
        description={zoomItem.description}
      />
    </div>
  );
}
