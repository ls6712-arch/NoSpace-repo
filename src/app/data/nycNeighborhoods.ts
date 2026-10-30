/**
 * New York neighborhoods offered on the "where" screen: a name and a rough
 * centre, so "Use my location" can pick the nearest one without sending the
 * position anywhere. Not a complete list: anything typed is kept as typed.
 */
export interface Neighborhood {
  name: string;
  /** The borough, shown after the name while typing. */
  borough: "Manhattan" | "Brooklyn" | "Queens" | "The Bronx" | "Staten Island";
  lat: number;
  lng: number;
}

export const NYC_NEIGHBORHOODS: readonly Neighborhood[] = [
  { name: "Alphabet City", borough: "Manhattan", lat: 40.7260, lng: -73.9777 },
  { name: "Chelsea", borough: "Manhattan", lat: 40.7465, lng: -74.0014 },
  { name: "Chinatown", borough: "Manhattan", lat: 40.7158, lng: -73.9970 },
  { name: "East Harlem", borough: "Manhattan", lat: 40.7957, lng: -73.9389 },
  { name: "East Village", borough: "Manhattan", lat: 40.7265, lng: -73.9815 },
  { name: "Financial District", borough: "Manhattan", lat: 40.7075, lng: -74.0089 },
  { name: "Flatiron", borough: "Manhattan", lat: 40.7411, lng: -73.9897 },
  { name: "Gramercy", borough: "Manhattan", lat: 40.7368, lng: -73.9845 },
  { name: "Greenwich Village", borough: "Manhattan", lat: 40.7336, lng: -74.0027 },
  { name: "Harlem", borough: "Manhattan", lat: 40.8116, lng: -73.9465 },
  { name: "Hell’s Kitchen", borough: "Manhattan", lat: 40.7638, lng: -73.9918 },
  { name: "Inwood", borough: "Manhattan", lat: 40.8677, lng: -73.9212 },
  { name: "Lower East Side", borough: "Manhattan", lat: 40.7150, lng: -73.9843 },
  { name: "Midtown", borough: "Manhattan", lat: 40.7549, lng: -73.9840 },
  { name: "Murray Hill", borough: "Manhattan", lat: 40.7479, lng: -73.9757 },
  { name: "SoHo", borough: "Manhattan", lat: 40.7233, lng: -74.0030 },
  { name: "Upper East Side", borough: "Manhattan", lat: 40.7736, lng: -73.9566 },
  { name: "Upper West Side", borough: "Manhattan", lat: 40.7870, lng: -73.9754 },
  { name: "Washington Heights", borough: "Manhattan", lat: 40.8417, lng: -73.9394 },
  { name: "West Village", borough: "Manhattan", lat: 40.7358, lng: -74.0036 },
  { name: "Bay Ridge", borough: "Brooklyn", lat: 40.6264, lng: -74.0299 },
  { name: "Bed-Stuy", borough: "Brooklyn", lat: 40.6872, lng: -73.9418 },
  { name: "Boerum Hill", borough: "Brooklyn", lat: 40.6849, lng: -73.9836 },
  { name: "Bushwick", borough: "Brooklyn", lat: 40.6944, lng: -73.9213 },
  { name: "Carroll Gardens", borough: "Brooklyn", lat: 40.6795, lng: -73.9991 },
  { name: "Clinton Hill", borough: "Brooklyn", lat: 40.6896, lng: -73.9661 },
  { name: "Crown Heights", borough: "Brooklyn", lat: 40.6694, lng: -73.9422 },
  { name: "Downtown Brooklyn", borough: "Brooklyn", lat: 40.6928, lng: -73.9903 },
  { name: "DUMBO", borough: "Brooklyn", lat: 40.7033, lng: -73.9881 },
  { name: "Fort Greene", borough: "Brooklyn", lat: 40.6893, lng: -73.9742 },
  { name: "Greenpoint", borough: "Brooklyn", lat: 40.7304, lng: -73.9515 },
  { name: "Park Slope", borough: "Brooklyn", lat: 40.6710, lng: -73.9814 },
  { name: "Prospect Heights", borough: "Brooklyn", lat: 40.6775, lng: -73.9692 },
  { name: "Red Hook", borough: "Brooklyn", lat: 40.6745, lng: -74.0089 },
  { name: "Sunset Park", borough: "Brooklyn", lat: 40.6453, lng: -74.0124 },
  { name: "Williamsburg", borough: "Brooklyn", lat: 40.7081, lng: -73.9571 },
  { name: "Astoria", borough: "Queens", lat: 40.7644, lng: -73.9235 },
  { name: "Flushing", borough: "Queens", lat: 40.7675, lng: -73.8331 },
  { name: "Forest Hills", borough: "Queens", lat: 40.7196, lng: -73.8448 },
  { name: "Jackson Heights", borough: "Queens", lat: 40.7557, lng: -73.8831 },
  { name: "Long Island City", borough: "Queens", lat: 40.7447, lng: -73.9485 },
  { name: "Ridgewood", borough: "Queens", lat: 40.7043, lng: -73.9018 },
  { name: "Sunnyside", borough: "Queens", lat: 40.7433, lng: -73.9196 },
  { name: "Fordham", borough: "The Bronx", lat: 40.8610, lng: -73.8901 },
  { name: "Mott Haven", borough: "The Bronx", lat: 40.8089, lng: -73.9229 },
  { name: "Riverdale", borough: "The Bronx", lat: 40.8909, lng: -73.9126 },
  { name: "St. George", borough: "Staten Island", lat: 40.6437, lng: -74.0765 },
];

/** Farther than this from every neighborhood above and a position is not read as New York. */
export const NYC_RADIUS_KM = 25;
