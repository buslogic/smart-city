#!/usr/bin/env python3
"""
SmartCity GPS Sync Script
Ovaj skript se pokreće na legacy serveru kao CRON job
i šalje GPS podatke na SmartCity API

CRON setup: */5 * * * * /usr/bin/python3 /path/to/smartcity-gps-sync.py

Instalacija dependency-ja:
pip install mysql-connector-python requests
"""

import json
import logging
import sys
from datetime import datetime, timedelta
from typing import List, Dict, Any

import mysql.connector
import requests
from mysql.connector import Error

# Konfiguracija
CONFIG = {
    'api_url': 'https://api.smart-city.rs/gps-ingest/batch',  # Promeni na produkcijski URL
    'api_key': 'smartcity_legacy_gps_key_2024',
    'db_host': '79.101.48.11',
    'db_port': 3306,
    'db_name': 'pib100065430gps',
    'db_user': 'YOUR_DB_USER',  # Postavi kredencijale
    'db_pass': 'YOUR_DB_PASS',
    'batch_size': 1000,  # Broj GPS tačaka po batch-u
    'time_window_minutes': 5,  # Poslednih 5 minuta
    'log_file': '/var/log/smartcity-gps-sync.log',
    'debug': True,
    'ssl_verify': False  # Za development, u produkciji postaviti na True
}

# Setup logging
logging.basicConfig(
    level=logging.DEBUG if CONFIG['debug'] else logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(CONFIG['log_file']),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


def fetch_gps_data(connection) -> List[Dict[str, Any]]:
    """Dohvati GPS podatke iz legacy baze"""
    try:
        cursor = connection.cursor(dictionary=True)
        
        # Kalkuliši vremenski okvir
        time_threshold = datetime.now() - timedelta(minutes=CONFIG['time_window_minutes'])
        
        query = """
            SELECT 
                garageNo,
                lat,
                lng,
                speed,
                course,
                alt,
                state,
                inroute AS inRoute,
                line_number AS lineNumber,
                direction,
                captured,
                edited,
                (IFNULL(people_counter_1_in, 0) + IFNULL(people_counter_2_in, 0) + 
                 IFNULL(people_counter_3_in, 0) + IFNULL(people_counter_4_in, 0)) AS peopleIn,
                (IFNULL(people_counter_1_out, 0) + IFNULL(people_counter_2_out, 0) + 
                 IFNULL(people_counter_3_out, 0) + IFNULL(people_counter_4_out, 0)) AS peopleOut,
                battery_status AS batteryStatus
            FROM current
            WHERE captured > %s
            AND garageNo IS NOT NULL
            AND lat IS NOT NULL
            AND lng IS NOT NULL
            ORDER BY captured DESC
            LIMIT %s
        """
        
        cursor.execute(query, (time_threshold, CONFIG['batch_size']))
        results = cursor.fetchall()
        cursor.close()
        
        logger.info(f"Fetched {len(results)} GPS points from database")
        return results
        
    except Error as e:
        logger.error(f"Database error: {e}")
        raise


def prepare_payload(gps_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Pripremi podatke za slanje na API"""
    
    def format_point(row):
        """Formatiraj pojedinačnu GPS tačku"""
        return {
            'garageNo': row['garageNo'],
            'lat': float(row['lat']),
            'lng': float(row['lng']),
            'speed': int(row['speed'] or 0),
            'course': int(row['course'] or 0),
            'alt': int(row['alt'] or 0),
            'state': int(row['state'] or 0),
            'inRoute': int(row['inRoute'] or 0),
            'lineNumber': row['lineNumber'],
            'direction': int(row['direction']) if row['direction'] else None,
            'peopleIn': int(row['peopleIn'] or 0),
            'peopleOut': int(row['peopleOut'] or 0),
            'batteryStatus': int(row['batteryStatus']) if row['batteryStatus'] else None,
            'captured': row['captured'].isoformat() if isinstance(row['captured'], datetime) else str(row['captured']),
            'edited': row['edited'].isoformat() if isinstance(row['edited'], datetime) else str(row['edited'])
        }
    
    return {
        'data': [format_point(row) for row in gps_data],
        'source': 'legacy_cron',
        'timestamp': datetime.now().isoformat()
    }


def send_to_api(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Pošalji podatke na SmartCity API"""
    headers = {
        'Content-Type': 'application/json',
        'X-API-Key': CONFIG['api_key']
    }
    
    try:
        response = requests.post(
            CONFIG['api_url'],
            json=payload,
            headers=headers,
            timeout=30,
            verify=CONFIG['ssl_verify']
        )
        
        response.raise_for_status()
        return response.json()
        
    except requests.RequestException as e:
        logger.error(f"API request failed: {e}")
        if hasattr(e, 'response') and e.response is not None:
            logger.error(f"Response: {e.response.text}")
        raise


def main():
    """Glavni program"""
    logger.info("=== SmartCity GPS Sync Started ===")
    
    connection = None
    try:
        # Konektuj se na bazu
        logger.info("Connecting to legacy database...")
        connection = mysql.connector.connect(
            host=CONFIG['db_host'],
            port=CONFIG['db_port'],
            database=CONFIG['db_name'],
            user=CONFIG['db_user'],
            password=CONFIG['db_pass'],
            connection_timeout=10
        )
        
        if not connection.is_connected():
            raise Exception("Failed to connect to database")
        
        logger.info("Connected to legacy database")
        
        # Dohvati GPS podatke
        gps_data = fetch_gps_data(connection)
        
        if not gps_data:
            logger.info("No new GPS data to sync")
            return 0
        
        # Pripremi i pošalji podatke
        payload = prepare_payload(gps_data)
        logger.info(f"Sending {len(gps_data)} GPS points to API...")
        
        result = send_to_api(payload)
        
        if result.get('success'):
            logger.info(f"Successfully synced {result.get('processed', 0)} GPS points")
            if result.get('failed', 0) > 0:
                logger.warning(f"Failed to sync {result['failed']} GPS points")
        else:
            logger.error(f"API returned error: {result}")
            return 1
            
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        return 1
        
    finally:
        if connection and connection.is_connected():
            connection.close()
            logger.info("Database connection closed")
    
    logger.info("=== SmartCity GPS Sync Completed ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())