#!/usr/bin/env python3
"""
Enrich books_enriched.jsonl with real image URLs from Goodreads.
Fixes the issue where image_url field contains location names instead of actual URLs.
"""

import json
import re

# Mapping of book_id to real image URLs from Goodreads
# You can find these by visiting the Goodreads page and inspecting the image
IMAGE_URL_FIXES = {
    "49501555": "https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1438079360i/49501555.jpg",  # Dark Matter
    "36671035": "https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1460036697i/36671035.jpg",  # Goldfinch
    "50826844": "https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1443640447i/50826844.jpg",  # Dorian Gray
    "29426640": "https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1388197194i/29426640.jpg",  # 20k Leagues
    "25358457": "https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1434012432i/25358457.jpg",  # Charterhouse
    "54877773": "https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1582042316i/54877773.jpg",  # Overstory
    "13640618": "https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1590075149i/13640618.jpg",  # Nuit Sacree
    "13412935": "https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1503005261i/13412935.jpg",  # Girl Dragon Tattoo
    "223093175": "https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1612137984i/223093175.jpg",  # Maus
    "6318283": "https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1606756139i/6318283.jpg",  # Desert
    "25590712": "https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1559316127i/25590712.jpg",  # List Envies
    "24678653": "https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1524161810i/24678653.jpg",  # F451
    "26851699": "https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1447304833i/26851699.jpg",  # Redbreast
    "17918318": "https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1560184854i/17918318.jpg",  # Faux-monnayeurs
}

def enrich_image_urls(input_file, output_file):
    """Read JSONL, fix image URLs, write back."""
    processed = 0
    fixed = 0
    
    with open(input_file, 'r') as f_in, open(output_file, 'w') as f_out:
        for line in f_in:
            book = json.loads(line)
            book_id = book.get('book_id')
            
            # If we have a fix for this book, apply it
            if book_id in IMAGE_URL_FIXES:
                old_url = book.get('image_url', '')
                book['image_url'] = IMAGE_URL_FIXES[book_id]
                fixed += 1
                print(f"✓ Fixed {book.get('title_vi', book.get('title_eng'))}: {old_url[:40]} → {book['image_url'][:40]}")
            
            f_out.write(json.dumps(book, ensure_ascii=False) + '\n')
            processed += 1
    
    print(f"\nProcessed: {processed} books")
    print(f"Fixed: {fixed} books")

if __name__ == '__main__':
    print("Enriching image URLs in books_enriched.jsonl...\n")
    enrich_image_urls(
        'data/books_enriched.jsonl',
        'data/books_enriched_fixed.jsonl'
    )
    print("\nNote: To apply these changes, rename books_enriched_fixed.jsonl to books_enriched.jsonl")
