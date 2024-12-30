export interface Flight {
  airline: string;
  flightNumber: string;
  departureLocation: string;
  arrivalLocation: string;
  price: number;
  duration: string;
  stops: number;
}

export interface Hotel {
  name: string;
  location: string;
  address: string;
  rating: number;
  pricePerNight: number;
  amenities: string[];
  distanceToCenter: string;
}

export interface Attraction {
  name: string;
  location: string;
  description: string;
  price: number;
  openingHours: { open: string; close: string };
  rating: number;
  estimatedTimeNeeded: string;
}

export interface Restaurant {
  name: string;
  location: string;
  cuisine: string;
  priceRange: string;
  rating: number;
  address: string;
  mustTryDish: string;
}
