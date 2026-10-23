import { useEffect, useState } from "react";
import { useUniversalPersistence } from "../hooks/useUniversalPersistenceSimple";
import { useTranslation } from "../context/TranslationContext";
import { useAuth } from "../auth/auth";

const Announcements = () => {
  const { t } = useTranslation();
  const { API, token } = useAuth();
  // Use universal persistence for announcements
  const { data: announcements, loading, error } = useUniversalPersistence('announcements');

  // Same per-user read receipt the AnnouncementBell uses. Never PUT the
  // announcement record itself: that would edit it for every recipient.
  const markAsRead = async (id) => {
    if (id === undefined || id === null) return;
    try {
      await fetch(`${API}/announcements/${id}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch (error) {
      console.error('Error marking announcement as read:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{t('error_loading_announcements')}: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t('announcements')}</h1>

      {announcements.length === 0 && (
        <p className="text-gray-500">{t('no_announcements_available')}</p>
      )}

      <div className="space-y-4">
        {announcements.map((a) => (
          <div
            key={a.id ?? a._id}
            className="border rounded-lg p-4 bg-white hover:bg-gray-50 cursor-pointer"
            onClick={() => markAsRead(a.id ?? a._id)}
          >
            <h3 className="font-semibold text-lg">{a.title}</h3>
            <p className="text-gray-700 mt-1">{a.content || a.message}</p>
            <p className="text-xs text-gray-400 mt-2">
              {new Date(a.createdAt || a.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Announcements;
