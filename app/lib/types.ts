export type Sport = "football" | "basketball";

export type ShirtCategory = "club" | "national";

export type ShirtStatus = "collection" | "wishlist";

export type ShirtImage = {
  id: string;
  url: string;
  label?: string;
};

export type Shirt = {
  id: string;
  user_id?: string;
  created_at?: string;
  sport: Sport;
  category: ShirtCategory;
  country: string;
  league: string;
  team: string;
  season: string;
  player: string;
  number: string;
  kitType: string;
  size: string;
  status: ShirtStatus;
  images: ShirtImage[];
  mainImageId: string;
  notes: string;
};

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  is_public: boolean;
  show_collection: boolean;
  show_wishlist: boolean;
  created_at?: string;
};

export type ShirtFormState = {
  sport: Sport | "";
  category: ShirtCategory | "";
  country: string;
  league: string;
  team: string;
  season: string;
  player: string;
  number: string;
  kitType: string;
  size: string;
  status: ShirtStatus | "";
  images: ShirtImage[];
  mainImageId: string;
  notes: string;
  customTeam: string;
};

export type ShirtFilters = {
  search: string;
  sport: "all" | Sport;
  category: "all" | ShirtCategory;
  status: "all" | ShirtStatus;
  country: string;
  league: string;
  team: string;
  year: string;
};

export type LeagueCatalog = Record<
  Sport,
  Record<ShirtCategory, Record<string, Record<string, string[]>>>
>;

export type TeamOption = {
  id: string;
  team: string;
  sport: Sport;
  category: ShirtCategory;
  country: string;
  league: string;
};
