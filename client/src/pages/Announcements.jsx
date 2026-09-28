import { useEffect, useState } from "react";
import { useUniversalPersistence } from "../hooks/useUniversalPersistenceSimple";
import { useTranslation } from "../context/TranslationContext";

const Announcements = () => {
  const { t } = useTranslation();
  // Use universal persistence for announcements
  const { data: announcements, loading, error, addItem, updateItem, removeItem } = useUniversalPersistence('announcements');
  
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("unstop_token");

  const markAsRead = async (id) => {
    try {
      await updateItem(id, { status: 'read' });
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
            key={a._id}
            className="border rounded-lg p-4 bg-white hover:bg-gray-50 cursor-pointer"
            onClick={() => markAsRead(a._id)}
          >
            <h3 className="font-semibold text-lg">{a.title}</h3>
            <p className="text-gray-700 mt-1">{a.content || a.message}</p>
            <p className="text-xs text-gray-400 mt-2">
              {new Date(a.createdAt).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Announcements;
