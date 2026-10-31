'use client';

import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, ThumbsUp, RefreshCw, Sparkles, User, Award } from 'lucide-react';
import { FeedbackData } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export default function HotelFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<FeedbackData[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    avgRating: number;
    counts: Record<number, number>;
  }>({
    total: 0,
    avgRating: 0,
    counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });
  const [loading, setLoading] = useState(true);

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/hotel/feedback');
      if (res.ok) {
        const data = await res.json();
        setFeedbacks(data.feedbacks || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-extrabold text-stone-900">
            Guest Dining Reviews & Ratings
          </h1>
          <p className="text-xs text-stone-600 mt-1">
            Real guest reviews and ratings collected at the end of meals
          </p>
        </div>

        <button
          onClick={fetchFeedback}
          className="px-4 py-2 rounded-xl dark-btn text-stone-700 text-xs font-semibold flex items-center space-x-2 border border-stone-200 hover:border-amber-400"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Score Card */}
        <div className="p-8 rounded-3xl bg-white border border-amber-200/80 flex flex-col items-center justify-center text-center shadow-sm">
          <span className="text-xs uppercase tracking-[0.25em] text-amber-700 font-serif font-bold mb-1">
            AVERAGE RATING
          </span>
          <div className="text-6xl font-serif font-black text-stone-900 my-3">
            {stats.avgRating.toFixed(1)}
          </div>
          <div className="flex items-center space-x-1 my-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-5 h-5 ${
                  star <= Math.round(stats.avgRating)
                    ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                    : 'text-stone-200'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-stone-600 mt-2 font-medium">
            Based on {stats.total} verified {stats.total === 1 ? 'review' : 'reviews'}
          </p>
        </div>

        {/* 5-Star Breakdown */}
        <div className="md:col-span-2 p-8 rounded-3xl bg-white border border-stone-200/80 shadow-sm flex flex-col justify-center space-y-3">
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = stats.counts[rating] || 0;
            const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
            return (
              <div key={rating} className="flex items-center space-x-3.5 text-xs">
                <div className="flex items-center space-x-1.5 w-12 font-bold text-stone-700">
                  <span>{rating}</span>
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                </div>
                <div className="flex-1 h-2.5 bg-stone-100 rounded-full overflow-hidden border border-stone-200">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-700"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="w-8 text-right text-stone-600 font-mono font-bold">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reviews Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-serif font-bold text-stone-900">Recent Guest Feedback</h2>

        {loading ? (
          <div className="p-12 text-center text-xs text-stone-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-600 mb-2" />
            Loading reviews...
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="p-16 text-center bg-white border border-stone-200/80 rounded-3xl shadow-sm">
            <Star className="w-12 h-12 text-stone-300 mx-auto mb-2 opacity-50" />
            <h3 className="font-serif font-bold text-stone-900 text-base">No reviews yet</h3>
            <p className="text-xs text-stone-600 mt-1">
              Guest feedback will show up here automatically when orders are marked done.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {feedbacks.map((f) => (
              <div
                key={f.id}
                className="p-6 rounded-3xl bg-white border border-stone-200/80 hover:border-amber-400/50 transition shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shadow-sm">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-serif font-bold text-xs sm:text-sm text-stone-900">
                          {f.customerName || 'Dining Guest'}
                        </h4>
                        <p className="text-[10px] text-stone-500">
                          {f.order?.tableNumber ? `Table #${f.order.tableNumber} • ` : ''}
                          {formatDate(f.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            star <= f.rating
                              ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                              : 'text-stone-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {f.comment ? (
                    <p className="text-xs text-stone-700 italic leading-relaxed font-normal">
                      "{f.comment}"
                    </p>
                  ) : (
                    <p className="text-xs text-stone-400 italic">5-star rating without written comment</p>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-stone-100 text-[10px] text-stone-500 flex justify-between font-mono">
                  <span>Verified QR Order</span>
                  <span className="text-amber-700 font-bold">#{f.orderId.slice(-6).toUpperCase()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
