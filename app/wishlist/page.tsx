"use client";

import { AuthenticatedRoute } from "../components/AuthenticatedRoute";
import { ShirtCollectionApp } from "../components/ShirtCollectionApp";

export default function WishlistPage() {
  return (
    <AuthenticatedRoute>
      {({ onLogout }) => (
        <ShirtCollectionApp
          onLogout={onLogout}
          defaultViewMode="wishlist"
        />
      )}
    </AuthenticatedRoute>
  );
}
