#!/usr/bin/env python3
"""
Extract book information from books_enriched.jsonl
Display: book name, author, location (with lat/lng), and image_url
"""

import json
import re
from typing import Optional, Tuple

# Common locations with approximate coordinates
LOCATION_COORDS = {
    "Chicago, Illinois (United States)": (41.8781, -87.6298),
    "England, London, England": (51.5074, -0.1278),
    "Amsterdam (Netherlands), Las Vegas, Nevada (United States), New York City, New York (United States), Upper East Side, New York City, New York (United States)": (40.7128, -74.0060),
    "Parma (Italy), Italy, Waterloo (Belgium), Emilia-Romagna (Italy)": (44.8046, 10.3276),
    "New York City, New York (United States), Pacific Northwest (United States)": (40.7128, -74.0060),
    "Morocco": (31.7917, -7.0926),
    "Warsaw (Poland), Poland": (52.2297, 21.0122),
    "Kyrgyzstan, U.S.S.R.": (41.5015, 74.5467),
    "Stockholm (Sweden), Hedeby Island (Sweden), Hedestad, Stockholm (Sweden), Sweden": (59.3293, 18.0686),
    "Tokyo (Japan), Japan": (35.6762, 139.6503),
    "Paris (France), France": (48.8566, 2.3522),
    "Russia": (61.5240, 105.3188),
    "Japan": (36.2048, 138.2529),
    "China": (35.8617, 104.1954),
    "Istanbul (Turkey)": (41.0082, 28.9784),
    "Ireland, Dublin (Ireland)": (53.3498, -6.2603),
    "Berlin (Germany), Rügen (Germany)": (52.5200, 13.4050),
    "France": (46.2276, 2.2137),
    "Sweden": (60.1282, 18.6435),
    "Norway": (60.4720, 8.4689),
    "Portugal": (39.3999, -8.2245),
    "Italy": (41.8719, 12.5674),
    "India, Bombay (India), South Asia, Mumbai (India)": (19.0760, 72.8777),
}

def extract_location_coords(location_str: str) -> Optional[Tuple[float, float]]:
    """
    Try to extract latitude and longitude from location string.
    """
    if not location_str:
        return None
    
    # Check exact match first
    if location_str in LOCATION_COORDS:
        return LOCATION_COORDS[location_str]
    
    # Try to find first location mention in a comma-separated list
    first_location = location_str.split(',')[0].strip()
    
    # Search for partial matches
    for key, coords in LOCATION_COORDS.items():
        if first_location.lower() in key.lower():
            return coords
    
    return None


def extract_books_info():
    """Extract and display book information from the JSONL file."""
    
    file_path = "data/books_enriched.jsonl"
    books_data = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                try:
                    book = json.loads(line.strip())
                    
                    # Extract required fields
                    title = book.get('title_vi') or book.get('title_eng') or book.get('original_title', 'N/A')
                    author = book.get('author', 'N/A')
                    image_url = book.get('image_url', 'N/A')
                    book_id = book.get('book_id', 'N/A')
                    
                    # Get location information
                    location_name = None
                    location_coords = None
                    
                    # Try goodreads_setting first
                    if book.get('goodreads_setting'):
                        location_name = book.get('goodreads_setting')
                        location_coords = extract_location_coords(location_name)
                    
                    # If no goodreads_setting, try locations array
                    elif book.get('locations') and len(book.get('locations', [])) > 0:
                        location_name = book['locations'][0].get('name', 'N/A')
                        location_coords = extract_location_coords(location_name)
                    
                    books_data.append({
                        'book_id': book_id,
                        'title': title,
                        'author': author,
                        'location': location_name,
                        'coordinates': location_coords,
                        'image_url': image_url
                    })
                    
                except json.JSONDecodeError as e:
                    print(f"Error parsing line {line_num}: {e}")
                    continue
    
    except FileNotFoundError:
        print(f"File not found: {file_path}")
        return
    
    # Display results
    print("=" * 150)
    print(f"{'Title':<35} | {'Author':<22} | {'Location':<40} | {'Lat,Lng':<20} | {'Image URL (truncated)'}")
    print("=" * 150)
    
    for book in books_data:
        coords_str = f"{book['coordinates'][0]:.4f}, {book['coordinates'][1]:.4f}" if book['coordinates'] else "N/A"
        image_url = book['image_url'][:50] + "..." if len(book['image_url']) > 50 else book['image_url']
        location = (book['location'] or 'N/A')[:38]
        title = book['title'][:33]
        author = book['author'][:20]
        
        print(f"{title:<35} | {author:<22} | {location:<40} | {coords_str:<20} | {image_url}")
    
    print("=" * 150)
    print(f"\n📊 Summary Statistics:")
    print(f"  Total books: {len(books_data)}")
    print(f"  Books with location: {sum(1 for b in books_data if b['location'])}")
    print(f"  Books with coordinates: {sum(1 for b in books_data if b['coordinates'])}")
    print(f"  Books with image URL: {sum(1 for b in books_data if b['image_url'] != 'N/A')}")
    
    return books_data


def save_to_json(books_data, output_file="books_extracted.json"):
    """Save extracted books to a JSON file."""
    clean_data = []
    for book in books_data:
        clean_book = {
            'book_id': book['book_id'],
            'title': book['title'],
            'author': book['author'],
            'location': book['location'],
            'coordinates': list(book['coordinates']) if book['coordinates'] else None,
            'image_url': book['image_url']
        }
        clean_data.append(clean_book)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(clean_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Data saved to {output_file}")


if __name__ == "__main__":
    books = extract_books_info()
    if books:
        save_to_json(books)
