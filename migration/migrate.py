#!/usr/bin/env python3
"""Migrate dashboard_data.json (Jan-March 2026) into Supabase."""

import json
import os
import sys
import urllib.request
import urllib.error
from urllib.parse import urlencode

SUPABASE_URL = 'https://vttldvghdxufqpogzpnh.supabase.co'
SUPABASE_KEY = 'sb_publishable_I8s8jBUnG2BWZmD_5k0LVw_mfVKxBXt'
DATA_FILE = 'C:/Users/omer.chodorov/Documents/Claude/Projects/Portugo/dashboard_data.json'


import re

def normalize_date(d):
    """Ensure date is in YYYY-MM-DD format. Handles many weird formats."""
    if not d:
        return d
    d = str(d).strip()
    # Already YYYY-MM-DD
    if len(d) >= 10 and d[4] == '-' and d[7] == '-':
        return d[:10]
    # Extract all digit groups
    nums = re.findall(r'\d+', d)
    if len(nums) >= 3:
        # Find the year (4-digit number)
        year = next((n for n in nums if len(n) == 4), None)
        if not year:
            return d
        # Other two numbers are day/month
        others = [int(n) for n in nums if len(n) != 4][:2]
        if len(others) < 2:
            return d
        a, b = others
        # Prefer DD/MM format (Israeli); swap if needed
        if a > 12 and b <= 12:
            day, month = a, b
        elif b > 12 and a <= 12:
            day, month = b, a
        else:
            # Default: first is day
            day, month = a, b
        return f'{year}-{str(month).zfill(2)}-{str(day).zfill(2)}'
    return d


def api(method, path, body=None, params=None):
    url = SUPABASE_URL + '/rest/v1/' + path
    if params:
        url += '?' + urlencode(params)
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    }
    data = None
    if body is not None:
        data = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            txt = resp.read().decode('utf-8')
            return json.loads(txt) if txt else None
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='replace')
        print(f'HTTP {e.code} on {method} {path}: {err_body[:500]}', file=sys.stderr)
        raise


def get_guide_ids():
    guides = api('GET', 'guides', params={'select': 'id,name'})
    return {g['name']: g['id'] for g in guides}


def clear_existing_data():
    """Clear any existing data from all tables except guides."""
    print('Clearing existing data...', file=sys.stderr)
    for table in ['bookings', 'tours', 'activities', 'transfers', 'expenses', 'cash_boxes']:
        api('DELETE', table, params={'id': 'neq.00000000-0000-0000-0000-000000000000'})
        print(f'  cleared {table}', file=sys.stderr)


def migrate_month(month_data, guide_ids):
    """Migrate a single month's data."""
    month_name = month_data['month_name']
    print(f'\n=== {month_name} ===', file=sys.stderr)

    for guide_name, g in month_data['guides'].items():
        guide_id = guide_ids.get(guide_name)
        if not guide_id:
            print(f'  SKIP {guide_name} (no id)', file=sys.stderr)
            continue

        # Insert tours + bookings
        tour_count = 0
        booking_count = 0
        activity_count = 0

        # Collect tour events (from "tours" array — only the actual tour entries, not activities)
        tours_to_insert = []
        activity_dates = {}  # date -> list of activity types (from tours with category 'other'? no, activities came separate)

        for t in g['tours']:
            # Skip tours that are actually activities (tour_type contains אשל etc)
            if t.get('category') in ('classic', 'fixed', 'private'):
                tours_to_insert.append(t)

        for t in tours_to_insert:
            tour_row = {
                'guide_id': guide_id,
                'tour_date': normalize_date(t['date']),
                'tour_type': t['tour_type'],
                'category': t['category'],
                'notes': t.get('notes', '') or ''
            }
            result = api('POST', 'tours', body=tour_row)
            if not result or len(result) == 0:
                print(f'    FAIL insert tour {t["date"]} {t["tour_type"]}', file=sys.stderr)
                continue
            tour_id = result[0]['id']
            tour_count += 1

            # Insert bookings for this tour
            for b in t.get('bookings', []):
                booking_row = {
                    'tour_id': tour_id,
                    'people': b.get('people', 0) or 0,
                    'kids': 0,  # kids sometimes missing in bookings
                    'price': b.get('price', 0) or 0,
                    'tip': b.get('tip', 0) or 0,
                    'customer_type': b.get('customer_type', '') or '',
                    'source': b.get('source', '') or '',
                    'payment_method': '',
                    'change_given': 0,
                    'costs': 0,
                    'notes': b.get('notes', '') or ''
                }
                api('POST', 'bookings', body=booking_row)
                booking_count += 1

        # Insert activities (אשל, הברזה) — we stored them separately during parsing,
        # but they're not in the tours array anymore. Calculate from summary.
        s = g['summary']
        # Eshel — need to derive days. Since we don't have individual dates here,
        # we'll create one activity row per 15€ worth, using 1st of the month as placeholder.
        # Actually: we need the actual dates. Let me handle this differently — skip for now
        # and come back once we have access to raw excel parsing.
        # For migration, just log activities as summary rows with activity_type.

        eshel_amount = s.get('activity_income', 0)
        habraza_amount = s.get('habraza_income', 0)

        if eshel_amount > 0:
            # Split into 15€ chunks, each a separate eshel day
            num_days = int(eshel_amount / 15)
            year_month = month_data['month'] + '-01'
            for i in range(num_days):
                api('POST', 'activities', body={
                    'guide_id': guide_id,
                    'activity_date': year_month,  # placeholder date
                    'activity_type': 'eshel',
                    'amount': 15
                })
                activity_count += 1

        if habraza_amount > 0:
            num_times = int(habraza_amount / 8)
            year_month = month_data['month'] + '-01'
            for i in range(num_times):
                api('POST', 'activities', body={
                    'guide_id': guide_id,
                    'activity_date': year_month,
                    'activity_type': 'habraza',
                    'amount': 8
                })
                activity_count += 1

        # Transfers
        transfer_count = 0
        for tr in g.get('transfers', []):
            api('POST', 'transfers', body={
                'guide_id': guide_id,
                'transfer_date': normalize_date(tr['date']),
                'amount': tr['amount'],
                'transfer_type': 'to_portugo'
            })
            transfer_count += 1

        # Expenses
        expense_count = 0
        for ex in g.get('expenses', []):
            api('POST', 'expenses', body={
                'guide_id': guide_id,
                'expense_date': normalize_date(ex['date']),
                'item': ex.get('item', '') or '',
                'amount': ex['amount']
            })
            expense_count += 1

        print(f'  {guide_name}: {tour_count} tours, {booking_count} bookings, {activity_count} activities, {transfer_count} transfers, {expense_count} expenses', file=sys.stderr)


def main():
    # Load data
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Get guide IDs
    guide_ids = get_guide_ids()
    print(f'Found {len(guide_ids)} guides in Supabase', file=sys.stderr)

    # Clear existing
    clear_existing_data()

    # Migrate each month (skip cumulative — it's a computed view)
    for month_key in ['january', 'february', 'march']:
        if month_key in data:
            migrate_month(data[month_key], guide_ids)

    print('\nMigration complete!', file=sys.stderr)


if __name__ == '__main__':
    main()
