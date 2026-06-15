"use client";

import { AuthenticatedRoute } from "../components/AuthenticatedRoute";
import { ProfileSettingsPage } from "../components/ProfileSettingsPage";

export default function ProfilePage() {
  return (
    <AuthenticatedRoute>
      {({ onLogout }) => <ProfileSettingsPage onLogout={onLogout} />}
    </AuthenticatedRoute>
  );
}
