"""
Reset regular user signup data.

Run with:
    python -m app.scripts.reset_users --yes
"""

import argparse
import asyncio

from sqlalchemy import text

from app.database import engine


async def reset_users() -> None:
    """Remove regular user accounts and dependent user-owned records."""
    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                UPDATE availability_slots
                SET booked_session_id = NULL
                WHERE booked_session_id IN (
                    SELECT id
                    FROM consultation_sessions
                    WHERE user_id IN (
                        SELECT id
                        FROM users
                        WHERE role = 'user'
                    )
                )
                """
            )
        )

        await conn.execute(
            text(
                """
                DELETE FROM user_diet_preferences
                WHERE user_id IN (
                    SELECT id
                    FROM users
                    WHERE role = 'user'
                )
                """
            )
        )

        await conn.execute(
            text(
                """
                DELETE FROM daily_meal_logs
                WHERE user_id IN (
                    SELECT id
                    FROM users
                    WHERE role = 'user'
                )
                """
            )
        )

        await conn.execute(
            text(
                """
                DELETE FROM image_analysis_logs
                WHERE user_id IN (
                    SELECT id
                    FROM users
                    WHERE role = 'user'
                )
                """
            )
        )

        await conn.execute(
            text(
                """
                DELETE FROM users
                WHERE role = 'user'
                """
            )
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Reset user signup data in the database.")
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Confirm that all user accounts and dependent data should be deleted.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.yes:
        raise SystemExit("Refusing to reset user data without --yes")

    asyncio.run(reset_users())
    print("Reset complete: regular signup users and dependent records were removed.")


if __name__ == "__main__":
    main()