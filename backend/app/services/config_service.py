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

        try:
            # https://www.sqlite.org/wal.html
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA synchronous=NORMAL;")

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

            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_field_mappings_domain_field_name
                ON field_mappings (domain, field_name);
                """
            )

            db_channel.commit()
        except sqlite3.DatabaseError as e:
            raise sqlite3.DatabaseError(f"Database initialization failed: {e}")
        finally:
            db_channel.close()

    def get_user_preferences(self) -> UserPreferences:
        db_channel = sqlite3.connect(self.db_path)
        cursor = db_channel.cursor()

        try:
            # https://www.sqlite.org/wal.html
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA synchronous=NORMAL;")

            cursor.execute(
                "SELECT preferences_json FROM user_preferences ORDER BY id DESC LIMIT 1"
            )
            result = cursor.fetchone()

            if result:
                preferences_data = json.loads(result[0])
                return UserPreferences(**preferences_data)
            else:
                return UserPreferences()
        except sqlite3.DatabaseError as e:
            raise sqlite3.DatabaseError(f"Failed to fetch user preferences: {e}")
        finally:
            db_channel.close()

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

    def learn_field_mapping(
        self, domain: str, field_name: str, cv_path: str, confidence: float
    ) -> None:
        """
        Learn a new field mapping by inserting it into the field_mappings table.

        Args:
            domain: The domain for which the mapping is being learned.
            field_name: The name of the field being mapped.
            cv_path: The CV path associated with the field.
            confidence: The confidence score for the mapping (will be clamped to [0.0, 1.0]).

        Raises:
            ValueError: If domain or field_name is empty.
            sqlite3.DatabaseError: If there is a database error during the operation.
        """
        if not domain.strip():
            raise ValueError("Domain must be a non-empty string.")
        if not field_name.strip():
            raise ValueError("Field name must be a non-empty string.")

        clamped_confidence = max(0.0, min(1.0, confidence))

        try:
            db_channel = sqlite3.connect(self.db_path)
            cursor = db_channel.cursor()

            cursor.execute(
                """
                INSERT INTO field_mappings (domain, field_name, cv_path, confidence)
                VALUES (?, ?, ?, ?)
                """,
                (
                    domain.strip(),
                    field_name.strip(),
                    cv_path.strip(),
                    clamped_confidence,
                ),
            )

            db_channel.commit()
        except sqlite3.DatabaseError as e:
            raise sqlite3.DatabaseError(f"Failed to insert field mapping: {e}")
        finally:
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
