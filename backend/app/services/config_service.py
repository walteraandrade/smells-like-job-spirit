import json
import sqlite3
from typing import Optional
from typing import Any, Dict

from app.models.config import SiteConfiguration, UserPreferences


class Configuration:
    def __init__(self, db_path: str = "cv_autofill.db"):
        self.db_path = db_path
        self.init_database()

    def init_database(self):
        db_channel = sqlite3.connect(self.db_path)
        cursor = db_channel.cursor()

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS user_preferences (
                id INTEGER PRIMARY KEY,
                preferences_json TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS site_configurations (
                id INTEGER PRIMARY KEY,
                domain TEXT UNIQUE NOT NULL,
                config_json TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS field_mappings (
                id INTEGER PRIMARY KEY,
                domain TEXT,
                field_name TEXT,
                cv_path TEXT,
                confidence REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        )

        db_channel.commit()
        db_channel.close()

    def get_user_preferences(self) -> UserPreferences:
        db_channel = sqlite3.connect(self.db_path)
        cursor = db_channel.cursor()

        cursor.execute(
            "SELECT preferences_json FROM user_preferences ORDER BY id DESC LIMIT 1"
        )
        result = cursor.fetchone()

        db_channel.close()

        if result:
            preferences_data = json.loads(result[0])
            return UserPreferences(**preferences_data)
        else:
            return UserPreferences()

    def save_user_preferences(self, preferences: UserPreferences):
        db_channel = sqlite3.connect(self.db_path)
        cursor = db_channel.cursor()

        preferences_json = preferences.json()

        cursor.execute(
            """
            INSERT INTO user_preferences (preferences_json)
            VALUES (?)
        """,
            (preferences_json,),
        )

        db_channel.commit()
        db_channel.close()

    def get_site_configuration(self, domain: str) -> Optional[SiteConfiguration]:
        db_channel = sqlite3.connect(self.db_path)
        cursor = db_channel.cursor()

        cursor.execute(
            "SELECT config_json FROM site_configurations WHERE domain = ?", (domain,)
        )

        result = cursor.fetchone()

        db_channel.close()

        if result:
            config_data = json.loads(result[0])
            return SiteConfiguration(**config_data)

        return None

    def save_site_configuration(self, config: SiteConfiguration):
        db_channel = sqlite3.connect(self.db_path)
        cursor = db_channel.cursor()
        config_json = config.json()

        cursor.execute(
            """
            INSERT OR REPLACE INTO site_configurations (domain, config_json)
            VALUES (?, ?)
        """,
            (config.domain, config_json),
        )

        db_channel.commit()
        db_channel.close()

    def learn_field_mappings(
        self, domain: str, field_name: str, cv_path: str, confidence: float
    ):
        db_channel = sqlite3.connect(self.db_path)
        cursor = db_channel.cursor()

        cursor.execute(
            """
            INSERT INTO field_mappings (domain, field_name, cv_path, confidence)
            VALUES (?, ?, ?, ?)
        """,
            (domain, field_name, cv_path, confidence),
        )

        db_channel.commit()
        db_channel.close()

    def get_learned_mappings(self, domain: str) -> list[Dict[str, Any]]:
        db_channel = sqlite3.connect(self.db_path)
        cursor = db_channel.cursor()

        cursor.execute(
            """
            SELECT field_name, cv_path, AVG(confidence) as avg_confidence, COUNT(*) as usage_count
            FROM field_mappings 
            WHERE domain = ? 
            GROUP BY field_name, cv_path
            HAVING avg_confidence > 0.5
            ORDER BY usage_count DESC, avg_confidence DESC
        """,
            (domain,),
        )

        results = cursor.fetchall()
        db_channel.close()

        return [
            {
                "field_name": row[0],
                "cv_path": row[1],
                "confidence": row[2],
                "usage_count": row[3],
            }
            for row in results
        ]
